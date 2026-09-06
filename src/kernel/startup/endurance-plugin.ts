import { PluginManager } from './plugins'

/** Native desktop control stays in the host, owned by the add-on lifecycle. */
export async function getEndurancePlugin() {
  await PluginManager.load()
  const requireRunning = () => {
    if (!PluginManager.isRunning('endurance')) {
      throw new Error('Install and enable Endurance in Add-ons first.')
    }
  }
  requireRunning()
  const feature = await import('../core/endurance')
  // The plugin may have stopped while the native feature was loading.
  requireRunning()
  PluginManager.registerHostCleanup('endurance', () => {
    feature.EnduranceAutomation.stop()
    feature.EnduranceAutomation.cancelCalibration()
  })
  return feature
}
