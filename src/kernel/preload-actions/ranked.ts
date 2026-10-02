import type { IpcRendererEvent } from 'electron'
import type { AccountRankedPayload } from '../core/ranked'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Competitive rank for every linked account. `refresh` skips the cache. */
export function requestAccountRanked(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.AccountRankedRequest, refresh)
}

export function responseAccountRanked(
  callback: (response: AccountRankedPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: AccountRankedPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AccountRankedResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AccountRankedResponse,
        customCallback
      ),
  }
}
