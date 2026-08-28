import type { PluginAccountScopeIds, PluginEventName } from '../../types/plugins'

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { RuntimeLog } from '../runtime-log'

/**
 * Version of the plugin context contract. Bump it whenever the shape of the
 * object passed to activate() changes in a way plugins can observe, so a
 * manifest's `apiVersion` can say "I need at least this much".
 *
 *   1 — storageDirectory / getMainWindow / openRoute
 *   2 — accounts, events, storage, settings, log, apiVersion
 */
export const PLUGIN_API_VERSION = 2

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
          Promise.resolve(listener(payload)).catch((error) => {
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
  private queue: Promise<void> = Promise.resolve()

  constructor(storageDirectory: string) {
    this.filePath = path.join(storageDirectory, 'storage.json')
  }

  private async ensureLoaded(): Promise<Record<string, unknown>> {
    if (this.data) return this.data

    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))

      this.data =
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {}
    } catch {
      // Missing or corrupt file — start empty rather than failing the plugin.
      this.data = {}
    }

    return this.data
  }

  private persist() {
    this.queue = this.queue
      .then(() =>
        writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
      )
      .catch((error) => {
        RuntimeLog.error('plugin-storage', error)
      })

    return this.queue
  }

  async get(key: string, fallback?: unknown) {
    const data = await this.ensureLoaded()

    return key in data ? data[key] : fallback
  }

  async set(key: string, value: unknown) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Storage keys must be non-empty strings.')
    }

    const data = await this.ensureLoaded()

    if (value === undefined) {
      delete data[key]
    } else {
      // Round-trip through JSON so functions, class instances and cycles
      // fail loudly here instead of producing an unreadable file later.
      data[key] = JSON.parse(JSON.stringify(value)) as unknown
    }

    await this.persist()
  }

  async delete(key: string) {
    const data = await this.ensureLoaded()

    delete data[key]
    await this.persist()
  }

  async all() {
    return { ...(await this.ensureLoaded()) }
  }
}
