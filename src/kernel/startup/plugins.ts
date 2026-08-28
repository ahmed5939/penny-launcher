import { RuntimeLog } from '../runtime-log'
import type {
  MarketplacePlugin,
  PluginAccountInfo,
  PluginAccountScope,
  PluginActionResult,
  PluginEventName,
  PluginManifest,
  PluginOpenResult,
  PluginReadmeResult,
  PluginSettings,
  PluginSource,
  PluginSummary,
} from '../../types/plugins'
import type { AccountData } from '../../types/accounts'
import type { Dirent } from 'node:fs'

import {
  access,
  cp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import { app, shell } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { AccountsManager } from './accounts'
import { DataDirectory } from './data-directory'
import { MainWindow } from './windows/main'
import {
  PLUGIN_API_VERSION,
  PluginBridge,
  PluginStorage,
} from './plugin-api'
import { SettingsManager } from './settings'

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

type PluginContext = {
  /** Version of this context contract. See PLUGIN_API_VERSION. */
  apiVersion: number
  /** The plugin's own parsed manifest. */
  manifest: PluginManifest
  /** Per-plugin directory under the launcher's data folder. */
  storageDirectory: string
  getMainWindow: () => Electron.BrowserWindow | null
  /** Navigate the launcher to a page owned by the plugin. */
  openRoute: (route: string) => void
  /** Write a line to the launcher's runtime log, tagged with the plugin id. */
  log: (message: unknown) => void
  /** Read-only view of the user's accounts — never tokens or secrets. */
  accounts: {
    list: () => Array<PluginAccountInfo>
    /** Who the app is currently about, as selected in the UI. */
    getScoped: () => PluginAccountScope
  }
  /** Launcher change events. on() returns an unsubscribe function. */
  events: {
    on: (
      event: PluginEventName,
      listener: (payload: unknown) => unknown
    ) => () => void
  }
  /** Durable JSON key/value storage under storageDirectory. */
  storage: PluginStorage
  /** Read-only stable subset of the launcher's settings. */
  settings: {
    get: () => Promise<PluginSettings>
  }
}

type LoadedPlugin = {
  manifest: PluginManifest
  source: PluginSource
  directory: string
  status: 'active' | 'error'
  error: string | null
  controller: Exclude<PluginController, void> | null
}

/**
 * Plugins are plain CommonJS folders — a plugin.json manifest next to an
 * entry file exporting activate(context). They are deliberately NOT part of
 * the Vite bundle so they can carry their own windows, preload scripts,
 * assets and PowerShell helpers as real files on disk.
 *
 * Only the user's plugin directory is loaded. Marketplace packages live as
 * inert, readable folders until the user explicitly installs one.
 */
export class PluginManager {
  private static plugins: Array<LoadedPlugin> = []
  private static loading: Promise<void> | null = null

  private static marketplaceDirectory = app.isPackaged
    ? path.join(process.resourcesPath, 'plugins', 'marketplace')
    : path.join(app.getAppPath(), 'plugins', 'marketplace')

  private static userDirectory = path.join(
    DataDirectory.getDataDirectoryPath(),
    'plugins'
  )

  private static isValidId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z0-9-]{1,64}$/.test(value)
  }

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

  static load() {
    PluginManager.loading ??= PluginManager.loadAll()

    return PluginManager.loading
  }

  static async list(): Promise<Array<PluginSummary>> {
    await PluginManager.load().catch(() => {})

    return PluginManager.plugins.map<PluginSummary>((plugin) => ({
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      description: plugin.manifest.description ?? null,
      version: plugin.manifest.version ?? null,
      source: plugin.source,
      status: plugin.status,
      error: plugin.error,
      repository: plugin.manifest.repository ?? null,
      canOpen: typeof plugin.controller?.open === 'function',
    }))
  }

  static async marketplace(): Promise<Array<MarketplacePlugin>> {
    await PluginManager.load().catch(() => {})
    const packages = await PluginManager.readManifests(
      PluginManager.marketplaceDirectory
    )

    return packages.map(({ manifest }) => ({
      id: manifest.id,
      name: manifest.name,
      description: manifest.description ?? null,
      version: manifest.version ?? null,
      author: manifest.author ?? null,
      category: manifest.category ?? null,
      repository: manifest.repository ?? null,
      installed: PluginManager.plugins.some(
        (plugin) => plugin.manifest.id === manifest.id
      ),
    }))
  }

  static async install(pluginId: string): Promise<PluginActionResult> {
    if (!PluginManager.isValidId(pluginId)) {
      return { ok: false, error: 'Invalid add-on identifier.' }
    }

    await PluginManager.load().catch(() => {})

    if (
      PluginManager.plugins.some((plugin) => plugin.manifest.id === pluginId)
    ) {
      return { ok: true }
    }

    const available = await PluginManager.readManifests(
      PluginManager.marketplaceDirectory
    )
    const selected = available.find(({ manifest }) => manifest.id === pluginId)

    if (!selected) {
      return {
        ok: false,
        error: 'That add-on is not available in this catalog.',
      }
    }

    const destination = path.join(PluginManager.userDirectory, pluginId)

    try {
      await access(destination)
      return {
        ok: false,
        error: 'An add-on folder with this name already exists.',
      }
    } catch {
      // Expected: installation always starts with a new destination folder.
    }

    try {
      await cp(selected.directory, destination, {
        recursive: true,
        errorOnExist: true,
        force: false,
      })
      await PluginManager.loadPlugin(destination, 'user')

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
      await rm(destination, { recursive: true, force: true }).catch(() => {})
      return {
        ok: false,
        error: error instanceof Error ? error.message : `${error}`,
      }
    }
  }

  static async readme(pluginId: string): Promise<PluginReadmeResult> {
    if (!PluginManager.isValidId(pluginId)) {
      return { ok: false, error: 'Invalid add-on identifier.' }
    }

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

    if (!plugin) {
      return { ok: false, error: 'Add-on documentation was not found.' }
    }

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
    } catch (error) {
      return { ok: false, error: 'This add-on does not include a README.' }
    }
  }

  static async openDirectory() {
    await mkdir(PluginManager.userDirectory, { recursive: true })
    await shell.openPath(PluginManager.userDirectory)
  }

  static async open(pluginId: string): Promise<PluginOpenResult> {
    if (!PluginManager.isValidId(pluginId)) {
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

    PluginBridge.clearAll()
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

    await PluginManager.scanDirectory(PluginManager.userDirectory, 'user')
  }

  private static async readManifests(directory: string) {
    let entries: Array<Dirent> = []

    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
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

        if (
          PluginManager.isValidId(manifest.id) &&
          typeof manifest.name === 'string' &&
          manifest.name.length > 0
        ) {
          manifests.push({ directory: pluginDirectory, manifest })
        }
      } catch (error) {
        // Ignore folders that are not valid marketplace packages.
      }
    }

    return manifests
  }

  private static async scanDirectory(directory: string, source: PluginSource) {
    let entries: Array<Dirent> = []

    try {
      entries = await readdir(directory, { withFileTypes: true })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await PluginManager.loadPlugin(path.join(directory, entry.name), source)
      }
    }
  }

  private static async loadPlugin(directory: string, source: PluginSource) {
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

    if (
      !PluginManager.isValidId(manifest.id) ||
      typeof manifest.name !== 'string'
    ) {
      return
    }

    if (
      PluginManager.plugins.some((plugin) => plugin.manifest.id === manifest.id)
    ) {
      return
    }

    const loaded: LoadedPlugin = {
      manifest,
      source,
      directory,
      status: 'active',
      error: null,
      controller: null,
    }

    try {
      if (
        typeof manifest.apiVersion === 'number' &&
        manifest.apiVersion > PLUGIN_API_VERSION
      ) {
        throw new Error(
          `This add-on needs plugin API v${manifest.apiVersion}; ` +
            `this launcher provides v${PLUGIN_API_VERSION}. Update Penny.`
        )
      }

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

      const controller = await pluginModule.activate(
        PluginManager.createContext(manifest, storageDirectory)
      )

      loaded.controller = controller ?? null
    } catch (error) {
      loaded.status = 'error'
      loaded.error = error instanceof Error ? error.message : `${error}`

      // A failed activate() may have left subscriptions behind; a plugin
      // that never came up should not keep receiving launcher events.
      PluginBridge.clearPlugin(manifest.id)
    }

    PluginManager.plugins.push(loaded)
  }

  /** Account fields plugins may see — never tokens, device ids or secrets. */
  private static toAccountInfo(account: AccountData): PluginAccountInfo {
    return {
      accountId: account.accountId,
      displayName: account.displayName,
      customDisplayName: account.customDisplayName ?? '',
    }
  }

  private static createContext(
    manifest: PluginManifest,
    storageDirectory: string
  ): PluginContext {
    return {
      apiVersion: PLUGIN_API_VERSION,
      manifest: { ...manifest },
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
      log: (message) => {
        RuntimeLog.info(`plugin:${manifest.id}`, message)
      },
      accounts: {
        list: () =>
          [...AccountsManager.getAccounts().values()].map(
            PluginManager.toAccountInfo
          ),
        getScoped: (): PluginAccountScope => {
          const scope = PluginBridge.getAccountScope()
          const resolve = (accountId: string | null) => {
            if (!accountId) return null

            const account = AccountsManager.getAccountById(accountId)

            return account ? PluginManager.toAccountInfo(account) : null
          }

          return {
            primary: resolve(scope.primary),
            members: scope.members
              .map(resolve)
              .filter((item): item is PluginAccountInfo => item !== null),
          }
        },
      },
      events: {
        on: (event, listener) =>
          PluginBridge.on(manifest.id, event, listener),
      },
      storage: new PluginStorage(storageDirectory),
      settings: {
        get: async (): Promise<PluginSettings> => {
          const settings = await SettingsManager.getData()

          return {
            gamePath: settings.path,
            customProcess: settings.customProcess,
            userAgent: settings.userAgent,
          }
        },
      },
    }
  }
}
