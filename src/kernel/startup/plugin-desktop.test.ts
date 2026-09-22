import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ displays: vi.fn(), battery: vi.fn() }))
vi.mock('electron', () => ({
  screen: { getAllDisplays: mocks.displays, getPrimaryDisplay: () => ({ id: 42 }) },
  powerMonitor: { isOnBatteryPower: mocks.battery },
}))
vi.mock('./accounts', () => ({ AccountsManager: {} }))
vi.mock('./settings', () => ({ SettingsManager: {} }))
vi.mock('./windows/main', () => ({ MainWindow: {} }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
import { dispatchPlugin, type PluginRuntimeRecord } from './plugin-broker'
import { dispatchDesktopOperation } from './plugin-desktop'

let plugin: PluginRuntimeRecord
beforeEach(() => {
  vi.clearAllMocks()
  plugin = { manifest: { id: 'test', name: 'Test', permissions: ['system:read', 'displays:read', 'power:read'] }, host: {} } as PluginRuntimeRecord
  mocks.battery.mockReturnValue(true)
  mocks.displays.mockReturnValue([{ id: 42, label: 'Private monitor identifier', internal: true,
    size: { width: 1920, height: 1080 }, workAreaSize: { width: 1920, height: 1040 }, scaleFactor: 1.5 }])
})
it.each(['desktop.system', 'desktop.displays', 'desktop.power'])('requires the dedicated permission for %s', async (method) => {
  plugin.manifest.permissions = ['ui', 'settings:read']
  await expect(dispatchPlugin(plugin, method, [])).rejects.toThrow('Permission required')
  expect(mocks.displays).not.toHaveBeenCalled()
  expect(mocks.battery).not.toHaveBeenCalled()
})
it('returns only the documented system fields', async () => {
  const result = await dispatchPlugin(plugin, 'desktop.system', [])
  expect(Object.keys(result as object).sort()).toEqual([
    'architecture', 'availableMemoryBytes', 'platform', 'release', 'totalMemoryBytes', 'uptimeSeconds',
  ])
  expect(result).toMatchObject({ platform: process.platform, totalMemoryBytes: expect.any(Number) })
})
it('projects display geometry without exposing native objects or identifiers', async () => {
  expect(await dispatchPlugin(plugin, 'desktop.displays', [])).toEqual([{
    index: 0, primary: true, width: 1920, height: 1080,
    workAreaWidth: 1920, workAreaHeight: 1040, scaleFactor: 1.5,
  }])
})
it('bounds the number of displays returned', async () => {
  const display = mocks.displays()[0]
  mocks.displays.mockReturnValue(Array.from({ length: 100 }, () => display))
  expect(await dispatchPlugin(plugin, 'desktop.displays', [])).toHaveLength(16)
})
it('returns battery status and independently throttles each operation', async () => {
  expect(await dispatchPlugin(plugin, 'desktop.power', [])).toEqual({ onBattery: true })
  await expect(dispatchPlugin(plugin, 'desktop.power', [])).rejects.toThrow('one second')
  await expect(dispatchPlugin(plugin, 'desktop.system', [])).resolves.toBeDefined()
  expect(mocks.battery).toHaveBeenCalledTimes(1)
})
it.each(['desktop.system', 'desktop.displays', 'desktop.power'])('rejects extra arguments for %s', async (method) => {
  await expect(dispatchPlugin(plugin, method, ['C:\\private'])).rejects.toThrow()
  expect(mocks.displays).not.toHaveBeenCalled()
  expect(mocks.battery).not.toHaveBeenCalled()
})
it('rejects requests after stop, including a stop during module loading', async () => {
  const pending = dispatchPlugin(plugin, 'desktop.power', [])
  plugin.host = null
  await expect(pending).rejects.toThrow('stopped')
  expect(() => dispatchDesktopOperation(plugin, 'desktop.power', [])).toThrow('stopped')
  expect(mocks.battery).not.toHaveBeenCalled()
})
it('does not expose adjacent privileged operations', async () => {
  for (const method of ['desktop.exec', 'desktop.registry', 'desktop.screenshot', 'desktop.clipboard']) {
    await expect(dispatchPlugin(plugin, method, [])).rejects.toThrow('Unknown')
    expect(() => dispatchDesktopOperation(plugin, method, [])).toThrow('Unknown')
  }
})
