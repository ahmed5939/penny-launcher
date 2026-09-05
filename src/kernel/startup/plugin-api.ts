import type { PluginAccountScopeIds, PluginEventName } from '../../types/plugins'

import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'

import { RuntimeLog } from '../runtime-log'

/**
 * Version of the plugin context contract. Bump it whenever the shape of the
 * object passed to activate() changes in a way plugins can observe, so a
 * manifest's `apiVersion` can say "I need at least this much".
 *
 *   1 — storageDirectory / getMainWindow / openRoute
 *   2 — accounts, events, storage, settings, log, apiVersion
 *   3 — lifecycle, timers, notifications, external links
 *   4 — sandbox-only async SDK, reviewed permissions and declarative UI
 */
export const PLUGIN_API_VERSION = 4

type PluginEventListener = (payload: unknown) => unknown

/**
 * The main-process side of the plugin API: launcher state plugins may read
 * and the change events they may subscribe to. This module deliberately
 * imports nothing from the rest of the kernel — AccountsManager,
 * SettingsManager and main.ts all push into it, so importing them back
 * would create cycles.
 */
export class PluginBridge {
  /**
   * The renderer owns account selection (the "scope"). It reports every
   * change here so main-process plugins can ask who the app is currently
   * about without reaching into renderer state.
   */
  private static accountScope: PluginAccountScopeIds = {
    primary: null,
    members: [],
  }

  private static listeners = new Map<
    string,
    Map<PluginEventName, Set<PluginEventListener>>
  >()

  static setAccountScope(scope: unknown) {
    if (typeof scope !== 'object' || scope === null) return

    const { primary, members } = scope as {
      primary?: unknown
      members?: unknown
    }

    PluginBridge.accountScope = {
      primary: typeof primary === 'string' ? primary : null,
      members: Array.isArray(members)
        ? members.filter((item): item is string => typeof item === 'string')
        : [],
    }

    PluginBridge.emit('account-scope-changed', {
      ...PluginBridge.accountScope,
      members: [...PluginBridge.accountScope.members],
    })
  }

  static getAccountScope(): PluginAccountScopeIds {
    return {
      primary: PluginBridge.accountScope.primary,
      members: [...PluginBridge.accountScope.members],
    }
  }

  static on(
    pluginId: string,
    event: PluginEventName,
    listener: PluginEventListener
  ) {
    let events = PluginBridge.listeners.get(pluginId)

    if (!events) {
      events = new Map()
      PluginBridge.listeners.set(pluginId, events)
    }

    let set = events.get(event)

    if (!set) {
      set = new Set()
      events.set(event, set)
    }

    set.add(listener)

    return () => {
      set.delete(listener)
    }
  }

  static emit(event: PluginEventName, payload?: unknown) {
    for (const [pluginId, events] of PluginBridge.listeners) {
      const set = events.get(event)

      if (!set) continue

      for (const listener of set) {
        try {
          Promise.resolve(listener(structuredClone(payload))).catch((error) => {
            RuntimeLog.error(`plugin-event:${pluginId}:${event}`, error)
          })
        } catch (error) {
          RuntimeLog.error(`plugin-event:${pluginId}:${event}`, error)
        }
      }
    }
  }

  static clearPlugin(pluginId: string) {
    PluginBridge.listeners.delete(pluginId)
  }

  static clearAll() {
    PluginBridge.listeners.clear()
  }
}

/**
 * A tiny JSON key/value store over `<storageDirectory>/storage.json`, so
 * plugins get durable settings without inventing their own file handling.
 * Writes are queued — plugins call set() from timers and window events, and
 * two interleaved read-modify-write cycles on the raw file would lose data.
 */
export class PluginStorage {
  private filePath: string
  private data: Record<string, unknown> | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(storageDirectory: string) {
    this.filePath = path.join(storageDirectory, 'storage.json')
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => {})
    return result
  }

  private async ensureLoaded(): Promise<Record<string, unknown>> {
    if (this.data) return this.data
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Plugin storage must contain a JSON object.')
      }
      this.data = parsed as Record<string, unknown>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.data = Object.create(null) as Record<string, unknown>
    }
    return this.data
  }

  async get(key: string, fallback?: unknown) {
    return this.enqueue(async () => {
      const data = await this.ensureLoaded()
      return structuredClone(Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback)
    })
  }

  async set(key: string, value: unknown) {
    if (typeof key !== 'string' || !key.length || key.length > 256) {
      throw new Error('Storage keys must contain 1–256 characters.')
    }
    // Snapshot before queueing so callers cannot mutate a pending write.
    const snapshot = value === undefined ? undefined : JSON.parse(JSON.stringify(value))
    return this.enqueue(async () => {
      const next = Object.assign(Object.create(null), await this.ensureLoaded())
      if (snapshot === undefined) delete next[key]
      else next[key] = snapshot
      const json = JSON.stringify(next, null, 2)
      if (Buffer.byteLength(json) > 1024 * 1024) {
        throw new Error('Plugin JSON storage is limited to 1 MiB.')
      }
      const temporary = `${this.filePath}.tmp`
      try {
        await writeFile(temporary, json, { encoding: 'utf8', mode: 0o600 })
        await rename(temporary, this.filePath)
        this.data = next
      } finally {
        await rm(temporary, { force: true }).catch(() => {})
      }
    })
  }

  async delete(key: string) {
    return this.set(key, undefined)
  }

  async all() {
    return this.enqueue(async () => structuredClone(await this.ensureLoaded()))
  }
}

/** Resources registered through the API are disposed even if activation fails. */
export class PluginLifecycle {
  private cleanups = new Set<() => unknown>()
  private abort = new AbortController()
  get signal() { return this.abort.signal }

  add(cleanup: () => unknown) {
    if (this.signal.aborted) throw new Error('Plugin has stopped.')
    this.cleanups.add(cleanup)
    return () => { this.cleanups.delete(cleanup) }
  }

  async dispose() {
    this.abort.abort()
    for (const cleanup of [...this.cleanups].reverse()) {
      try { await cleanup() } catch (error) { RuntimeLog.error('plugin-cleanup', error) }
    }
    this.cleanups.clear()
  }

  interval(callback: () => unknown, milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds < 1000 || milliseconds > 2_147_483_647) {
      throw new Error('Timer interval must be between 1000 and 2147483647 ms.')
    }
    if (this.signal.aborted) throw new Error('Plugin has stopped.')
    let busy = false
    const timer = setInterval(async () => {
      if (busy || this.signal.aborted) return
      busy = true
      try { await callback() } catch (error) { RuntimeLog.error('plugin-timer', error) }
      finally { busy = false }
    }, milliseconds)
    const cancel = () => clearInterval(timer)
    const unregister = this.add(cancel)
    return () => { cancel(); unregister() }
  }
}
