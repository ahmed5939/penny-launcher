import type { IpcRendererEvent } from 'electron'
import type { RewindFactsPayload } from '../core/rewind-facts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Penny Rewind's game-profile facts for every linked account. `refresh` skips the cache. */
export function requestRewindFacts(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.RewindFactsRequest, refresh)
}

export function responseRewindFacts(callback: (response: RewindFactsPayload) => Promise<void>) {
  const customCallback = (_: IpcRendererEvent, response: RewindFactsPayload) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(ElectronAPIEventKeys.RewindFactsResponse, customCallback)

  return {
    removeListener: () =>
      rendererInstance.removeListener(ElectronAPIEventKeys.RewindFactsResponse, customCallback),
  }
}
