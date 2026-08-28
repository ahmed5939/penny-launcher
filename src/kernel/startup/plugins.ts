import { RuntimeLog } from '../runtime-log'
import type {
  MarketplaceSettings,
  MarketplaceSnapshot,
  PluginActionResult,
  PluginManifest,
  PluginOpenResult,
  PluginOrigin,
  PluginOriginRecord,
  PluginReadmeResult,
  PluginSummary,
} from '../../types/plugins'
import type { Dirent } from 'node:fs'

import {
  access,
  cp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import { app, shell } from 'electron'

import {
  pluginOriginFileName,
} from '../../config/constants/marketplace'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import {
  canInstallListing,
  isValidPluginId,
  mergeCatalogs,
  originTrust,
  parseOriginRecord,
  shouldExecutePlugin,
  toMarketplacePlugin,
  type NormalizedListing,
} from '../plugin-catalog'
import {
  assertSha256Match,
  hashDirectoryTree,
  writeExtractedArchive,
} from '../plugin-archive'
import { DataDirectory } from './data-directory'
import { MarketplaceClient } from './plugin-marketplace'
import { MainWindow } from './windows/main'

/**
 * What a plugin's activate() may hand back. Everything is optional — a
 * plugin that only wants to run in the background returns nothing.
 */
type PluginController = {
  open?: () => unknown
  deactivate?: () => unknown
} | void

type PluginModule = {
  activate?: (context: PluginContext) => PluginController
}

/**
 * The only object a plugin is given. It must never include account tokens,
 * device auth, or cookie jars — activate() logging would print them, and a
 * plugin does not need them to open a Penny route or use Node itself.
 */
type PluginContext = {
  /** Per-plugin directory under the launcher's data folder. */
  storageDirectory: string
  getMainWindow: () => Electron.BrowserWindow | null
  /** Navigate the launcher to a page owned by the plugin. */
  openRoute: (route: string) => void
}

type LoadedPlugin = {
  controller: Exclude<PluginController, void> | null
  directory: string
  error: string | null
  manifest: PluginManifest
  origin: PluginOrigin
  originRecord: PluginOriginRecord | null
  status: 'active' | 'error' | 'disabled'
}

/**
 * Plugins are plain CommonJS folders — a plugin.json manifest next to an
 * entry file exporting activate(context). They are deliberately NOT part of
 * the Vite bundle so they can carry their own windows, preload scripts,
 * assets and PowerShell helpers as real files on disk.
 *
 * Trust decision: we still `require()` into Electron main. Endurance needs
 * uiohook / screen / input, and a utility-process rewrite is out of scope.
 * Isolation here is admission control, not a sandbox:
 *   - bundled copies shipped with the app are trusted
 *   - folders the user dropped into the plugins directory are trusted
 *   - remote packages need a catalog SHA-256 unless the user opts into
 *     unsigned remote add-ons
 *   - remote packages re-hash their files before load; a mismatch refuses
 *     to execute
 * Plugin context never receives account tokens. RuntimeLog redacts
 * token-like strings. A malicious add-on with Node access can still read
 * files on disk — that remaining limit is documented, not pretended away.
 */
export class PluginManager {
  private static plugins: Array<LoadedPlugin> = []
  private static loading: Promise<void> | null = null
  private static mutating: Promise<void> = Promise.resolve()
  private static lastSnapshot: MarketplaceSnapshot | null = null

  private static marketplaceDirectory = app.isPackaged
    ? path.join(process.resourcesPath, 'plugins', 'marketplace')
    : path.join(app.getAppPath(), 'plugins', 'marketplace')

  private static userDirectory = path.join(
    DataDirectory.getDataDirectoryPath(),
    'plugins'
  )

  private static async resolveInside(directory: string, relativePath: string) {
    if (!relativePath || path.isAbsolute(relativePath)) {
      throw new Error('Plugin file paths must be relative.')
    }

    const [root, target] = await Promise.all([
      realpath(directory),
      realpath(path.resolve(directory, relativePath)),
    ])
    const relative = path.relative(root, target)

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Plugin file path escapes its add-on folder.')
    }

    return target
  }

  private static queue<T>(work: () => Promise<T>) {
    const run = PluginManager.mutating.then(work, work)

    PluginManager.mutating = run.then(
      () => undefined,
      () => undefined
    )

    return run
  }

  static load() {
    PluginManager.loading ??= PluginManager.loadAll()

    return PluginManager.loading
  }

  static async list(): Promise<Array<PluginSummary>> {
    await PluginManager.load().catch(() => {})

    const updates = new Map(
      (PluginManager.lastSnapshot?.plugins ?? []).map((plugin) => [
        plugin.id,
        plugin.updateAvailable,
      ])
    )

    return PluginManager.plugins.map<PluginSummary>((plugin) => ({
      canOpen: typeof plugin.controller?.open === 'function',
      description: plugin.manifest.description ?? null,
      enabled: plugin.status !== 'disabled',
      error: plugin.error,
      homepage: plugin.manifest.homepage ?? null,
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      origin: plugin.origin,
      repository: plugin.manifest.repository ?? null,
      source: plugin.origin,
      status: plugin.status,
      trust: originTrust(plugin.origin, plugin.originRecord?.sha256 ?? null),
      updateAvailable: updates.get(plugin.manifest.id) === true,
      version: plugin.manifest.version ?? null,
    }))
  }

  static async marketplace(force = false): Promise<MarketplaceSnapshot> {
    await PluginManager.load().catch(() => {})

    const state = await MarketplaceClient.getState()
    const launcherVersion = app.getVersion()
    const bundledFolders = (await PluginManager.readManifests(
      PluginManager.marketplaceDirectory
    )).map(({ manifest }) => PluginManager.manifestToListing(manifest, true))
    const shipped = await MarketplaceClient.readShippedCatalog()
    const bundled = mergeCatalogs(shipped, bundledFolders)
    const remote = await MarketplaceClient.fetchRemote({
      force,
      url: state.catalogUrl,
    })
    const listings = mergeCatalogs(remote.catalog?.plugins ?? null, bundled)
    const snapshot: MarketplaceSnapshot = {
      allowUnsignedRemote: state.allowUnsignedRemote,
      catalogStatus: remote.status,
      catalogUrl: state.catalogUrl,
      fetchedAt: remote.fetchedAt,
      plugins: listings.map((listing) => {
        const installed = PluginManager.plugins.find(
          (plugin) => plugin.manifest.id === listing.id
        )

        return toMarketplacePlugin(listing, {
          allowUnsignedRemote: state.allowUnsignedRemote,
          enabled: installed ? installed.status !== 'disabled' : true,
          installedVersion: installed?.manifest.version ?? null,
          launcherVersion,
          listingSource:
            remote.status === 'live' ? 'remote' : remote.status,
        })
      }),
      warning: remote.warning,
    }

    PluginManager.lastSnapshot = snapshot

    return snapshot
  }

  static async getSettings(): Promise<MarketplaceSettings> {
    const state = await MarketplaceClient.getState()

    return {
      allowUnsignedRemote: state.allowUnsignedRemote,
      catalogUrl: state.catalogUrl,
    }
  }

  static async updateSettings(
    patch: Partial<MarketplaceSettings>
  ): Promise<PluginActionResult & { settings?: MarketplaceSettings }> {
    try {
      const state = await MarketplaceClient.updateState(patch)

      return {
        ok: true,
        settings: {
          allowUnsignedRemote: state.allowUnsignedRemote,
          catalogUrl: state.catalogUrl,
        },
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : `${error}`,
      }
    }
  }

  static install(pluginId: string) {
    return PluginManager.queue(() => PluginManager.installListing(pluginId, false))
  }

  static update(pluginId: string) {
    return PluginManager.queue(() => PluginManager.installListing(pluginId, true))
  }

  static uninstall(pluginId: string) {
    return PluginManager.queue(async () => {
      if (!isValidPluginId(pluginId)) {
        return { ok: false, error: 'Invalid add-on identifier.' }
      }

      await PluginManager.load().catch(() => {})
      await PluginManager.unload(pluginId)

      const destination = path.join(PluginManager.userDirectory, pluginId)

      try {
        await rm(destination, { recursive: true, force: true })
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : `${error}`,
        }
      }

      const state = await MarketplaceClient.getState()

      await MarketplaceClient.updateState({
        disabled: state.disabled.filter((id) => id !== pluginId),
      })

      return { ok: true }
    })
  }

  static setEnabled(pluginId: string, enabled: boolean) {
    return PluginManager.queue(async () => {
      if (!isValidPluginId(pluginId)) {
        return { ok: false, error: 'Invalid add-on identifier.' }
      }

      await PluginManager.load().catch(() => {})

      const destination = path.join(PluginManager.userDirectory, pluginId)

      try {
        await access(destination)
      } catch {
        return { ok: false, error: 'That add-on is not installed.' }
      }

      const state = await MarketplaceClient.getState()
      const disabled = new Set(state.disabled)

      if (enabled) disabled.delete(pluginId)
      else disabled.add(pluginId)

      await MarketplaceClient.updateState({ disabled: [...disabled] })
      await PluginManager.unload(pluginId)
      await PluginManager.loadPlugin(destination)

      const loaded = PluginManager.plugins.find(
        (plugin) => plugin.manifest.id === pluginId
      )

      if (enabled && loaded?.status === 'error') {
        return { ok: false, error: loaded.error ?? 'The add-on could not be loaded.' }
      }

      return { ok: true }
    })
  }

  static async readme(pluginId: string): Promise<PluginReadmeResult> {
    if (!isValidPluginId(pluginId)) {
      return { ok: false, error: 'Invalid add-on identifier.' }
    }

    const snapshot = await PluginManager.marketplace().catch(() => null)
    const listing = snapshot?.plugins.find((plugin) => plugin.id === pluginId)
    const available = await PluginManager.readManifests(
      PluginManager.marketplaceDirectory
    )
    const catalogPlugin = available.find(
      ({ manifest }) => manifest.id === pluginId
    )
    const installedPlugin = PluginManager.plugins.find(
      (plugin) => plugin.manifest.id === pluginId
    )
    const plugin = installedPlugin ?? catalogPlugin

    if (plugin) {
      try {
        return {
          ok: true,
          content: await readFile(
            await PluginManager.resolveInside(
              plugin.directory,
              plugin.manifest.readme ?? 'README.md'
            ),
            'utf8'
          ),
        }
      } catch {
        // Fall through to a remote README when the package has none on disk.
      }
    }

    if (listing?.readmeUrl) {
      try {
        return { ok: true, content: await MarketplaceClient.fetchText(listing.readmeUrl) }
      } catch {
        return { ok: false, error: 'Add-on documentation could not be downloaded.' }
      }
    }

    return { ok: false, error: 'This add-on does not include a README.' }
  }

  static async openDirectory() {
    await mkdir(PluginManager.userDirectory, { recursive: true })
    await shell.openPath(PluginManager.userDirectory)
  }

  static async open(pluginId: string): Promise<PluginOpenResult> {
    if (!isValidPluginId(pluginId)) {
      return { ok: false, error: 'Invalid add-on identifier.' }
    }

    await PluginManager.load().catch(() => {})

    const plugin = PluginManager.plugins.find(
      (item) => item.manifest.id === pluginId
    )

    if (!plugin?.controller?.open) {
      return {
        ok: false,
        error: `Plugin "${pluginId}" has nothing to open.`,
      }
    }

    try {
      await plugin.controller.open()

      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : `${error}`,
      }
    }
  }

  static async shutdown() {
    const plugins = [...PluginManager.plugins].reverse()

    await Promise.allSettled(
      plugins.map(async (plugin) => {
        await plugin.controller?.deactivate?.()
      })
    )

    PluginManager.plugins = []
    PluginManager.loading = null
  }

  private static async loadAll() {
    /**
     * Plugin files live outside the bundle (resources/plugins when
     * packaged), so their require('sharp') etc. cannot walk up to the
     * app's node_modules. NODE_PATH + _initPaths() puts the app's
     * node_modules on the global resolution path for them. Unpackaged
     * builds don't need it — plugins/ sits inside the repo already.
     */
    if (app.isPackaged) {
      try {
        const nodeModule = createRequire(__filename)('node:module') as {
          _initPaths?: () => void
        }
        const appNodeModules = path.join(app.getAppPath(), 'node_modules')

        process.env.NODE_PATH = process.env.NODE_PATH
          ? `${appNodeModules}${path.delimiter}${process.env.NODE_PATH}`
          : appNodeModules
        nodeModule._initPaths?.()

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        RuntimeLog.error('caught:startup/plugins.ts', error)
      }
    }

    await mkdir(PluginManager.userDirectory, { recursive: true }).catch(
      () => {}
    )

    await PluginManager.scanDirectory(PluginManager.userDirectory)
  }

  private static manifestToListing(
    manifest: PluginManifest,
    bundled: boolean
  ): NormalizedListing {
    return {
      author: manifest.author ?? null,
      bundled,
      category: manifest.category ?? null,
      description: manifest.description ?? null,
      downloadUrl: null,
      homepage: manifest.homepage ?? null,
      id: manifest.id,
      minLauncherVersion: null,
      name: manifest.name,
      readmeUrl: null,
      repository: manifest.repository ?? null,
      screenshots: [],
      sha256: null,
      signature: null,
      version: manifest.version ?? null,
    }
  }

  private static async readManifests(directory: string) {
    let entries: Array<Dirent> = []

    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return []
    }

    const manifests: Array<{ directory: string; manifest: PluginManifest }> = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginDirectory = path.join(directory, entry.name)

      try {
        const manifest = JSON.parse(
          await readFile(path.join(pluginDirectory, 'plugin.json'), 'utf8')
        ) as PluginManifest

        if (isValidPluginId(manifest.id) && typeof manifest.name === 'string' && manifest.name.length > 0) {
          manifests.push({ directory: pluginDirectory, manifest })
        }
      } catch {
        // Ignore folders that are not valid marketplace packages.
      }
    }

    return manifests
  }

  private static async scanDirectory(directory: string) {
    let entries: Array<Dirent> = []

    try {
      entries = await readdir(directory, { withFileTypes: true })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await PluginManager.loadPlugin(path.join(directory, entry.name))
      }
    }
  }

  private static async readOrigin(directory: string): Promise<PluginOriginRecord | null> {
    try {
      return parseOriginRecord(
        JSON.parse(
          await readFile(path.join(directory, pluginOriginFileName), 'utf8')
        )
      )
    } catch {
      return null
    }
  }

  private static async writeOrigin(directory: string, record: PluginOriginRecord) {
    await writeFile(
      path.join(directory, pluginOriginFileName),
      `${JSON.stringify(record, null, 2)}\n`,
      'utf8'
    )
  }

  private static purgeRequireCache(directory: string) {
    const root = path.resolve(directory)
    const cache = createRequire(__filename).cache

    for (const key of Object.keys(cache)) {
      if (key === root || key.startsWith(`${root}${path.sep}`)) {
        delete cache[key]
      }
    }
  }

  private static async unload(pluginId: string) {
    const index = PluginManager.plugins.findIndex(
      (plugin) => plugin.manifest.id === pluginId
    )

    if (index < 0) return

    const [plugin] = PluginManager.plugins.splice(index, 1)

    if (!plugin) return

    try {
      await plugin.controller?.deactivate?.()
    } catch (error) {
      RuntimeLog.error(`plugins:deactivate:${pluginId}`, error)
    }

    PluginManager.purgeRequireCache(plugin.directory)
  }

  private static async loadPlugin(directory: string) {
    let manifest: PluginManifest

    try {
      manifest = JSON.parse(
        await readFile(path.join(directory, 'plugin.json'), {
          encoding: 'utf8',
        })
      ) as PluginManifest

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Not a plugin folder (or an unreadable one) — skip silently so
      // stray files in the directory never break startup.
      return
    }

    if (!isValidPluginId(manifest.id) || typeof manifest.name !== 'string') {
      return
    }

    if (
      PluginManager.plugins.some((plugin) => plugin.manifest.id === manifest.id)
    ) {
      return
    }

    const originRecord = await PluginManager.readOrigin(directory)
    const origin = originRecord?.origin ?? 'local'
    const state = await MarketplaceClient.getState()
    const disabled = state.disabled.includes(manifest.id)
    let treeHashMatches: boolean | null = null

    if (origin === 'remote' && originRecord?.treeHash) {
      try {
        treeHashMatches =
          (await hashDirectoryTree(directory)) === originRecord.treeHash
      } catch (error) {
        RuntimeLog.error(`plugins:hash:${manifest.id}`, error)
        treeHashMatches = false
      }
    }

    const admission = shouldExecutePlugin({
      allowUnsignedRemote: state.allowUnsignedRemote,
      disabled,
      origin,
      sha256: originRecord?.sha256 ?? null,
      treeHashMatches,
    })
    const loaded: LoadedPlugin = {
      controller: null,
      directory,
      error: admission.error,
      manifest,
      origin,
      originRecord,
      status: admission.status,
    }

    if (!admission.execute) {
      PluginManager.plugins.push(loaded)
      return
    }

    try {
      const storageDirectory = path.join(
        DataDirectory.getDataDirectoryPath(),
        'plugin-data',
        manifest.id
      )

      await mkdir(storageDirectory, { recursive: true })

      const requirePlugin = createRequire(__filename)
      const pluginModule = requirePlugin(
        await PluginManager.resolveInside(
          directory,
          manifest.entry ?? 'main.js'
        )
      ) as PluginModule

      if (typeof pluginModule.activate !== 'function') {
        throw new Error('The plugin entry does not export activate().')
      }

      const controller = await pluginModule.activate({
        storageDirectory,
        getMainWindow: () => MainWindow.instance ?? null,
        openRoute: (route) => {
          if (!route.startsWith('/')) return

          const window = MainWindow.instance

          if (!window || window.isDestroyed()) return

          // Let the renderer's router own navigation. Injecting pushState into
          // a packaged file:// page turns the current URL into a nonexistent
          // Windows filesystem path; a subsequent reload then loses the route
          // and returns to the home screen.
          window.webContents.send(ElectronAPIEventKeys.PluginNavigate, route)
        },
      })

      loaded.controller = controller ?? null
    } catch (error) {
      loaded.status = 'error'
      loaded.error = error instanceof Error ? error.message : `${error}`
      RuntimeLog.error(`plugins:load:${manifest.id}`, error)
    }

    PluginManager.plugins.push(loaded)
  }

  private static async installListing(
    pluginId: string,
    replacing: boolean
  ): Promise<PluginActionResult> {
    if (!isValidPluginId(pluginId)) {
      return { ok: false, error: 'Invalid add-on identifier.' }
    }

    await PluginManager.load().catch(() => {})

    const existing = PluginManager.plugins.find(
      (plugin) => plugin.manifest.id === pluginId
    )

    if (existing && !replacing) {
      return { ok: true }
    }

    const snapshot = await PluginManager.marketplace()
    const listing = snapshot.plugins.find((plugin) => plugin.id === pluginId)

    if (!listing) {
      return {
        ok: false,
        error: 'That add-on is not available in this catalog.',
      }
    }

    const state = await MarketplaceClient.getState()
    const allowed = canInstallListing(
      {
        author: listing.author,
        bundled: listing.bundled,
        category: listing.category,
        description: listing.description,
        downloadUrl: listing.downloadUrl,
        homepage: listing.homepage,
        id: listing.id,
        minLauncherVersion: listing.minLauncherVersion,
        name: listing.name,
        readmeUrl: listing.readmeUrl,
        repository: listing.repository,
        screenshots: listing.screenshots,
        sha256: listing.sha256,
        signature: listing.signature,
        version: listing.version,
      },
      {
        allowUnsignedRemote: state.allowUnsignedRemote,
        launcherVersion: app.getVersion(),
      }
    )

    if (!allowed.ok) {
      return { ok: false, error: allowed.reason }
    }

    const bundled = (await PluginManager.readManifests(
      PluginManager.marketplaceDirectory
    )).find(({ manifest }) => manifest.id === pluginId)
    const destination = path.join(PluginManager.userDirectory, pluginId)
    const staging = path.join(
      DataDirectory.getDataDirectoryPath(),
      'plugin-tmp',
      pluginId
    )

    try {
      if (!replacing) {
        await access(destination)
        return {
          ok: false,
          error: 'An add-on folder with this name already exists.',
        }
      }
    } catch {
      // Expected: a fresh install starts with a new destination folder.
    }

    try {
      await rm(staging, { recursive: true, force: true })
      await mkdir(staging, { recursive: true })

      let origin: PluginOriginRecord
      const preferRemote =
        Boolean(listing.downloadUrl) &&
        (!bundled || listing.updateAvailable || !listing.bundled)

      if (bundled && !preferRemote) {
        await cp(bundled.directory, staging, { recursive: true })
        origin = {
          installedAt: new Date().toISOString(),
          origin: 'bundled',
          version: bundled.manifest.version,
        }
      } else if (listing.downloadUrl) {
        const archive = await MarketplaceClient.downloadArchive(listing.downloadUrl)

        if (listing.sha256) {
          assertSha256Match(archive, listing.sha256)
        } else if (!state.allowUnsignedRemote) {
          throw new Error('Unsigned remote add-on blocked.')
        }

        await writeExtractedArchive(archive, staging)

        const extractedManifest = JSON.parse(
          await readFile(path.join(staging, 'plugin.json'), 'utf8')
        ) as PluginManifest

        if (extractedManifest.id !== pluginId) {
          throw new Error('Archive plugin.json id does not match the catalog listing.')
        }

        origin = {
          catalogUrl: snapshot.catalogUrl,
          installedAt: new Date().toISOString(),
          origin: 'remote',
          sha256: listing.sha256 ?? undefined,
          treeHash: listing.sha256 ? await hashDirectoryTree(staging) : undefined,
          version: extractedManifest.version,
        }
      } else {
        return {
          ok: false,
          error: 'That add-on is not bundled and has no download URL.',
        }
      }

      await PluginManager.writeOrigin(staging, origin)
      await PluginManager.unload(pluginId)
      await rm(destination, { recursive: true, force: true })
      await mkdir(path.dirname(destination), { recursive: true })
      await cp(staging, destination, { recursive: true })
      await PluginManager.loadPlugin(destination)

      const installed = PluginManager.plugins.find(
        (plugin) => plugin.manifest.id === pluginId
      )

      if (!installed || installed.status === 'error') {
        return {
          ok: false,
          error: installed?.error ?? 'The add-on could not be loaded.',
        }
      }

      return { ok: true }
    } catch (error) {
      await cp(staging, destination, { recursive: true }).catch(() => {})

      if (!replacing) {
        await rm(destination, { recursive: true, force: true }).catch(() => {})
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : `${error}`,
      }
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(() => {})
    }
  }
}
