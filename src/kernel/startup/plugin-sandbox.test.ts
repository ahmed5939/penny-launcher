import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ handler: null as unknown as (...args: unknown[]) => Promise<unknown>, windows: [] as FakeWindow[], ready: true, noSandbox: false, loaded: false }))
class FakeWindow extends EventEmitter {
  destroyed = false
  options: { webPreferences: Record<string, unknown> }
  webContents = Object.assign(new EventEmitter(), {
    id: state.windows.length + 1, mainFrame: {},
    session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(), webRequest: { onBeforeRequest: vi.fn() }, on: vi.fn() },
    setWindowOpenHandler: vi.fn(), send: vi.fn(),
  })
  constructor(options: FakeWindow['options']) { super(); this.options = options; state.windows.push(this) }
  isDestroyed() { return this.destroyed }
  destroy() { this.destroyed = true; this.emit('closed') }
  async loadURL(url: string) {
    state.loaded = true
    expect(Buffer.from(url.split(',')[1], 'base64').toString()).toContain("connect-src 'none'")
    if (state.ready) await state.handler({ sender: this.webContents, senderFrame: this.webContents.mainFrame }, 'ready', [true])
  }
}
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => process.cwd(), commandLine: { hasSwitch: () => state.noSandbox } },
  BrowserWindow: function(options: FakeWindow['options']) { return new FakeWindow(options) },
  ipcMain: { handle: (_channel: string, handler: typeof state.handler) => { state.handler = handler } },
}))
import { PluginSandbox } from './plugin-sandbox'
let host: PluginSandbox | undefined
beforeEach(() => { state.ready = true; state.noSandbox = false; state.loaded = false })
afterEach(() => { host?.destroy(); host = undefined; vi.useRealTimers() })
it('uses a sandbox, separate session, no Node and blocks other senders/subframes', async () => {
  const dispatch = vi.fn()
  host = new PluginSandbox(dispatch, vi.fn())
  await host.start('module.exports = {}')
  const win = state.windows.at(-1)!
  expect(win.options.webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false })
  expect(win.options.webPreferences.partition).toMatch(/^penny-plugin-/)
  const request = win.webContents.session.setPermissionRequestHandler.mock.calls[0][0]
  const callback = vi.fn()
  request(null, 'camera', callback)
  expect(callback).toHaveBeenCalledWith(false)
  const filter = win.webContents.session.webRequest.onBeforeRequest.mock.calls[0][0]
  filter({ url: 'https://example.com' }, callback)
  expect(callback).toHaveBeenCalledWith({ cancel: true })
  await expect(state.handler({ sender: { id: -1 }, senderFrame: {} }, 'storage.get', [])).rejects.toThrow('Invalid')
  await expect(state.handler({ sender: win.webContents, senderFrame: {} }, 'storage.get', [])).rejects.toThrow('Invalid')
  expect(dispatch).not.toHaveBeenCalled()
})
it('terminates a hung action without waiting on plugin code', async () => {
  vi.useFakeTimers()
  const failure = vi.fn()
  host = new PluginSandbox(vi.fn(), failure)
  await host.start('module.exports = {}')
  const result = host.command('action', 'loop', 100)
  const check = expect(result).rejects.toThrow('stopped')
  await vi.advanceTimersByTimeAsync(100)
  await check
  expect(state.windows.at(-1)!.destroyed).toBe(true)
  expect(failure).toHaveBeenCalledWith('Plugin action timed out.')
})
it('times out activation and refuses operation with sandbox disabled', async () => {
  vi.useFakeTimers()
  state.ready = false
  host = new PluginSandbox(vi.fn(), vi.fn())
  const result = host.start('while(true) {}')
  const check = expect(result).rejects.toThrow('activation timed out')
  // start first reads the trusted bootstrap from disk.
  await vi.waitFor(() => expect(state.loaded).toBe(true))
  await vi.advanceTimersByTimeAsync(10_000)
  await check
  state.noSandbox = true
  expect(() => new PluginSandbox(vi.fn(), vi.fn())).toThrow('without --no-sandbox')
})
