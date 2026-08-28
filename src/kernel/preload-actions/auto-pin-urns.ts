import type { IpcRendererEvent } from 'electron'
import type { AutoPinQuestDataList } from '../../types/urns'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function autoPinUrnsRequestData() {
  ipcRenderer.send(ElectronAPIEventKeys.UrnsServiceRequestData)
}

export function autoPinUrnsAdd(accountId: string) {
  ipcRenderer.send(ElectronAPIEventKeys.UrnsServiceAdd, accountId)
}

export function autoPinUrnsUpdate(
  accountId: string,
  templateId: string,
  value: boolean
) {
  ipcRenderer.send(
    ElectronAPIEventKeys.UrnsServiceUpdate,
    accountId,
    templateId,
    value
  )
}

export function autoPinUrnsRemove(accountId: string) {
  ipcRenderer.send(ElectronAPIEventKeys.UrnsServiceRemove, accountId)
}

export function notificationAutoPinUrnsData(
  callback: (value: {
    quests: AutoPinQuestDataList
  }) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: {
      quests: AutoPinQuestDataList
    }
  ) => {
    callback(value).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.UrnsServiceResponseData,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.UrnsServiceResponseData,
        customCallback
      ),
  }
}
