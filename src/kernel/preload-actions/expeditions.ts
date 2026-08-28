import type { IpcRendererEvent } from 'electron'
import type { ExpeditionsPayload } from '../core/expeditions'
import type { AccountData } from '../../types/accounts'
import type { AutoExpeditionConfig } from '../startup/auto-expeditions'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestExpeditions(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.ExpeditionsRequest, accounts)
}

export function responseExpeditions(
  callback: (response: ExpeditionsPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ExpeditionsPayload
  ) => callback(response).catch(console.error)
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

export function getAutoExpeditionsStatus() {
  return ipcRenderer.invoke(ElectronAPIEventKeys.AutoExpeditionsStatus)
}

export function updateAutoExpeditions(
  accountId: string,
  partial: Partial<AutoExpeditionConfig>
) {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.AutoExpeditionsUpdate,
    accountId,
    partial
  )
}
