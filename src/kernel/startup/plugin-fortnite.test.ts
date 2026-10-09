import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ token: vi.fn(), eos: vi.fn(), transport: vi.fn(), locker: vi.fn(), sessions: vi.fn(), confirm: vi.fn() }))
vi.mock('electron', () => ({ dialog: { showMessageBox: mocks.confirm } }))
vi.mock('./windows/main', () => ({ MainWindow: { instance: { isDestroyed: () => false } } }))
vi.mock('./accounts', () => ({ AccountsManager: { getAccountById: (id: string) => id === 'selected' ? { accountId: id, displayName: 'Name' } : null } }))
vi.mock('./settings', () => ({ SettingsManager: {} }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
vi.mock('../core/authentication', () => ({ Authentication: { verifyAccessToken: mocks.token } }))
vi.mock('../core/locker', () => ({ eosToken: mocks.eos }))
vi.mock('../../services/config/base-game', async () => {
  const { default: axios } = await import('axios')
  return { baseGameService: axios.create({ adapter: mocks.transport }) }
})
vi.mock('../../services/config/locker', async () => {
  const { default: axios } = await import('axios')
  return { lockerService: axios.create({ adapter: mocks.locker }) }
})
vi.mock('../../services/config/matchmaking', async () => {
  const { default: axios } = await import('axios')
  return { matchmakingService: axios.create({ adapter: mocks.sessions }) }
})
import { PluginBridge } from './plugin-api'
import { dispatchPlugin, type PluginRuntimeRecord } from './plugin-broker'
import { dispatchFortnite } from './plugin-fortnite'
import { baseGameService } from '../../services/config/base-game'

let plugin: PluginRuntimeRecord
const query = () => dispatchPlugin(plugin, 'mcp.queryProfile', ['selected', 'campaign'])
const command = () => dispatchPlugin(plugin, 'mcp.request', ['selected', { operation: 'SetPinnedQuests', profileId: 'campaign', body: { pinnedQuestIds: ['quest'] } }])
beforeEach(() => {
  vi.resetAllMocks()
  plugin = { manifest: { id: 'sample', name: 'Sample', permissions: ['fortnite:profiles', 'fortnite:commands', 'eos:locker:read'],
    fortnite: { profiles: ['campaign'], operations: ['QueryProfile', 'SetPinnedQuests'] } }, host: {}, logs: [] } as unknown as PluginRuntimeRecord
  PluginBridge.setAccountScope({ primary: 'selected', members: [] })
  mocks.token.mockResolvedValue('HOST-SECRET')
  mocks.eos.mockResolvedValue('EOS-SECRET')
  mocks.confirm.mockResolvedValue({ response: 1 })
  mocks.transport.mockImplementation(async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: {
    secret: 'HOST-SECRET', profileChanges: [{ changeType: 'fullProfileUpdate', profile: { accountId: 'selected', profileId: 'campaign', items: {}, stats: { attributes: { level: 100, email: 'SECRET' } } } }],
  } }))
  mocks.locker.mockImplementation(async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: { access_token: 'EOS-SECRET', activeLoadoutGroup: { loadouts: {} } } }))
})
afterEach(() => { vi.useRealTimers() })
it('reads selected game data using a fixed authenticated URL and bounded transport', async () => {
  const result = await query()
  expect(result).toMatchObject({ accountId: 'selected', filtered: true, stats: { attributes: { level: 100 } } })
  expect(JSON.stringify(result)).not.toContain('SECRET')
  const config = mocks.transport.mock.calls[0][0]
  expect(config.url).toBe('/profile/selected/client/QueryProfile')
  expect(config.headers.Authorization).toBe('bearer HOST-SECRET')
  expect(config).toMatchObject({ maxRedirects: 0, timeout: 20_000, maxContentLength: 32 * 1024 * 1024, params: { profileId: 'campaign', rvn: -1 } })
})
it('cannot use the generic request route to bypass read permissions', async () => {
  plugin.manifest.permissions = ['fortnite:commands']
  await expect(dispatchPlugin(plugin, 'mcp.request', ['selected', { operation: 'QueryProfile', profileId: 'campaign' }])).rejects.toThrow('Permission')
  expect(mocks.token).not.toHaveBeenCalled()
})
it('requires both declared operation and profile access before authentication', async () => {
  plugin.manifest.fortnite!.operations = []
  await expect(query()).rejects.toThrow('declared')
  plugin.manifest.fortnite = { profiles: [], operations: ['QueryProfile'] }
  await expect(query()).rejects.toThrow('declared')
  expect(mocks.token).not.toHaveBeenCalled()
})
it('rejects undeclared operations, invalid names and account/path overrides', async () => {
  for (const operation of ['PurchaseCatalogEntry', 'RecycleItemBatch', 'SomeFutureCommand']) {
    await expect(dispatchPlugin(plugin, 'mcp.request', ['selected', { operation, profileId: 'campaign', body: { targetItemIds: ['x'] } }])).rejects.toThrow('declared')
  }
  for (const operation of ['https://evil.test', 'constructor', '__proto__', '../QueryProfile', 'Query/Profile']) {
    await expect(dispatchPlugin(plugin, 'mcp.request', ['selected', { operation, profileId: 'campaign' }])).rejects.toThrow('Unsupported')
  }
  await expect(dispatchPlugin(plugin, 'mcp.request', ['selected', { operation: 'QueryProfile', profileId: 'account_security' }])).rejects.toThrow()
  await expect(dispatchPlugin(plugin, 'mcp.queryProfile', ['../selected', 'campaign'])).rejects.toThrow()
  await expect(dispatchPlugin(plugin, 'mcp.queryProfile', ['other', 'campaign'])).rejects.toThrow('scope')
  expect(mocks.token).not.toHaveBeenCalled()
})
it('keeps the per-command dialog for packages approved before API v6 and returns the redacted reply', async () => {
  const result = await command()
  expect(result).toMatchObject({ accountId: 'selected', operation: 'SetPinnedQuests', profileId: 'campaign', applied: true, cancelled: false,
    response: { profileChanges: [{ changeType: 'fullProfileUpdate', profile: { stats: { attributes: { level: 100 } } } }] } })
  expect(JSON.stringify(result)).not.toContain('SECRET')
  expect(mocks.confirm.mock.calls[0][1]).toMatchObject({ defaultId: 0, cancelId: 0, detail: expect.stringContaining('SetPinnedQuests') })
  expect(mocks.confirm.mock.calls[0][1].detail).toContain('"quest"')
  expect(JSON.parse(mocks.transport.mock.calls[0][0].data)).toEqual({ pinnedQuestIds: ['quest'] })
  expect(JSON.stringify(plugin.logs)).not.toContain('SECRET')
})
it('does not authenticate or mutate when confirmation is cancelled', async () => {
  mocks.confirm.mockResolvedValue({ response: 0 })
  expect(await command()).toMatchObject({ applied: false, cancelled: true })
  expect(mocks.token).not.toHaveBeenCalled()
  expect(mocks.transport).not.toHaveBeenCalled()
})
it('blocks a scope round trip while authenticating', async () => {
  mocks.token.mockImplementation(async () => {
    PluginBridge.setAccountScope({ primary: null, members: [] })
    PluginBridge.setAccountScope({ primary: 'selected', members: [] })
    return 'HOST-SECRET'
  })
  await expect(query()).rejects.toThrow('scope')
  expect(mocks.transport).not.toHaveBeenCalled()
})
it('rechecks the scope after async Axios interceptors immediately before transport', async () => {
  const interceptor = baseGameService.interceptors.request.use(async (config) => {
    PluginBridge.setAccountScope({ primary: null, members: [] }); return config
  })
  try { await expect(query()).rejects.toThrow('service request failed') }
  finally { baseGameService.interceptors.request.eject(interceptor) }
  expect(mocks.transport).not.toHaveBeenCalled()
})
it('discards returned data when stopped during the transport', async () => {
  mocks.transport.mockImplementation(async () => { plugin.host = null; return { data: {} } })
  await expect(query()).rejects.toThrow('stopped')
})
it('checks permission and declarations again after human review', async () => {
  mocks.confirm.mockImplementation(async () => { plugin.manifest.fortnite!.operations = []; return { response: 1 } })
  await expect(command()).rejects.toThrow('declared')
  expect(mocks.transport).not.toHaveBeenCalled()
})
it('does not leak sensitive service errors', async () => {
  mocks.transport.mockRejectedValue(new Error('Email PRIVATE@example.com, token HOST-SECRET'))
  await expect(query()).rejects.toThrow('Fortnite service request failed')
  try { await dispatchFortnite({ ...plugin }, 'mcp.queryProfile', ['selected', 'campaign']) }
  catch (error) { expect(String(error)).not.toMatch(/PRIVATE|HOST-SECRET/) }
})
it('limits reads and serializes requests before authentication', async () => {
  await query()
  await expect(query()).rejects.toThrow('rate limited')
  expect(mocks.token).toHaveBeenCalledTimes(1)
})
it('serializes writes across plugins and releases the lock after cancellation', async () => {
  let finish!: (value: { response: number }) => void
  mocks.confirm.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  const pending = command()
  await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
  const other = { ...plugin, manifest: { ...plugin.manifest, id: 'other' } }
  const args = ['selected', { operation: 'SetPinnedQuests', profileId: 'campaign', body: { pinnedQuestIds: [] } }]
  await expect(dispatchFortnite(other, 'mcp.request', args)).rejects.toThrow('pending')
  finish({ response: 0 })
  await pending
  await expect(dispatchFortnite(other, 'mcp.request', args)).resolves.toMatchObject({ applied: true })
})
it('expires a command review without authenticating or writing', async () => {
  vi.useFakeTimers()
  mocks.confirm.mockImplementation((_window, options) => new Promise((resolve) => {
    options.signal.addEventListener('abort', () => resolve({ response: 0 }), { once: true })
  }))
  const pending = dispatchFortnite(plugin, 'mcp.request', ['selected', { operation: 'SetPinnedQuests', profileId: 'campaign', body: { pinnedQuestIds: [] } }])
  await vi.advanceTimersByTimeAsync(60_000)
  expect(await pending).toMatchObject({ applied: false, cancelled: true })
  expect(mocks.token).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
it('provides an EOS locker read with host-only credentials and filtered data', async () => {
  expect(await dispatchPlugin(plugin, 'eos.locker', ['selected'])).toEqual({ accountId: 'selected', filtered: true, activeLoadoutGroup: { loadouts: {} } })
  expect(mocks.locker.mock.calls[0][0]).toMatchObject({ url: '/account/selected/items', maxRedirects: 0, maxContentLength: 1024 * 1024 })
  expect(mocks.locker.mock.calls[0][0].headers.Authorization).toBe('Bearer EOS-SECRET')
})
it('exposes a catalog without granting execution access', async () => {
  plugin.manifest.permissions = []
  const catalog = await dispatchPlugin(plugin, 'mcp.operations', []) as Array<{ operation: string; alwaysConfirmed: boolean }>
  expect(catalog.map((entry) => entry.operation)).toEqual(expect.arrayContaining(['QueryProfile', 'DisassembleWorldItems', 'ModifyQuickbar', 'ExecuteTerminalCommand', 'RecycleItemBatch']))
  expect(catalog.find((entry) => entry.operation === 'GiftCatalogEntry')?.alwaysConfirmed).toBe(true)
  await expect(command()).rejects.toThrow('Permission')
})
it('runs declared commands from API v6 packages without a dialog, on any declared profile', async () => {
  plugin.manifest.apiVersion = 6
  plugin.manifest.fortnite = { profiles: ['theater0', 'theater2', 'athena'], operations: ['DisassembleWorldItems', 'ModifyQuickbar', 'ExecuteTerminalCommand', 'SomeFutureCommand'] }
  const body = { targetItemIdAndQuantityPairs: [{ itemId: 'item', quantity: 3 }] }
  expect(await dispatchPlugin(plugin, 'mcp.request', ['selected', { operation: 'DisassembleWorldItems', profileId: 'theater2', body }])).toMatchObject({ applied: true, cancelled: false })
  expect(mocks.confirm).not.toHaveBeenCalled()
  const config = mocks.transport.mock.calls[0][0]
  expect(config.url).toBe('/profile/selected/client/DisassembleWorldItems')
  expect(config.params).toEqual({ profileId: 'theater2', rvn: -1 })
  expect(JSON.parse(config.data)).toEqual(body)
  // A fresh record has its own spacing; commands still run one at a time per account.
  await dispatchPlugin({ ...plugin }, 'mcp.request', ['selected', { operation: 'SomeFutureCommand', profileId: 'athena', body: { anything: [1, 'two'] } }])
  expect(JSON.parse(mocks.transport.mock.calls[1][0].data)).toEqual({ anything: [1, 'two'] })
  await expect(dispatchPlugin(plugin, 'mcp.request', ['selected', { operation: 'SomeFutureCommand', profileId: 'athena', body: {} }])).rejects.toThrow('rate limited')
  await expect(dispatchPlugin(plugin, 'mcp.request', ['selected', { operation: 'ModifyQuickbar', profileId: 'athena', body: {} }])).rejects.toThrow('profile')
  await expect(dispatchPlugin(plugin, 'mcp.request', ['selected', { operation: 'SomeFutureCommand', profileId: 'athena', body: { blob: 'x'.repeat(70_000) } }])).rejects.toThrow('64 KiB')
})
it('still asks before money or gift commands, even for API v6 packages', async () => {
  plugin.manifest.apiVersion = 6
  plugin.manifest.fortnite = { profiles: ['common_core'], operations: ['GiftCatalogEntry'] }
  mocks.confirm.mockResolvedValue({ response: 0 })
  expect(await dispatchPlugin(plugin, 'mcp.request', ['selected', { operation: 'GiftCatalogEntry', profileId: 'common_core', body: { offerId: 'x' } }])).toMatchObject({ cancelled: true, applied: false })
  expect(mocks.confirm).toHaveBeenCalledOnce()
  expect(mocks.transport).not.toHaveBeenCalled()
})
it('returns Epic error codes without messages', async () => {
  plugin.manifest.apiVersion = 6
  mocks.transport.mockRejectedValue(Object.assign(new Error('token HOST-SECRET'), { response: { status: 400, headers: {}, data: { errorCode: 'errors.com.epicgames.fortnite.invalid_quest', errorMessage: 'PRIVATE@example.com' } } }))
  const failure = await command().catch((error: Error) => error.message)
  expect(failure).toContain('HTTP 400, errors.com.epicgames.fortnite.invalid_quest')
  expect(failure).not.toMatch(/PRIVATE|HOST-SECRET/)
})
it('looks up matchmaking sessions with host-only credentials', async () => {
  plugin.manifest.permissions = ['fortnite:sessions']
  mocks.sessions.mockImplementation(async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: [{ id: 'session', serverAddress: '1.2.3.4', attributes: { GAMEMODE_s: 'FORTPVE' }, access_token: 'SECRET' }] }))
  expect(await dispatchPlugin(plugin, 'matchmaking.findPlayer', ['selected'])).toEqual({ accountId: 'selected', sessions: [{ id: 'session', serverAddress: '1.2.3.4', attributes: { GAMEMODE_s: 'FORTPVE' } }] })
  expect(mocks.sessions.mock.calls[0][0]).toMatchObject({ url: '/findPlayer/selected', maxRedirects: 0 })
  expect(mocks.sessions.mock.calls[0][0].headers.Authorization).toBe('bearer HOST-SECRET')
  plugin.manifest.permissions = []
  await expect(dispatchPlugin(plugin, 'matchmaking.findPlayer', ['selected'])).rejects.toThrow('Permission')
})
