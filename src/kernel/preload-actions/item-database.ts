import type { IpcRendererEvent } from 'electron'
import type { ItemDatabasePayload } from '../core/item-database'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestItemDatabase() {
  ipcRenderer.send(ElectronAPIEventKeys.ItemDatabaseRequest)
}

/** Ignores the cache and re-downloads. */
export function refreshItemDatabase() {
  ipcRenderer.send(ElectronAPIEventKeys.ItemDatabaseRefresh)
}

export function responseItemDatabase(
  callback: (response: ItemDatabasePayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ItemDatabasePayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ItemDatabaseResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ItemDatabaseResponse,
        customCallback
      ),
  }
}
