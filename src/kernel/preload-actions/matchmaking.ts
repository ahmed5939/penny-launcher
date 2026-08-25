import type { IpcRendererEvent } from 'electron'
import type { MatchmakingTrackStatus } from '../../types/data/advanced-mode/matchmaking'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestMatchmakingStatus(
  account: AccountData,
  accountId: string
) {
  ipcRenderer.send(
    ElectronAPIEventKeys.MatchmakingTrackStatus,
    account,
    accountId
  )
}

export function notificationMatchmakingStatus(
  callback: (value: MatchmakingTrackStatus) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: MatchmakingTrackStatus
  ) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.MatchmakingTrackStatusNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.MatchmakingTrackStatusNotification,
        customCallback
      ),
  }
}
