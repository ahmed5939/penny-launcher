import type {
  GameFolderPickResult,
  GameInstallOpenTarget,
  GameInstallStatus,
  GameUpdaterResult,
} from '../../types/game-install'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function getGameInstallStatus(
  forceLatest = false
): Promise<GameInstallStatus> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.GameInstallStatus,
    forceLatest
  )
}

export function detectGameInstall(): Promise<{
  appVersion: string
  name: string
  path: string
}> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.GameInstallDetect)
}

export function chooseGameFolder(): Promise<GameFolderPickResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.GameInstallChooseFolder)
}

export function openGameOfficialApp(
  target: GameInstallOpenTarget
): Promise<GameUpdaterResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.GameInstallOpenOfficial, target)
}
