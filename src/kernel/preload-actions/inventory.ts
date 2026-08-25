import type { IpcRendererEvent } from 'electron'
import type {
  InventoryPayload,
  InventoryRecycleNotification,
} from '../core/inventory'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestInventory(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.InventoryRequest, accounts)
}

/** `selection` maps an account id to the item GUIDs to recycle. */
export function recycleInventoryItems(
  accounts: Array<AccountData>,
  selection: Record<string, Array<string>>
) {
  ipcRenderer.send(
    ElectronAPIEventKeys.InventoryRecycle,
    accounts,
    selection
  )
}

export function responseInventory(
  callback: (response: InventoryPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: InventoryPayload
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.InventoryResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.InventoryResponse,
        customCallback
      ),
  }
}

export function notificationInventoryRecycle(
  callback: (response: InventoryRecycleNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: InventoryRecycleNotification
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.InventoryRecycleNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.InventoryRecycleNotification,
        customCallback
      ),
  }
}
