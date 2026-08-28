import type { IpcRendererEvent } from 'electron'
import type { AccountData } from '../../types/accounts'
import type { GiftsInformationPayload } from '../core/gifts-information'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function getGiftsInformation(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.GiftsInformationRequest, accounts)
}

export function getGiftsInformationNotification(
  callback: (value: GiftsInformationPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: GiftsInformationPayload
  ) => {
    callback(value).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.GiftsInformationResponseData,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.GiftsInformationResponseData,
        customCallback
      ),
  }
}
