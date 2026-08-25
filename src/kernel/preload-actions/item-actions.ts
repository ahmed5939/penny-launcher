import type { IpcRendererEvent } from 'electron'
import type {
  ItemActionNotification,
  ItemActionRequest,
} from '../core/item-actions'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Spends materials — only call behind an explicit confirmation. */
export function performItemAction(
  account: AccountData,
  request: ItemActionRequest
) {
  ipcRenderer.send(ElectronAPIEventKeys.ItemAction, account, request)
}

export function notificationItemAction(
  callback: (response: ItemActionNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ItemActionNotification
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ItemActionNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ItemActionNotification,
        customCallback
      ),
  }
}
