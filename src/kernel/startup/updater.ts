import { app } from 'electron'

import { RuntimeLog } from '../runtime-log'

export class AppUpdater {
  private static timer: NodeJS.Timeout | null = null

  static schedule() {
    if (
      AppUpdater.timer ||
      !app.isPackaged ||
      !['darwin', 'win32'].includes(process.platform)
    ) {
      return
    }

    // Update setup performs an immediate network request. Keep it away from
    // navigation, account hydration, and the first useful frame.
    AppUpdater.timer = setTimeout(() => {
      AppUpdater.timer = null
      void import('update-electron-app')
        .then(({ UpdateSourceType, updateElectronApp }) => {
          const log = (level: string) => (message: string) =>
            RuntimeLog.info(`updater:${level}`, message)

          updateElectronApp({
            updateSource: {
              type: UpdateSourceType.ElectronPublicUpdateService,
              repo: 'ahmed5939/penny-launcher',
            },
            updateInterval: '1 hour',
            notifyUser: true,
            logger: {
              error: (message: string) =>
                RuntimeLog.error('updater', message),
              info: log('info'),
              log: log('log'),
              warn: log('warn'),
            },
          })
        })
        .catch((error) => RuntimeLog.error('updater:setup', error))
    }, 10_000)
  }

  static cancel() {
    if (AppUpdater.timer) {
      clearTimeout(AppUpdater.timer)
      AppUpdater.timer = null
    }
  }
}
