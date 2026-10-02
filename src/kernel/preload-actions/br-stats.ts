import type { IpcRendererEvent } from 'electron'
import type { BrStatsPayload } from '../core/br-stats'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Battle Royale career stats for every linked account. `refresh` skips the cache. */
export function requestAccountBrStats(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.AccountBrStatsRequest, refresh)
}

export function responseAccountBrStats(
  callback: (response: BrStatsPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: BrStatsPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AccountBrStatsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AccountBrStatsResponse,
        customCallback
      ),
  }
}
