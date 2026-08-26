import type { IpcRendererEvent } from 'electron'
import type { ServerStatusPayload } from '../core/server-status'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestServerStatus() {
  ipcRenderer.send(ElectronAPIEventKeys.ServerStatusRequest)
}

export function responseServerStatus(
  callback: (response: ServerStatusPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ServerStatusPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ServerStatusResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ServerStatusResponse,
        customCallback
      ),
  }
}
