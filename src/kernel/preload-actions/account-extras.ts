import type { IpcRendererEvent } from 'electron'
import type {
  AccountAvatarsPayload,
  AccountStandingPayload,
} from '../core/account-extras'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/**
 * Equipped-outfit avatars by account id — linked accounts or anyone else.
 * Answered once from cache and again as stale ones are fetched.
 */
export function requestAccountAvatars(accountIds: Array<string>) {
  ipcRenderer.send(ElectronAPIEventKeys.AccountAvatarsRequest, accountIds)
}

export function responseAccountAvatars(
  callback: (response: AccountAvatarsPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: AccountAvatarsPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AccountAvatarsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AccountAvatarsResponse,
        customCallback
      ),
  }
}

/** Social bans and warnings for every linked account. `refresh` skips the cache. */
export function requestAccountStanding(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.AccountStandingRequest, refresh)
}

export function responseAccountStanding(
  callback: (response: AccountStandingPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: AccountStandingPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AccountStandingResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AccountStandingResponse,
        customCallback
      ),
  }
}
