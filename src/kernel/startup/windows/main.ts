import { app, BrowserWindow } from 'electron'

import { SystemTray } from '../system-tray'
import { RuntimeLog } from '../../runtime-log'

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

  static async cleanup() {
    if (MainWindow.instance && !MainWindow.instance.isDestroyed()) {
      MainWindow.instance.removeAllListeners()
    }

    const shutdowns = await Promise.allSettled([
      import('../automation').then(({ Automation }) => {
        Automation.clearActiveChecks(null)
        Automation.getServices().forEach((accountService) => {
          accountService.destroy()
        })
      }),
      import('node-schedule').then(({ default: schedule }) =>
        schedule.gracefulShutdown()
      ),
      import('../plugins').then(({ PluginManager }) =>
        PluginManager.shutdown()
      ),
      import('../../core/custom-process').then(({ CustomProcess }) =>
        CustomProcess.destroy()
      ),
      import('../../core/discord-presence').then(({ DiscordPresence }) =>
        DiscordPresence.destroy()
      ),
      import('../updater').then(({ AppUpdater }) => AppUpdater.cancel()),
      import('./overlay').then(({ OverlayWindow }) =>
        OverlayWindow.destroy()
      ),
    ])

    shutdowns.forEach((result) => {
      if (result.status === 'rejected') {
        RuntimeLog.error('shutdown', result.reason)
      }
    })

    SystemTray.destroy()
  }

  static closeApp() {
    if (process.platform !== 'darwin') {
      MainWindow.closing ??= (async () => {
        await MainWindow.cleanup()
        app.quit()
      })()
    }

    return MainWindow.closing
  }
}
