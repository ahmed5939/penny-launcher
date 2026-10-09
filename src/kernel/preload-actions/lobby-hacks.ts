import type {
  LobbyHackRequest,
  LobbyHackResult,
} from '../../types/lobby-hacks'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/**
 * Sends one Lobby Hack code for one account. Only the account id and the
 * code cross; anything else the caller set stays here. Resolves with the
 * outcome once Epic has answered, refused, or the attempt has failed.
 */
export function submitLobbyHack(
  request: LobbyHackRequest
): Promise<LobbyHackResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.LobbyHackSubmit, {
    accountId: request.accountId,
    code: request.code,
  })
}
