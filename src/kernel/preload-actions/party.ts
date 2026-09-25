import type { IpcRendererEvent } from 'electron'
import type { AccountData } from '../../types/accounts'
import type {
  AddNewFriendNotification,
  InviteNotification,
} from '../../types/party'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function addNewFriend(account: AccountData, displayName: string) {
  ipcRenderer.send(
    ElectronAPIEventKeys.PartyAddNewFriendAction,
    account,
    displayName
  )
}

export function invite(account: AccountData, accountIds: Array<string>) {
  ipcRenderer.send(
    ElectronAPIEventKeys.PartyInviteAction,
    account,
    accountIds
  )
}

export function removeFriend(data: {
  accountId: string
  displayName: string
}) {
  ipcRenderer.send(ElectronAPIEventKeys.PartyRemoveFriendAction, data)
}

export function notificationAddNewFriend(
  callback: (value: AddNewFriendNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: AddNewFriendNotification
  ) => {
    callback(value).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.PartyAddNewFriendActionNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.PartyAddNewFriendActionNotification,
        customCallback
      ),
  }
}

export function notificationInvite(
  callback: (value: Array<InviteNotification>) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: Array<InviteNotification>
  ) => {
    callback(value).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.PartyInviteActionNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.PartyInviteActionNotification,
        customCallback
      ),
  }
}

export function notificationRemoveFriend(
  callback: (value: {
    displayName: string
    status: boolean
  }) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: {
      displayName: string
      status: boolean
    }
  ) => {
    callback(value).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.PartyRemoveFriendActionNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.PartyRemoveFriendActionNotification,
        customCallback
      ),
  }
}
