import type { IpcRendererEvent } from 'electron'
import type { QuestsPayload, QuestsPinNotification } from '../core/quests'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestQuests(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.QuestsRequest, account)
}

/** `pinnedQuestIds` is the complete set to end up with, not a delta. */
export function pinQuests(
  account: AccountData,
  pinnedQuestIds: Array<string>
) {
  ipcRenderer.send(ElectronAPIEventKeys.QuestsPin, account, pinnedQuestIds)
}

export function responseQuests(
  callback: (response: QuestsPayload) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, response: QuestsPayload) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.QuestsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.QuestsResponse,
        customCallback
      ),
  }
}

export function notificationQuestsPin(
  callback: (response: QuestsPinNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: QuestsPinNotification
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.QuestsPinNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.QuestsPinNotification,
        customCallback
      ),
  }
}
