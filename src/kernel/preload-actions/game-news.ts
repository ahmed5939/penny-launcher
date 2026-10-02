import type { IpcRendererEvent } from 'electron'
import type { GameNewsPayload } from '../core/game-news'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestGameNews() {
  ipcRenderer.send(ElectronAPIEventKeys.GameNewsRequest)
}

export function responseGameNews(
  callback: (response: GameNewsPayload) => Promise<void>,
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: GameNewsPayload,
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.GameNewsResponse,
    customCallback,
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.GameNewsResponse,
        customCallback,
      ),
  }
}
