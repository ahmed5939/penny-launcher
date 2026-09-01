import type { IpcRendererEvent } from 'electron'
import type { SpritesPayload } from '../core/sprites'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Every BR sprite, owned or not. `refresh` skips the catalogue cache. */
export function requestSprites(account: AccountData, refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.SpritesRequest, account, refresh)
}

export function responseSprites(
  callback: (response: SpritesPayload) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, response: SpritesPayload) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.SpritesResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.SpritesResponse,
        customCallback
      ),
  }
}
