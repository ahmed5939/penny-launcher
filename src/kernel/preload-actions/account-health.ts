import type { IpcRendererEvent } from 'electron'
import type { ProfilePayload } from '../core/account-health'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestAccountHealth(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.AccountHealthRequest, accounts)
}

export function responseAccountHealth(
  callback: (response: ProfilePayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ProfilePayload
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AccountHealthResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AccountHealthResponse,
        customCallback
      ),
  }
}
