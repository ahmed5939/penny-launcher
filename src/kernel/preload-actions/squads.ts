import type { IpcRendererEvent } from 'electron'
import type {
  SquadAssignment,
  SquadsAssignNotification,
  SquadsPayload,
} from '../core/squads'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestSquads(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.SquadsRequest, account)
}

export function assignSquadSurvivors(
  account: AccountData,
  assignments: Array<SquadAssignment>
) {
  ipcRenderer.send(ElectronAPIEventKeys.SquadsAssign, account, assignments)
}

export function responseSquads(
  callback: (response: SquadsPayload) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, response: SquadsPayload) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.SquadsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.SquadsResponse,
        customCallback
      ),
  }
}

export function notificationSquadsAssign(
  callback: (response: SquadsAssignNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: SquadsAssignNotification
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.SquadsAssignNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.SquadsAssignNotification,
        customCallback
      ),
  }
}
