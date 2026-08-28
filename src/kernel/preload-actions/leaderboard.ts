import type { IpcRendererEvent } from 'electron'
import type { LeaderboardPayload } from '../core/leaderboard'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestLeaderboard(metric: string, force = false) {
  ipcRenderer.send(ElectronAPIEventKeys.LeaderboardRequest, metric, force)
}

export function responseLeaderboard(
  callback: (response: LeaderboardPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: LeaderboardPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LeaderboardResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LeaderboardResponse,
        customCallback
      ),
  }
}
