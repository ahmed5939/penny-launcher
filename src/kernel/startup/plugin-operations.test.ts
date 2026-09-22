import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ inventory: vi.fn(), token: vi.fn(), recycle: vi.fn(), confirm: vi.fn(), execute: vi.fn() }))
vi.mock('node:child_process', () => ({ execFile: mocks.execute }))
vi.mock('electron', () => ({ dialog: { showMessageBox: mocks.confirm } }))
vi.mock('./windows/main', () => ({ MainWindow: { instance: { isDestroyed: () => false } } }))
vi.mock('./accounts', () => ({ AccountsManager: { getAccountById: (id: string) => id === 'selected' ? { accountId: id, displayName: 'Name' } : null } }))
vi.mock('./plugin-broker', () => ({
  requirePluginPermission: (manifest: { permissions: string[] }, method: string) => {
    const required = { 'inventory.read': 'inventory:read', 'inventory.recycle': 'inventory:recycle', 'epicLauncher.close': 'epic-launcher:close' }[method]
    if (required && !manifest.permissions.includes(required)) throw new Error('Permission required')
  }, pluginLog: vi.fn(),
}))
vi.mock('../core/inventory', () => ({ Inventory: { getInventory: mocks.inventory } }))
vi.mock('../core/authentication', () => ({ Authentication: { verifyAccessToken: mocks.token } }))
vi.mock('../../services/endpoints/mcp', () => ({ setRecycleItemBatch: mocks.recycle }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
import { PluginBridge } from './plugin-api'
import { dispatchPluginOperation } from './plugin-operations'
import type { PluginRuntimeRecord } from './plugin-broker'

let plugin: PluginRuntimeRecord
const item = { itemId: 'item', templateId: 'Hero:test', name: 'Hero', rarity: 'rare', level: 1, quantity: 1, lockedReason: null }
const call = (method = 'inventory.recycle', args: unknown[] = ['selected', ['item']]) => dispatchPluginOperation(plugin, method, args)
beforeEach(() => {
  vi.resetAllMocks()
  plugin = { manifest: { id: 'sample', name: 'Sample', permissions: ['inventory:read', 'inventory:recycle', 'epic-launcher:close'] }, host: {} } as PluginRuntimeRecord
  PluginBridge.setAccountScope({ primary: 'selected', members: [] })
  mocks.inventory.mockImplementation(async () => ({ accountId: 'selected', items: [{ ...item }] }))
  mocks.token.mockResolvedValue('host-only-token')
  mocks.confirm.mockResolvedValue({ response: 1 })
  mocks.recycle.mockResolvedValue({})
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('rejects denied permissions and out-of-scope accounts before reading', async () => {
  await expect(call('inventory.read', ['other'])).rejects.toThrow('scope')
  plugin.manifest.permissions = []
  await expect(call()).rejects.toThrow('Permission')
  expect(mocks.inventory).not.toHaveBeenCalled()
})
it.each([[], ['item', 'item'], Array.from({ length: 51 }, (_, i) => String(i)), [''], [5]])('rejects invalid selections: %j', async (...values) => {
  // Each table row is itself the selection.
  await expect(call('inventory.recycle', ['selected', values])).rejects.toThrow()
  expect(mocks.inventory).not.toHaveBeenCalled()
})
it('rate limits inventory reads and returns only the inventory DTO', async () => {
  expect(await call('inventory.read', ['selected'])).toEqual({ accountId: 'selected', items: [item] })
  await expect(call('inventory.read', ['selected'])).rejects.toThrow('rate limited')
  expect(mocks.inventory).toHaveBeenCalledTimes(1)
})
it('discards results after a scope round trip or runtime replacement', async () => {
  mocks.inventory.mockImplementationOnce(async () => {
    PluginBridge.setAccountScope({ primary: 'other', members: [] })
    PluginBridge.setAccountScope({ primary: 'selected', members: [] })
    return { items: [item] }
  })
  await expect(call('inventory.read', ['selected'])).rejects.toThrow('scope')
  mocks.inventory.mockImplementationOnce(async () => { plugin.host = {} as PluginRuntimeRecord['host']; return { items: [item] } })
  await expect(call()).rejects.toThrow('restarted')
  expect(mocks.recycle).not.toHaveBeenCalled()
})
it('shows host-derived item details, defaults to cancel, and sends only the approved ids', async () => {
  expect(await call()).toEqual({ accountId: 'selected', recycled: 1, skipped: 0, cancelled: false })
  expect(mocks.confirm.mock.calls[0][1]).toMatchObject({ defaultId: 0, cancelId: 0, detail: expect.stringContaining('Hero:test') })
  expect(mocks.inventory).toHaveBeenCalledTimes(2)
  expect(mocks.recycle).toHaveBeenCalledWith({ accessToken: 'host-only-token', accountId: 'selected', targetItemIds: ['item'] })
  await expect(call()).rejects.toThrow('rate limited')
})
it('does not authenticate or write when the user cancels', async () => {
  mocks.confirm.mockResolvedValue({ response: 0 })
  expect(await call()).toMatchObject({ cancelled: true, recycled: 0 })
  expect(mocks.token).not.toHaveBeenCalled()
  expect(mocks.recycle).not.toHaveBeenCalled()
})
it.each(['favorite', 'in-use'])('protects %s items and unknown ids before confirmation', async (lockedReason) => {
  mocks.inventory.mockResolvedValue({ items: [{ ...item, lockedReason }] })
  expect(await call('inventory.recycle', ['selected', ['item', 'missing']])).toMatchObject({ skipped: 2, recycled: 0 })
  expect(mocks.confirm).not.toHaveBeenCalled()
  expect(mocks.recycle).not.toHaveBeenCalled()
})
it.each([{ lockedReason: 'favorite' }, { level: 2 }, { templateId: 'Hero:changed' }])('skips items changed during review: %j', async (changes) => {
  mocks.inventory.mockResolvedValueOnce({ items: [item] }).mockResolvedValueOnce({ items: [{ ...item, ...changes }] })
  expect(await call()).toMatchObject({ skipped: 1, recycled: 0 })
  expect(mocks.recycle).not.toHaveBeenCalled()
})
it('refuses writes if the plugin stops during review', async () => {
  mocks.confirm.mockImplementation(async () => { plugin.host = null; return { response: 1 } })
  await expect(call()).rejects.toThrow('stopped')
  expect(mocks.recycle).not.toHaveBeenCalled()
})
it('refuses writes if permission is removed during review', async () => {
  mocks.confirm.mockImplementation(async () => { plugin.manifest.permissions = []; return { response: 1 } })
  await expect(call()).rejects.toThrow('Permission')
  expect(mocks.recycle).not.toHaveBeenCalled()
})
it('expires an unanswered confirmation without writing', async () => {
  vi.useFakeTimers()
  mocks.confirm.mockImplementation((_window, options) => new Promise((resolve) => {
    options.signal.addEventListener('abort', () => resolve({ response: 0 }), { once: true })
  }))
  const pending = call()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(await pending).toMatchObject({ cancelled: true, recycled: 0 })
  expect(mocks.recycle).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
it('refuses writes if the scope changes while authenticating', async () => {
  mocks.token.mockImplementation(async () => { PluginBridge.setAccountScope({ primary: null, members: [] }); return 'token' })
  await expect(call()).rejects.toThrow('scope')
  expect(mocks.recycle).not.toHaveBeenCalled()
})
it('serializes recycling globally, including across plugins', async () => {
  let finish!: (value: { response: number }) => void
  mocks.confirm.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const pending = call()
  await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
  const other = { ...plugin, manifest: { ...plugin.manifest, id: 'other' } }
  await expect(dispatchPluginOperation(other, 'inventory.recycle', ['selected', ['item']])).rejects.toThrow('pending')
  finish({ response: 0 })
  await pending
})
it('uses only a fixed Windows executable and target, and rejects arbitrary arguments', async () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  mocks.execute.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''))
  await expect(call('epicLauncher.close', ['arbitrary.exe'])).rejects.toThrow()
  expect(await call('epicLauncher.close', [])).toEqual({ closed: true })
  expect(mocks.execute).toHaveBeenCalledWith(expect.stringMatching(/\\System32\\taskkill\.exe$/),
    ['/IM', 'EpicGamesLauncher.exe', '/F'], expect.objectContaining({ timeout: 5000 }), expect.any(Function))
  await expect(call('epicLauncher.close', [])).rejects.toThrow('rate limited')
})
it('rejects process control on unsupported platforms', async () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
  await expect(call('epicLauncher.close', [])).rejects.toThrow('Windows only')
  expect(mocks.execute).not.toHaveBeenCalled()
})
