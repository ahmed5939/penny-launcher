import type { IpcRendererEvent } from 'electron'
import type { AccountTournamentsPayload } from '../core/tournaments'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Each linked account's own competitive history. `refresh` skips the cache. */
export function requestAccountTournaments(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.AccountTournamentsRequest, refresh)
}

export function responseAccountTournaments(
  callback: (response: AccountTournamentsPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: AccountTournamentsPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AccountTournamentsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AccountTournamentsResponse,
        customCallback
      ),
  }
}
