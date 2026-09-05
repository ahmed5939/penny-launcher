import { randomUUID } from 'node:crypto'
import { cp, mkdir, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { app, dialog, shell } from 'electron'
import { z } from 'zod'
import type {
  MarketplacePlugin, PluginActionResult, PluginManageRequest, PluginReview,
  PluginReviewResult, PluginSettingsResult, PluginSummary, PluginPermission,
} from '../../types/plugins'
import { PLUGIN_PERMISSIONS } from '../../types/plugins'
import { PLUGIN_API_VERSION, PluginBridge, PluginStorage } from './plugin-api'
import { DataDirectory } from './data-directory'
import { inspectPlugin, type InspectedPlugin } from './plugin-package'
import { PluginSandbox } from './plugin-sandbox'
import {
  dispatchPlugin, emptyPluginUI, pluginLog, readPluginSettings, savePluginSettings,
  type PluginRuntimeRecord,
} from './plugin-broker'
import { redactSecrets } from '../secret-redaction'

type Installed = PluginRuntimeRecord & {
  package: InspectedPlugin
  status: PluginSummary['status']
  error: string | null
  canRollback: boolean
}
type Approval = { enabled: boolean; digests: string[]; permissions: PluginPermission[] }
type Review = { package: InspectedPlugin; expires: number }
const failure = (error: unknown): PluginActionResult => ({ ok: false, error: redactSecrets(error instanceof Error ? error.message : String(error)).slice(0, 2000) })

/** No plugin source is ever required or evaluated in the main process. */
export class PluginManager {
  private static root = DataDirectory.getDataDirectoryPath()
  private static userDirectory = path.join(PluginManager.root, 'plugins')
  private static catalog = path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'plugins', 'marketplace')
  private static staging = path.join(PluginManager.root, 'plugin-staging')
  private static backups = path.join(PluginManager.root, 'plugin-backups')
  private static controlDirectory = path.join(PluginManager.root, 'plugin-control')
  private static control = new PluginStorage(PluginManager.controlDirectory)
  private static plugins = new Map<string, Installed>()
  private static stores = new Map<string, PluginStorage>()
  private static reviews = new Map<string, Review>()
  private static loading: Promise<void> | null = null
  private static queue: Promise<unknown> = Promise.resolve()
  private static safeMode = false

  private static serialize<T>(action: () => Promise<T>): Promise<T> {
    const result = PluginManager.queue.then(action)
    PluginManager.queue = result.catch(() => {})
    return result
  }
  private static async approval(id: string): Promise<Approval> {
    return z.object({ enabled: z.boolean(), digests: z.array(z.string()), permissions: z.array(z.enum(PLUGIN_PERMISSIONS)).default([]) }).parse(
      await PluginManager.control.get(id, { enabled: false, digests: [] })
    )
  }
  static load() {
    PluginManager.loading ??= PluginManager.loadAll()
    return PluginManager.loading
  }
  private static async loadAll() {
    await Promise.all([PluginManager.userDirectory, PluginManager.controlDirectory, PluginManager.staging, PluginManager.backups].map((dir) => mkdir(dir, { recursive: true })))
    PluginManager.safeMode = process.argv.includes('--disable-plugins') || await PluginManager.control.get('_safeMode', false) === true
    // Previous review snapshots are inert and can be discarded after restart.
    for (const entry of await readdir(PluginManager.staging)) await rm(path.join(PluginManager.staging, entry), { recursive: true, force: true })
    for (const entry of await readdir(PluginManager.userDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      try {
        const pkg = await inspectPlugin(path.join(PluginManager.userDirectory, entry.name))
        if (PluginManager.plugins.has(pkg.manifest.id)) continue
        const plugin = await PluginManager.record(pkg)
        PluginManager.plugins.set(pkg.manifest.id, plugin)
        await PluginManager.start(plugin)
      } catch (error) {
        // Invalid folders never execute. They remain available for the validator.
        const { RuntimeLog } = await import('../runtime-log')
        RuntimeLog.error('plugin-discovery', error)
      }
    }
  }
  private static async record(pkg: InspectedPlugin): Promise<Installed> {
    const storageDirectory = path.join(PluginManager.root, 'plugin-data', pkg.manifest.id)
    await mkdir(storageDirectory, { recursive: true })
    let storage = PluginManager.stores.get(pkg.manifest.id)
    if (!storage) {
      storage = new PluginStorage(storageDirectory)
      PluginManager.stores.set(pkg.manifest.id, storage)
    }
    let canRollback = false
    try { await inspectPlugin(path.join(PluginManager.backups, pkg.manifest.id)); canRollback = true } catch { /* No backup. */ }
    return { package: pkg, manifest: pkg.manifest, status: 'disabled', error: null, host: null,
      ui: emptyPluginUI(), logs: [], jobs: [], lastQuestRead: 0, lastNotification: 0, lastExternal: 0, storage, canRollback }
  }
  private static async start(plugin: Installed) {
    const { manifest, digest } = plugin.package
    const approval = await PluginManager.approval(manifest.id)
    plugin.error = null
    if (manifest.runtime !== 'sandbox') {
      plugin.status = 'review'
      plugin.error = 'This legacy add-on must migrate to the sandbox API. Its code has not been executed.'
      return
    }
    if ((manifest.apiVersion ?? 1) > PLUGIN_API_VERSION) {
      plugin.status = 'error'; plugin.error = 'Update Penny to use this plugin API version.'; return
    }
    if (!approval.digests.includes(digest)) { plugin.status = 'review'; return }
    if (PluginManager.safeMode || !approval.enabled) { plugin.status = 'disabled'; return }
    plugin.ui = emptyPluginUI()
    plugin.jobs = []
    try {
      const host = new PluginSandbox(
        async (method, args) => {
          try { return await dispatchPlugin(plugin, method, args) }
          catch (error) {
            pluginLog(plugin, 'error', `${method}: ${failure(error).error}`)
            throw error
          }
        },
        (message) => {
          plugin.host = null
          plugin.status = 'error'
          plugin.error = redactSecrets(message)
          PluginBridge.clearPlugin(manifest.id)
          for (const job of plugin.jobs) if (job.status === 'running') job.status = 'cancelled'
          pluginLog(plugin, 'error', message)
        },
      )
      plugin.host = host
      await host.start(plugin.package.source)
      plugin.status = 'running'
      pluginLog(plugin, 'info', `Started API v${PLUGIN_API_VERSION} in sandbox.`)
      if (manifest.permissions?.includes('accounts:read')) {
        for (const event of ['accounts-changed', 'account-scope-changed'] as const) {
          PluginBridge.on(manifest.id, event, (payload) => host.event(event, payload))
        }
      }
      if (manifest.permissions?.includes('settings:read')) PluginBridge.on(manifest.id, 'settings-changed', () => host.event('settings-changed'))
    } catch (error) {
      plugin.host?.destroy(); plugin.host = null
      plugin.status = 'error'; plugin.error = failure(error).error ?? 'Activation failed.'
      pluginLog(plugin, 'error', plugin.error)
    }
  }
  private static async stop(plugin: Installed) {
    PluginBridge.clearPlugin(plugin.manifest.id)
    const host = plugin.host
    plugin.host = null
    await host?.stop()
    plugin.status = 'disabled'
    for (const job of plugin.jobs) if (job.status === 'running') job.status = 'cancelled'
    pluginLog(plugin, 'info', 'Stopped. Pending plugin work was cancelled.')
  }
  static async list(): Promise<PluginSummary[]> {
    await PluginManager.load()
    return [...PluginManager.plugins.values()].map((plugin) => ({
      id: plugin.manifest.id, name: plugin.manifest.name,
      description: plugin.manifest.description ?? null, version: plugin.manifest.version ?? null,
      source: 'user', status: plugin.status, error: plugin.error,
      repository: plugin.manifest.repository ?? null, capabilities: plugin.manifest.capabilities ?? [],
      permissions: plugin.manifest.permissions ?? [], canOpen: plugin.status === 'running' && !!plugin.host?.canOpen,
      safeMode: PluginManager.safeMode, canRollback: plugin.canRollback,
      ui: plugin.ui, jobs: plugin.jobs, logs: plugin.logs,
    }))
  }
  static async marketplace(): Promise<MarketplacePlugin[]> {
    await PluginManager.load()
    const result: MarketplacePlugin[] = []
    let entries: string[] = []
    try { entries = await readdir(PluginManager.catalog) } catch { return result }
    for (const entry of entries) {
      try {
        const { manifest } = await inspectPlugin(path.join(PluginManager.catalog, entry))
        result.push({ id: manifest.id, name: manifest.name, description: manifest.description ?? null,
          version: manifest.version ?? null, author: manifest.author ?? null, category: manifest.category ?? null,
          repository: manifest.repository ?? null, capabilities: manifest.capabilities ?? [], permissions: manifest.permissions ?? [],
          installed: PluginManager.plugins.has(manifest.id) })
      } catch { /* Not a valid catalog package. */ }
    }
    return result
  }
  /** All install paths produce a review; none execute code before acceptance. */
  static async review(kind: unknown, id?: unknown): Promise<PluginReviewResult> {
    return PluginManager.serialize(async () => {
      await PluginManager.load()
      let snapshot: string | null = null
      try {
        let directory: string
        if (kind === 'import') {
          const selection = await dialog.showOpenDialog({ title: 'Import Penny add-on folder', properties: ['openDirectory'] })
          if (selection.canceled || !selection.filePaths[0]) return { ok: true }
          directory = selection.filePaths[0]
        } else {
          const pluginId = z.string().regex(/^[a-z0-9-]{1,64}$/).parse(id)
          if (kind === 'installed') {
            const installed = PluginManager.plugins.get(pluginId)
            if (!installed) throw new Error('Add-on is not installed.')
            directory = installed.package.directory
          } else if (kind === 'catalog') directory = path.join(PluginManager.catalog, pluginId)
          else throw new Error('Unknown review source.')
        }
        const original = await inspectPlugin(directory)
        if (original.manifest.runtime !== 'sandbox') throw new Error('Migrate this add-on to runtime: sandbox before installing. See plugins/DEVELOPING.md.')
        if ((original.manifest.apiVersion ?? 1) > PLUGIN_API_VERSION) throw new Error('This add-on needs a newer Penny version.')
        for (const [token, item] of PluginManager.reviews) {
          if (item.expires < Date.now()) { await rm(item.package.directory, { recursive: true, force: true }); PluginManager.reviews.delete(token) }
        }
        if (PluginManager.reviews.size >= 5) throw new Error('Close an existing package review first.')
        const token = randomUUID()
        snapshot = path.join(PluginManager.staging, token)
        await cp(original.directory, snapshot, { recursive: true, force: false, errorOnExist: true })
        const pkg = await inspectPlugin(snapshot)
        if (pkg.digest !== original.digest) throw new Error('Package changed while being copied. Try again.')
        const previous = PluginManager.plugins.get(pkg.manifest.id)
        const approved = await PluginManager.approval(pkg.manifest.id)
        const review: PluginReview = { token, manifest: pkg.manifest, digest: pkg.digest,
          addedPermissions: (pkg.manifest.permissions ?? []).filter((permission) => !approved.permissions.includes(permission)),
          installed: !!previous, previousVersion: previous?.manifest.version ?? null, readme: pkg.readme }
        PluginManager.reviews.set(token, { package: pkg, expires: Date.now() + 10 * 60_000 })
        return { ok: true, review }
      } catch (error) {
        if (snapshot) await rm(snapshot, { recursive: true, force: true }).catch(() => {})
        return failure(error)
      }
    })
  }
  static async discardReview(token: string) {
    return PluginManager.serialize(async () => {
      const review = PluginManager.reviews.get(token)
      PluginManager.reviews.delete(token)
      if (review) await rm(review.package.directory, { recursive: true, force: true })
      return { ok: true }
    })
  }
  static acceptReview(token: string): Promise<PluginActionResult> {
    return PluginManager.serialize(async () => {
      const review = PluginManager.reviews.get(token)
      if (!review || review.expires < Date.now()) return { ok: false, error: 'Review expired. Review the package again.' }
      PluginManager.reviews.delete(token)
      try {
        const pkg = await inspectPlugin(review.package.directory)
        if (pkg.digest !== review.package.digest) throw new Error('Reviewed files changed. Review the package again.')
        await PluginManager.replace(pkg)
        return { ok: true }
      } catch (error) { return failure(error) }
      finally { await rm(review.package.directory, { recursive: true, force: true }).catch(() => {}) }
    })
  }
  private static async replace(pkg: InspectedPlugin) {
    const id = pkg.manifest.id
    const old = PluginManager.plugins.get(id)
    const approval = await PluginManager.approval(id)
    const destination = old?.package.directory ?? path.join(PluginManager.userDirectory, id)
    const backup = path.join(PluginManager.backups, id)
    const oldBackup = `${backup}-${randomUUID()}`
    let movedOld = false
    let movedBackup = false
    let placedNew = false
    const enableNew = old ? approval.enabled || old.status === 'review' : true
    await PluginManager.stopIfPresent(old)
    try {
      if (old) {
        try { await rename(backup, oldBackup); movedBackup = true } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
        await rename(destination, backup); movedOld = true
      }
      // rename refuses a non-empty existing directory; never delete unrelated folders.
      await rename(pkg.directory, destination); placedNew = true
      const installed = await PluginManager.record(await inspectPlugin(destination))
      await PluginManager.control.set(id, { enabled: enableNew,
        permissions: pkg.manifest.permissions ?? [], digests: [...new Set([...approval.digests, pkg.digest])].slice(-20) })
      PluginManager.plugins.set(id, installed)
      await PluginManager.start(installed)
      if (installed.status === 'error') throw new Error(installed.error ?? 'Activation failed.')
      if (movedBackup) await rm(oldBackup, { recursive: true, force: true })
    } catch (error) {
      await PluginManager.stopIfPresent(PluginManager.plugins.get(id))
      if (placedNew) await rm(destination, { recursive: true, force: true })
      if (movedOld) await rename(backup, destination)
      if (movedBackup) await rename(oldBackup, backup)
      await PluginManager.control.set(id, approval)
      if (old) { PluginManager.plugins.set(id, old); await PluginManager.start(old) }
      else PluginManager.plugins.delete(id)
      throw error
    }
  }
  private static async stopIfPresent(plugin?: Installed) { if (plugin) await PluginManager.stop(plugin) }
  // Retained IPC entry point deliberately cannot bypass review.
  static async install(_id: string): Promise<PluginActionResult> {
    return { ok: false, error: `Review add-on ${String(_id).slice(0, 64)} before installing it.` }
  }
  static manage(request: PluginManageRequest): Promise<PluginActionResult> {
    return PluginManager.serialize(async () => {
      try {
        await PluginManager.load()
        if (request.action === 'safe-mode') {
          const enabled = z.boolean().parse(request.enabled)
          await PluginManager.control.set('_safeMode', enabled)
          PluginManager.safeMode = enabled || process.argv.includes('--disable-plugins')
          for (const plugin of PluginManager.plugins.values()) {
            if (PluginManager.safeMode) await PluginManager.stop(plugin)
            else { await PluginManager.stop(plugin); await PluginManager.start(plugin) }
          }
          return { ok: true }
        }
        const plugin = PluginManager.plugins.get(request.id)
        if (!plugin) throw new Error('Add-on is not installed.')
        const approval = await PluginManager.approval(request.id)
        switch (request.action) {
          case 'disable':
            await PluginManager.control.set(request.id, { ...approval, enabled: false })
            await PluginManager.stop(plugin); break
          case 'enable':
          case 'reload': {
            if (PluginManager.safeMode) throw new Error('Turn off safe mode first. --disable-plugins requires a restart without that flag.')
            await PluginManager.stop(plugin)
            plugin.package = await inspectPlugin(plugin.package.directory)
            if (plugin.package.manifest.id !== request.id) throw new Error('Plugin id changed; import it as a new package.')
            plugin.manifest = plugin.package.manifest
            await PluginManager.control.set(request.id, { ...approval, enabled: true })
            await PluginManager.start(plugin)
            if (plugin.status !== 'running') throw new Error(plugin.error ?? 'Review the changed package before enabling it.')
            break
          }
          case 'rollback': {
            const pkg = await inspectPlugin(path.join(PluginManager.backups, request.id))
            if (pkg.manifest.id !== request.id || !approval.digests.includes(pkg.digest)) throw new Error('Backup is not a previously approved version.')
            const temporary = path.join(PluginManager.staging, randomUUID())
            await cp(pkg.directory, temporary, { recursive: true })
            try { await PluginManager.replace(await inspectPlugin(temporary)) }
            finally { await rm(temporary, { recursive: true, force: true }) }
            break
          }
          case 'run-action':
            if (!plugin.ui.actions.some((action) => action.id === request.actionId) || !plugin.host) throw new Error('Action is unavailable.')
            await plugin.host.command('action', request.actionId); break
          case 'cancel-job': {
            const host = plugin.host
            const job = plugin.jobs.find((item) => item.id === request.jobId && item.status === 'running')
            if (!host || !job) throw new Error('Job is not running.')
            await host.command('cancel', z.string().parse(request.jobId), 1500)
            setTimeout(() => {
              if (plugin.host === host && plugin.jobs.some((item) => item.id === job.id && item.status === 'running')) {
                PluginManager.serialize(async () => {
                  if (plugin.host !== host) return
                  await PluginManager.stop(plugin)
                  pluginLog(plugin, 'error', 'Job ignored cancellation; plugin was stopped. Enable it to resume.')
                }).catch(() => {})
              }
            }, 3000)
            break
          }
          case 'save-settings': await savePluginSettings(plugin, request.values); break
          default: throw new Error('Unknown plugin action.')
        }
        return { ok: true }
      } catch (error) { return failure(error) }
    })
  }
  static remove(id: string): Promise<PluginActionResult> {
    return PluginManager.serialize(async () => {
      try {
        await PluginManager.load()
        const plugin = PluginManager.plugins.get(id)
        if (!plugin) throw new Error('Add-on is not installed.')
        await PluginManager.stop(plugin)
        await PluginManager.control.delete(id)
        await rm(plugin.package.directory, { recursive: true })
        await rm(path.join(PluginManager.backups, id), { recursive: true, force: true })
        PluginManager.plugins.delete(id)
        return { ok: true }
      } catch (error) { return failure(error) }
    })
  }
  static async readme(id: string) {
    await PluginManager.load()
    const installed = PluginManager.plugins.get(id)
    if (installed) return { ok: true, content: installed.package.readme }
    if (!/^[a-z0-9-]{1,64}$/.test(id)) return { ok: false, error: 'Invalid plugin id.' }
    try { return { ok: true, content: (await inspectPlugin(path.join(PluginManager.catalog, id))).readme } }
    catch { return { ok: false, error: 'README not found.' } }
  }
  static async getSettings(id: string): Promise<PluginSettingsResult> {
    await PluginManager.load()
    const plugin = PluginManager.plugins.get(id)
    if (!plugin) return { ok: false, error: 'Add-on not installed.' }
    try { return { ok: true, values: await readPluginSettings(plugin) } } catch (error) { return failure(error) }
  }
  static async openDirectory() { await mkdir(PluginManager.userDirectory, { recursive: true }); await shell.openPath(PluginManager.userDirectory) }
  static async open(id: string): Promise<PluginActionResult> {
    await PluginManager.load()
    const plugin = PluginManager.plugins.get(id)
    if (!plugin?.host?.canOpen) return { ok: false, error: 'Add-on has no available Open action.' }
    try { await plugin.host.command('open'); return { ok: true } } catch (error) { return failure(error) }
  }
  static async mode() { await PluginManager.load(); return { safeMode: PluginManager.safeMode, forced: process.argv.includes('--disable-plugins') } }
  static async shutdown() {
    await PluginManager.queue
    await Promise.allSettled([...PluginManager.plugins.values()].map((plugin) => PluginManager.stop(plugin)))
    PluginBridge.clearAll()
    PluginManager.plugins.clear()
    PluginManager.loading = null
  }
}
