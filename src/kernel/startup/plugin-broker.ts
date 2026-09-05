import { z } from 'zod'
import { Notification, shell } from 'electron'
import type { PluginJob, PluginLog, PluginManifest, PluginPermission, PluginUI } from '../../types/plugins'
import { PluginBridge, PluginStorage } from './plugin-api'
import { parseSecureExternalUrl } from '../security'
import { redactSecrets } from '../secret-redaction'
import { AccountsManager } from './accounts'
import { SettingsManager } from './settings'
import { MainWindow } from './windows/main'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import type { PluginSandbox } from './plugin-sandbox'

const id = z.string().regex(/^[a-z0-9-]{1,64}$/)
const text = z.string().min(1).max(100)
export const pluginUISchema = z.object({
  panels: z.array(z.object({ id, title: text, body: z.string().max(4000) })).max(10),
  actions: z.array(z.object({ id, label: text })).max(10),
  settings: z.array(z.object({ id, label: text, type: z.enum(['text', 'boolean']), default: z.union([z.string().max(2000), z.boolean()]).optional() })).max(20),
}).superRefine((ui, context) => {
  for (const group of [ui.panels, ui.actions, ui.settings]) {
    if (new Set(group.map((item) => item.id)).size !== group.length) context.addIssue({ code: 'custom', message: 'Duplicate UI identifier.' })
  }
  for (const field of ui.settings) {
    if (field.default !== undefined && typeof field.default !== (field.type === 'text' ? 'string' : 'boolean')) context.addIssue({ code: 'custom', message: 'Setting default has the wrong type.' })
  }
})
export const emptyPluginUI = (): PluginUI => ({ panels: [], actions: [], settings: [] })
export type PluginRuntimeRecord = {
  manifest: PluginManifest
  ui: PluginUI
  logs: PluginLog[]
  jobs: PluginJob[]
  host: PluginSandbox | null
  storage: PluginStorage
  lastQuestRead: number
  lastNotification: number
  lastExternal: number
}
const permissionForMethod: Record<string, PluginPermission> = {
  'accounts.list': 'accounts:read', 'accounts.scope': 'accounts:read',
  'accounts.quests': 'quests:read', 'settings.get': 'settings:read',
  'storage.get': 'storage', 'storage.set': 'storage', 'storage.delete': 'storage', 'storage.all': 'storage',
  navigate: 'navigation', external: 'external-links', notify: 'notifications',
  'ui.register': 'ui', 'ui.settings': 'ui',
}
export function requirePluginPermission(manifest: PluginManifest, method: string) {
  const required = permissionForMethod[method]
  if (required && !manifest.permissions?.includes(required)) throw new Error(`Permission required: ${required}`)
}
export function pluginLog(plugin: PluginRuntimeRecord, level: 'info' | 'error', message: string) {
  plugin.logs.push({ time: new Date().toISOString(), level, message: redactSecrets(message).slice(0, 2000) })
  plugin.logs = plugin.logs.slice(-100)
}
function accountInfo(account: { accountId: string; displayName: string; customDisplayName?: string }) {
  return { accountId: account.accountId, displayName: account.displayName, customDisplayName: account.customDisplayName ?? '' }
}
export async function readPluginSettings(plugin: PluginRuntimeRecord) {
  const saved = await plugin.storage.get('ui-settings', {}) as Record<string, unknown>
  return Object.fromEntries(plugin.ui.settings.map((field) => {
    const expected = field.type === 'text' ? 'string' : 'boolean'
    const value = saved && typeof saved[field.id] === expected ? saved[field.id] : field.default ?? (field.type === 'text' ? '' : false)
    return [field.id, value as string | boolean]
  }))
}
export async function savePluginSettings(plugin: PluginRuntimeRecord, input: unknown) {
  const values = z.record(z.union([z.string().max(2000), z.boolean()])).parse(input)
  const fields = plugin.ui.settings
  if (Object.keys(values).length !== fields.length || fields.some((field) => typeof values[field.id] !== (field.type === 'text' ? 'string' : 'boolean'))) throw new Error('Settings do not match the plugin form.')
  await plugin.storage.set('ui-settings', values)
  plugin.host?.event('plugin-settings-changed', values)
}
export async function dispatchPlugin(plugin: PluginRuntimeRecord, method: string, args: unknown[]) {
  requirePluginPermission(plugin.manifest, method)
  switch (method) {
    case 'manifest': return plugin.manifest
    case 'log': {
      pluginLog(plugin, args[0] === 'error' ? 'error' : 'info', z.string().max(4000).parse(args[1])); return
    }
    case 'accounts.list': return [...AccountsManager.getAccounts().values()].map(accountInfo)
    case 'accounts.scope': {
      const scope = PluginBridge.getAccountScope()
      const resolve = (value: string | null) => {
        const account = value ? AccountsManager.getAccountById(value) : null
        return account ? accountInfo(account) : null
      }
      return { primary: resolve(scope.primary), members: scope.members.map(resolve).filter(Boolean) }
    }
    case 'accounts.quests': {
      const accountId = z.string().min(1).max(128).parse(args[0])
      const inScope = () => {
        const scope = PluginBridge.getAccountScope()
        return scope.primary === accountId || scope.members.includes(accountId)
      }
      if (!inScope()) throw new Error('Account is outside the current scope.')
      const account = AccountsManager.getAccountById(accountId)
      if (!account) throw new Error('Account is unavailable.')
      if (Date.now() - plugin.lastQuestRead < 10_000) throw new Error('Wait 10 seconds between quest reads.')
      plugin.lastQuestRead = Date.now()
      const { Quests } = await import('../core/quests')
      const result = await Quests.getQuests(account)
      if (!plugin.host || !inScope()) throw new Error('Plugin stopped or account scope changed.')
      return result
    }
    case 'settings.get': {
      const settings = await SettingsManager.getData()
      return { gamePath: settings.path, customProcess: settings.customProcess, userAgent: settings.userAgent }
    }
    case 'storage.get': return plugin.storage.get(z.string().max(256).parse(args[0]), args[1])
    case 'storage.set': return plugin.storage.set(z.string().max(256).parse(args[0]), args[1])
    case 'storage.delete': return plugin.storage.delete(z.string().max(256).parse(args[0]))
    case 'storage.all': return plugin.storage.all()
    case 'ui.register': plugin.ui = pluginUISchema.parse(args[0]); return
    case 'ui.settings': return readPluginSettings(plugin)
    case 'job': {
      const job = z.object({ id, label: text, status: z.enum(['running', 'completed', 'cancelled', 'error']), error: z.string().max(2000).optional() }).parse(args[0])
      if (job.error) job.error = redactSecrets(job.error)
      const index = plugin.jobs.findIndex((item) => item.id === job.id)
      if (index >= 0) plugin.jobs[index] = job
      else {
        if (plugin.jobs.length >= 20) {
          const finished = plugin.jobs.findIndex((item) => item.status !== 'running')
          if (finished < 0) throw new Error('At most 20 jobs may run.')
          plugin.jobs.splice(finished, 1)
        }
        plugin.jobs.push(job)
      }
      return
    }
    case 'navigate': {
      const route = z.string().max(500).parse(args[0])
      if (!route.startsWith('/') || route.startsWith('//') || route.includes('\\') || [...route].some((char) => char.charCodeAt(0) < 32)) throw new Error('Expected a launcher route.')
      const window = MainWindow.instance
      if (window && !window.isDestroyed()) window.webContents.send(ElectronAPIEventKeys.PluginNavigate, route)
      return
    }
    case 'external': {
      if (Date.now() - plugin.lastExternal < 5000) throw new Error('Wait 5 seconds between external links.')
      const url = parseSecureExternalUrl(z.string().max(2048).parse(args[0]))
      if (!url) throw new Error('Expected an HTTPS URL without credentials.')
      plugin.lastExternal = Date.now()
      await shell.openExternal(url.toString()); return
    }
    case 'notify': {
      if (Date.now() - plugin.lastNotification < 5000) throw new Error('Wait 5 seconds between notifications.')
      const title = text.parse(args[0])
      const body = z.string().max(1000).parse(args[1])
      if (!Notification.isSupported()) return false
      plugin.lastNotification = Date.now()
      new Notification({ title: `${plugin.manifest.name}: ${title}`, body }).show()
      return true
    }
    default: throw new Error('Unknown plugin operation.')
  }
}
