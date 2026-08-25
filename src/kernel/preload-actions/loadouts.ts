import type { IpcRendererEvent } from 'electron'
import type {
  LoadoutEditNotification,
  LoadoutEditRequest,
  LoadoutsPayload,
} from '../core/loadouts'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestLoadouts(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.LoadoutsRequest, account)
}

export function editLoadout(
  account: AccountData,
  request: LoadoutEditRequest
) {
  ipcRenderer.send(ElectronAPIEventKeys.LoadoutEdit, account, request)
}

export function notificationLoadoutEdit(
  callback: (response: LoadoutEditNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: LoadoutEditNotification
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LoadoutEditNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LoadoutEditNotification,
        customCallback
      ),
  }
}

export function responseLoadouts(
  callback: (response: LoadoutsPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: LoadoutsPayload
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LoadoutsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LoadoutsResponse,
        customCallback
      ),
  }
}
