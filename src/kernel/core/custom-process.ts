import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { DiscordPresence } from './discord-presence'
import { MainWindow } from '../startup/windows/main'
import { ProcessWatcher } from '../process-watcher'

export class CustomProcess {
  private static id: number | null = null
  private static name: string | null = null
  private static isRunning = false

  static init() {
    if (!CustomProcess.name) {
      return
    }

    ProcessWatcher.on('custom-process', (list) => {
      const filtered = list.find(
        (item) =>
          item.name.toLowerCase() === CustomProcess.name?.toLowerCase()
      )
      const isRunning = filtered !== undefined

      if (filtered?.id !== undefined) {
        CustomProcess.id = filtered.id
      }

      CustomProcess.isRunning = isRunning
      DiscordPresence.setGameRunning(isRunning)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.CustomProcessStatus,
        CustomProcess.isRunning
      )
    })
  }

  static async kill() {
    if (typeof CustomProcess.id !== 'number') {
      return
    }

    await ProcessWatcher.killProcess(CustomProcess.id, true)
  }

  static setName(value: string, restart?: boolean) {
    if (value === CustomProcess.name) {
      return
    }

    CustomProcess.name = value

    if (restart) {
      CustomProcess.destroy()
      CustomProcess.init()
    }
  }

  static destroy() {
    CustomProcess.id = null
    CustomProcess.name = null
    CustomProcess.isRunning = false
    ProcessWatcher.close('custom-process')
  }
}
