import { powerMonitor } from 'electron'

import { RuntimeLog } from '../runtime-log'

export class PowerLifecycle {
  private static started = false

  static start() {
    if (PowerLifecycle.started) {
      return
    }

    PowerLifecycle.started = true
    powerMonitor.on('suspend', () => {
      void import('../core/discord-presence')
        .then(({ DiscordPresence }) => {
          DiscordPresence.destroy()
        })
        .catch((error) => RuntimeLog.error('power:suspend', error))
      RuntimeLog.info('power', 'suspend')
    })

    powerMonitor.on('resume', () => {
      // Reconnect only the disposable OS integration. Scheduled jobs use
      // absolute cron rules and naturally recover on their next occurrence.
      void Promise.all([
        import('../core/discord-presence'),
        import('./settings'),
      ])
        .then(async ([{ DiscordPresence }, { SettingsManager }]) => {
          const settings = await SettingsManager.getData()
          DiscordPresence.init(settings.discordRichPresence !== false)
        })
        .catch((error) => RuntimeLog.error('power:resume', error))
      RuntimeLog.info('power', 'resume')
    })
  }
}
