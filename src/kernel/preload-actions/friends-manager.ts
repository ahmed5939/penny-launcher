import type { IpcRendererEvent } from 'electron'
import type {
  FriendsActionPayload,
  FriendsPayload,
  FriendsSearchPayload,
} from '../core/friends-manager'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestFriends(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.FriendsManagerRequest, account)
}

export function searchFriends(account: AccountData, query: string) {
  ipcRenderer.send(ElectronAPIEventKeys.FriendsManagerSearch, account, query)
}

export function friendsAction(
  account: AccountData,
  targetAccountId: string,
  action: FriendsActionPayload['action']
) {
  ipcRenderer.send(
    ElectronAPIEventKeys.FriendsManagerAction,
    account,
    targetAccountId,
    action
  )
}

export function responseFriends(
  callback: (response: FriendsPayload) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, response: FriendsPayload) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsManagerResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsManagerResponse,
        customCallback
      ),
  }
}

export function responseFriendsSearch(
  callback: (response: FriendsSearchPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: FriendsSearchPayload
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsManagerSearchResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsManagerSearchResponse,
        customCallback
      ),
  }
}

export function notificationFriendsAction(
  callback: (response: FriendsActionPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: FriendsActionPayload
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsManagerActionNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsManagerActionNotification,
        customCallback
      ),
  }
}
