import { app, BrowserWindow } from 'electron'

import { SystemTray } from '../system-tray'
import { RuntimeLog } from '../../runtime-log'

/** How long shutdown steps get before the app quits without them. */
const shutdownStepTimeoutMs = 4_000

/** How long a quit may take in all before the process exits regardless. */
const forceExitAfterMs = 10_000

export class MainWindow {
  private static value: BrowserWindow
  private static closing: Promise<void> | null = null

  static get instance() {
    return MainWindow.value
  }

  static setInstance(value: BrowserWindow) {
    MainWindow.value = value
  }

  static showAndFocus() {
    const window = MainWindow.value

    if (!window || window.isDestroyed()) {
      return
    }

    if (window.isMinimized()) {
      window.restore()
    }

    if (!window.isVisible()) {
      window.show()
    }

    window.focus()
  }

  /**
   * Shutdown steps run side by side, each named so a step that never
   * settles can be reported. None of them may hold the app open: a quit
   * that waited on a stuck step (a scheduled job mid-request, a plugin
   * host, a dev rebuild's missing chunk) used to leave a windowless Penny
   * running, holding the single-instance lock, so the next launch closed
   * itself straight away.
   */
  static async cleanup() {
    if (MainWindow.instance && !MainWindow.instance.isDestroyed()) {
      MainWindow.instance.removeAllListeners()
    }

    const steps: Array<[string, () => Promise<unknown>]> = [
      ['automation', () =>
        import('../automation').then(({ Automation }) => {
          Automation.clearActiveChecks(null)
          Automation.getServices().forEach((accountService) => {
            accountService.destroy()
          })
        })],
      ['schedules', () =>
        import('node-schedule').then(({ default: schedule }) =>
          schedule.gracefulShutdown()
        )],
      ['plugins', () =>
        import('../plugins').then(({ PluginManager }) =>
          PluginManager.shutdown()
        )],
      ['custom process', () =>
        import('../../core/custom-process').then(({ CustomProcess }) =>
          CustomProcess.destroy()
        )],
      ['discord presence', () =>
        import('../../core/discord-presence').then(({ DiscordPresence }) =>
          DiscordPresence.destroy()
        )],
      ['updater', () => import('../updater').then(({ AppUpdater }) => AppUpdater.cancel())],
      ['overlay', () =>
        import('./overlay').then(({ OverlayWindow }) =>
          OverlayWindow.destroy()
        )],
    ]
    const pending = new Set(steps.map(([label]) => label))
    const shutdowns = Promise.allSettled(
      steps.map(async ([label, run]) => {
        try {
          await run()
        } catch (error) {
          RuntimeLog.error(`shutdown:${label}`, error)
        } finally {
          pending.delete(label)
        }
      })
    )
    const settled = await Promise.race([
      shutdowns.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), shutdownStepTimeoutMs)),
    ])

    if (!settled) {
      RuntimeLog.error(
        'shutdown',
        new Error(`still running after ${shutdownStepTimeoutMs}ms, quitting anyway: ${[...pending].join(', ')}`)
      )
    }

    SystemTray.destroy()
  }

  static closeApp() {
    if (process.platform !== 'darwin') {
      MainWindow.closing ??= (async () => {
        // Last resort: if quitting itself stalls (a before-quit hook that
        // never finishes), leave anyway rather than linger without a window.
        setTimeout(() => {
          RuntimeLog.error('shutdown', new Error(`app did not quit within ${forceExitAfterMs}ms; exiting`))
          app.exit(0)
        }, forceExitAfterMs)

        await MainWindow.cleanup()
        app.quit()
      })()
    }

    return MainWindow.closing
  }
}
