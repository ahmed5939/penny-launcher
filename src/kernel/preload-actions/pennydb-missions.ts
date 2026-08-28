import type { IpcRendererEvent } from 'electron'
import type { PennyDBMissionsPayload } from '../core/pennydb-missions'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestPennyDBMissions() {
  ipcRenderer.send(ElectronAPIEventKeys.HomePennyDBMissionsRequest)
}

export function responsePennyDBMissions(
  callback: (response: PennyDBMissionsPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: PennyDBMissionsPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.HomePennyDBMissionsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.HomePennyDBMissionsResponse,
        customCallback
      ),
  }
}
