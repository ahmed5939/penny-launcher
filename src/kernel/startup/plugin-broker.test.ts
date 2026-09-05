import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ quests: vi.fn(), shell: vi.fn(), notify: vi.fn() }))
vi.mock('electron', () => ({ shell: { openExternal: mocks.shell }, Notification: class { static isSupported() { return true } show() { mocks.notify() } } }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
vi.mock('./accounts', () => ({ AccountsManager: {
  getAccounts: () => new Map([['selected', { accountId: 'selected', displayName: 'Name', accessToken: 'secret' }]]),
  getAccountById: (id: string) => ({ accountId: id, displayName: 'Name', accessToken: 'secret' }),
} }))
vi.mock('./settings', () => ({ SettingsManager: { getData: async () => ({ path: '/game', customProcess: 'game', userAgent: 'Penny', secret: 'hidden' }) } }))
vi.mock('./windows/main', () => ({ MainWindow: { instance: null } }))
vi.mock('../core/quests', () => ({ Quests: { getQuests: mocks.quests } }))
import { PluginBridge, PluginStorage } from './plugin-api'
import { dispatchPlugin, emptyPluginUI, pluginUISchema, readPluginSettings, savePluginSettings, type PluginRuntimeRecord } from './plugin-broker'
let root: string
let plugin: PluginRuntimeRecord
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'penny-broker-'))
  plugin = { manifest: { id: 'test', name: 'Test', permissions: [] }, ui: emptyPluginUI(), jobs: [], logs: [],
    storage: new PluginStorage(root), host: { event: vi.fn() } as unknown as PluginRuntimeRecord['host'],
    lastQuestRead: 0, lastNotification: 0, lastExternal: 0 }
  PluginBridge.setAccountScope({ primary: 'selected', members: ['selected'] })
  vi.clearAllMocks()
})
afterEach(() => rm(root, { recursive: true, force: true }))
it.each(['accounts.list', 'accounts.scope', 'accounts.quests', 'storage.get', 'storage.set', 'settings.get', 'notify', 'external', 'navigate', 'ui.register'])('enforces permission for %s', async (method) => {
  await expect(dispatchPlugin(plugin, method, [])).rejects.toThrow('Permission required')
})
it('returns sanitized accounts and settings only', async () => {
  plugin.manifest.permissions = ['accounts:read', 'settings:read']
  expect(await dispatchPlugin(plugin, 'accounts.list', [])).toEqual([{ accountId: 'selected', displayName: 'Name', customDisplayName: '' }])
  expect(await dispatchPlugin(plugin, 'settings.get', [])).toEqual({ gamePath: '/game', customProcess: 'game', userAgent: 'Penny' })
})
it('rejects out-of-scope authenticated requests before invoking a service', async () => {
  plugin.manifest.permissions = ['quests:read']
  await expect(dispatchPlugin(plugin, 'accounts.quests', ['other'])).rejects.toThrow('outside')
  expect(mocks.quests).not.toHaveBeenCalled()
})
it('discards authenticated results when scope changes during a request', async () => {
  plugin.manifest.permissions = ['quests:read']
  mocks.quests.mockImplementation(async () => { PluginBridge.setAccountScope({ primary: 'other', members: [] }); return { quests: [] } })
  await expect(dispatchPlugin(plugin, 'accounts.quests', ['selected'])).rejects.toThrow('scope changed')
})
it('rejects malformed UI, typed settings mismatches and duplicate actions', async () => {
  expect(pluginUISchema.safeParse({ panels: [], settings: [], actions: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }).success).toBe(false)
  plugin.ui.settings = [{ id: 'active', label: 'Active', type: 'boolean', default: false }]
  await expect(savePluginSettings(plugin, { active: 'yes' })).rejects.toThrow('match')
  await savePluginSettings(plugin, { active: true })
  expect(await readPluginSettings(plugin)).toEqual({ active: true })
})
it('blocks unsafe links and throttles notification/link side effects', async () => {
  plugin.manifest.permissions = ['external-links', 'notifications']
  await expect(dispatchPlugin(plugin, 'external', ['file:///etc/passwd'])).rejects.toThrow('HTTPS')
  await dispatchPlugin(plugin, 'external', ['https://example.com'])
  await expect(dispatchPlugin(plugin, 'external', ['https://example.com'])).rejects.toThrow('5 seconds')
  await dispatchPlugin(plugin, 'notify', ['Hello', 'Body'])
  await expect(dispatchPlugin(plugin, 'notify', ['Hello', 'Body'])).rejects.toThrow('5 seconds')
  expect(mocks.shell).toHaveBeenCalledTimes(1)
  expect(mocks.notify).toHaveBeenCalledTimes(1)
})
it('does not accept unknown operations', async () => {
  await expect(dispatchPlugin(plugin, 'credentials.get', [])).rejects.toThrow('Unknown')
})
