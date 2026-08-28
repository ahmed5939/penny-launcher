import type { IpcRendererEvent } from 'electron'
import type {
  LockerCardFilters,
  LockerCardNotification,
  LockerCardProgress,
  LockerEquipNotification,
  LockerOwnedPayload,
  LockerPayload,
} from '../core/locker'
import type { LockerSlotKey } from '../../config/fortnite/locker'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestLocker(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.LockerRequest, account)
}

/** `refresh` skips the main process's ten-minute cache. */
export function requestLockerOwned(account: AccountData, refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.LockerOwnedRequest, account, refresh)
}

/** `templateId` of `null` clears the slot. */
export function equipLockerItem(
  account: AccountData,
  slotKey: LockerSlotKey,
  templateId: string | null,
  itemName: string
) {
  ipcRenderer.send(
    ElectronAPIEventKeys.LockerEquip,
    account,
    slotKey,
    templateId,
    itemName
  )
}

export function generateLockerCard(
  account: AccountData,
  filters: LockerCardFilters
) {
  ipcRenderer.send(ElectronAPIEventKeys.LockerCardGenerate, account, filters)
}

export function openLockerCard(filePath: string) {
  ipcRenderer.send(ElectronAPIEventKeys.LockerCardOpen, filePath)
}

export function exportLockerCard(filePath: string, fileName: string) {
  ipcRenderer.send(ElectronAPIEventKeys.LockerCardExport, filePath, fileName)
}

export function responseLocker(
  callback: (response: LockerPayload) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, response: LockerPayload) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LockerResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LockerResponse,
        customCallback
      ),
  }
}

export function responseLockerOwned(
  callback: (response: LockerOwnedPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: LockerOwnedPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LockerOwnedResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LockerOwnedResponse,
        customCallback
      ),
  }
}

export function notificationLockerEquip(
  callback: (response: LockerEquipNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: LockerEquipNotification
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LockerEquipNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LockerEquipNotification,
        customCallback
      ),
  }
}

export function notificationLockerCard(
  callback: (response: LockerCardNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: LockerCardNotification
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LockerCardNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LockerCardNotification,
        customCallback
      ),
  }
}

export function progressLockerCard(
  callback: (response: LockerCardProgress) => void
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: LockerCardProgress
  ) => {
    callback(response)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LockerCardProgress,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LockerCardProgress,
        customCallback
      ),
  }
}
