import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  running: false,
  imported: false,
  stop: vi.fn(),
  cancelCalibration: vi.fn(),
  registerHostCleanup: vi.fn(),
}))
vi.mock('./plugins', () => ({ PluginManager: {
  load: async () => {},
  isRunning: () => mock.running,
  registerHostCleanup: mock.registerHostCleanup,
} }))
vi.mock('../core/endurance', () => {
  mock.imported = true
  return { EnduranceAutomation: { stop: mock.stop, cancelCalibration: mock.cancelCalibration } }
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mock.running = false
  mock.imported = false
})

describe('Endurance add-on access', () => {
  it('does not load native automation without a running add-on', async () => {
    const { getEndurancePlugin } = await import('./endurance-plugin')
    await expect(getEndurancePlugin()).rejects.toThrow('Install and enable Endurance')
    expect(mock.imported).toBe(false)
  })

  it('ties automation and calibration cleanup to the add-on lifecycle', async () => {
    mock.running = true
    const { getEndurancePlugin } = await import('./endurance-plugin')
    await getEndurancePlugin()
    expect(mock.registerHostCleanup).toHaveBeenCalledWith('endurance', expect.any(Function))
    mock.registerHostCleanup.mock.calls[0][1]()
    expect(mock.stop).toHaveBeenCalledOnce()
    expect(mock.cancelCalibration).toHaveBeenCalledOnce()
    mock.running = false
    await expect(getEndurancePlugin()).rejects.toThrow('Install and enable Endurance')
  })
})
