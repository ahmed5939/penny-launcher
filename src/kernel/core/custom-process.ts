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

    let first = true
    ProcessWatcher.on('custom-process', (list) => {
      const filtered = list.find(
        (item) =>
          item.name.toLowerCase() === CustomProcess.name?.toLowerCase()
      )
      const isRunning = filtered !== undefined

      CustomProcess.id = filtered?.id ?? null
      ProcessWatcher.setInterval('custom-process', isRunning ? 2_000 : 10_000)
      if (!first && CustomProcess.isRunning === isRunning) return
      first = false

      CustomProcess.isRunning = isRunning
      DiscordPresence.setGameRunning(isRunning)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.CustomProcessStatus,
        CustomProcess.isRunning
      )
    }, 10_000)
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

    if (restart) CustomProcess.destroy()
    CustomProcess.name = value

    if (restart) {
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
