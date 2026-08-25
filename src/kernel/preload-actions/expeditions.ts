import type { IpcRendererEvent } from 'electron'
import type {
  ExpeditionsCollectNotification,
  ExpeditionsPayload,
} from '../core/expeditions'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestExpeditions(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.ExpeditionsRequest, accounts)
}

export function collectExpeditions(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.ExpeditionsCollect, accounts)
}

export function responseExpeditions(
  callback: (response: ExpeditionsPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ExpeditionsPayload
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ExpeditionsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ExpeditionsResponse,
        customCallback
      ),
  }
}

export function notificationExpeditionsCollect(
  callback: (response: ExpeditionsCollectNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ExpeditionsCollectNotification
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ExpeditionsCollectNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ExpeditionsCollectNotification,
        customCallback
      ),
  }
}
