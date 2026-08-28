import { app, BrowserWindow } from 'electron'
import schedule from 'node-schedule'

import { CustomProcess } from '../../core/custom-process'
import { DiscordPresence } from '../../core/discord-presence'
import { Automation } from '../automation'
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

    Automation.clearActiveChecks(null)
    Automation.getServices().forEach((accountService) => {
      accountService.destroy()
    })
    const shutdowns = await Promise.allSettled([
      schedule.gracefulShutdown(),
      import('../plugins').then(({ PluginManager }) =>
        PluginManager.shutdown()
      ),
    ])

    shutdowns.forEach((result) => {
      if (result.status === 'rejected') {
        RuntimeLog.error('shutdown', result.reason)
      }
    })

    CustomProcess.destroy()
    DiscordPresence.destroy()
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
