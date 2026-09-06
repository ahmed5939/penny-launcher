import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultOverlaySettings } from '../../../config/constants/overlay'

const mock = vi.hoisted(() => ({
  register: vi.fn(() => true), unregister: vi.fn(),
  load: vi.fn<() => Promise<void>>(), windows: [] as Array<MockWindow>,
}))
class MockWindow {
  destroyed = false
  visible = false
  closed = () => {}
  webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn(), setZoomFactor: vi.fn(), send: vi.fn() }
  constructor() { mock.windows.push(this) }
  setOpacity() {}
  setIgnoreMouseEvents() {}
  setAlwaysOnTop() {}
  setContentProtection() {}
  setBounds() {}
  on(event: string, listener: () => void) { if (event === 'closed') this.closed = listener }
  loadFile() { return mock.load() }
  isDestroyed() { return this.destroyed }
  isVisible() { return this.visible }
  showInactive() { this.visible = true }
  destroy() { this.destroyed = true; this.visible = false; this.closed() }
}
vi.mock('electron', () => ({
  BrowserWindow: class { constructor() { return new MockWindow() } },
  globalShortcut: { register: mock.register, unregister: mock.unregister },
  screen: { getCursorScreenPoint: () => ({}), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
}))
vi.mock('../../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
vi.mock('../../../services/endpoints/pennydb', () => ({ getPennyDBProfile: vi.fn() }))
vi.mock('../accounts', () => ({ AccountsManager: { getAccounts: () => new Map() } }))

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); mock.windows.length = 0
  mock.load.mockResolvedValue()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window')
  vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', '')
})
afterEach(async () => {
  const { OverlayWindow } = await import('./overlay')
  OverlayWindow.destroy()
  await vi.dynamicImportSettled()
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})

it('allocates no window until requested and releases it on toggle off', async () => {
  const { OverlayWindow } = await import('./overlay')
  await OverlayWindow.configure(defaultOverlaySettings)
  expect(mock.register).toHaveBeenCalledTimes(1)
  expect(mock.windows).toHaveLength(0)
  await OverlayWindow.toggle()
  expect(mock.windows[0].visible).toBe(true)
  await OverlayWindow.toggle()
  expect(mock.windows[0].destroyed).toBe(true)
  expect(mock.unregister).not.toHaveBeenCalled()
  await OverlayWindow.toggle()
  expect(mock.windows).toHaveLength(2)
  expect(mock.windows[1].visible).toBe(true)
})

it('does not open when disabled, including disabling during a pending load', async () => {
  const { OverlayWindow } = await import('./overlay')
  await OverlayWindow.configure({ ...defaultOverlaySettings, enabled: false })
  await OverlayWindow.toggle()
  expect(mock.windows).toHaveLength(0)
  await OverlayWindow.configure(defaultOverlaySettings)
  let finish!: () => void
  mock.load.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const opening = OverlayWindow.toggle()
  await OverlayWindow.toggle()
  expect(mock.windows).toHaveLength(1)
  await OverlayWindow.configure({ ...defaultOverlaySettings, enabled: false })
  finish()
  await opening
  expect(mock.windows[0].destroyed).toBe(true)
  expect(mock.windows[0].visible).toBe(false)
})

it('keeps the shortcut available after a load failure so opening can be retried', async () => {
  const { OverlayWindow } = await import('./overlay')
  await OverlayWindow.configure(defaultOverlaySettings)
  mock.load.mockRejectedValueOnce(new Error('load failed'))
  await OverlayWindow.toggle()
  expect(mock.windows[0].destroyed).toBe(true)
  expect(mock.unregister).not.toHaveBeenCalled()
  await OverlayWindow.toggle()
  expect(mock.windows[1].visible).toBe(true)
})
