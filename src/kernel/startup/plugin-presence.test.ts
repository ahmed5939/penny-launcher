import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ loaded: vi.fn(), start: vi.fn(), update: vi.fn(), stop: vi.fn(), status: vi.fn() }))
vi.mock('electron', () => ({}))
vi.mock('./windows/main', () => ({ MainWindow: { instance: null } }))
vi.mock('./accounts', () => ({ AccountsManager: { getAccountById: () => null } }))
vi.mock('./settings', () => ({ SettingsManager: {} }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
vi.mock('./presence-loader', () => ({
  presenceLoaded: mocks.loaded,
  loadPresence: async () => ({ PresenceManager: { start: mocks.start, update: mocks.update, stop: mocks.stop, status: mocks.status } }),
}))
import { PluginBridge } from './plugin-api'
import { dispatchPlugin, type PluginRuntimeRecord } from './plugin-broker'

const request = { accountId: 'selected', text: 'Farming', availability: 'online', durationMinutes: 60 }
const snapshot = (accountId: string | null) => ({ accountId, state: accountId ? 'active' : 'stopped' })
let plugin: PluginRuntimeRecord
beforeEach(() => {
  vi.resetAllMocks()
  plugin = { manifest: { id: 'sample', name: 'Sample', permissions: ['fortnite:presence'] }, host: {}, logs: [] } as unknown as PluginRuntimeRecord
  PluginBridge.setAccountScope({ primary: 'selected', members: [] })
  mocks.loaded.mockReturnValue(true)
  mocks.status.mockReturnValue(snapshot(null))
  mocks.start.mockResolvedValue({ ok: true, error: null, snapshot: snapshot('selected') })
  mocks.stop.mockResolvedValue({ ok: true, error: null, snapshot: snapshot(null) })
})
it('starts presence for a selected account through the shared manager', async () => {
  expect(await dispatchPlugin(plugin, 'presence.start', [request])).toMatchObject({ ok: true })
  expect(mocks.start).toHaveBeenCalledWith(request)
  expect(plugin.logs.at(-1)?.message).toBe('Started presence for selected.')
})
it('refuses accounts outside the selection and missing permission', async () => {
  await expect(dispatchPlugin(plugin, 'presence.start', [{ ...request, accountId: 'other' }])).rejects.toThrow('scope')
  plugin.manifest.permissions = []
  await expect(dispatchPlugin({ ...plugin }, 'presence.start', [request])).rejects.toThrow('Permission')
  expect(mocks.start).not.toHaveBeenCalled()
})
it('does not load presence just to report status, and hides other accounts’ sessions', async () => {
  mocks.loaded.mockReturnValue(false)
  expect(await dispatchPlugin(plugin, 'presence.status', [])).toBeNull()
  expect(mocks.status).not.toHaveBeenCalled()
  mocks.loaded.mockReturnValue(true)
  mocks.status.mockReturnValue(snapshot('other'))
  expect(await dispatchPlugin(plugin, 'presence.status', [])).toBeNull()
  mocks.status.mockReturnValue(snapshot('selected'))
  expect(await dispatchPlugin(plugin, 'presence.status', [])).toEqual(snapshot('selected'))
})
it('cannot stop a session that belongs to an unselected account, and is rate limited', async () => {
  mocks.status.mockReturnValue(snapshot('other'))
  await expect(dispatchPlugin(plugin, 'presence.stop', [])).rejects.toThrow('outside')
  await expect(dispatchPlugin(plugin, 'presence.stop', [])).rejects.toThrow('rate limited')
  mocks.status.mockReturnValue(snapshot('selected'))
  expect(await dispatchPlugin({ ...plugin }, 'presence.stop', [])).toMatchObject({ ok: true })
})
