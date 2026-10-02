import type { IpcRendererEvent } from 'electron'
import type { AccountSecurityPayload } from '../core/account-security'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Two-factor, email and linked platforms for every linked account. `refresh` skips the cache. */
export function requestAccountSecurity(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.AccountSecurityRequest, refresh)
}

export function responseAccountSecurity(
  callback: (response: AccountSecurityPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: AccountSecurityPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AccountSecurityResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AccountSecurityResponse,
        customCallback
      ),
  }
}
