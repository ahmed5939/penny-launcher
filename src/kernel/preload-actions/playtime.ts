import type { IpcRendererEvent } from 'electron'
import type {
  AccountPlaytimePayload,
  GameAchievementsResult,
} from '../core/playtime'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Time played for every linked account. `refresh` skips the cache. */
export function requestAccountPlaytime(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.AccountPlaytimeRequest, refresh)
}

export function responseAccountPlaytime(
  callback: (response: AccountPlaytimePayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: AccountPlaytimePayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AccountPlaytimeResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AccountPlaytimeResponse,
        customCallback
      ),
  }
}

/** One game's Epic achievements for one linked account, by account id. */
export function requestGameAchievements(
  accountId: string,
  sandboxId: string
): Promise<GameAchievementsResult> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.AccountAchievementsRequest,
    accountId,
    sandboxId
  )
}
