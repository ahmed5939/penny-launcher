import type {
  LobbyHackRequest,
  LobbyHackResult,
} from '../../types/lobby-hacks'

import { create } from 'zustand'

import {
  checkLobbyHackCode,
  isLobbyHackAccountId,
} from '../../lib/lobby-hacks'

import { isResultFor, unknownResult } from './model'

export type LobbyHackSubmission = LobbyHackRequest & {
  result: LobbyHackResult
}

export type LobbyHackDraft = {
  /** Picked on the page; null follows the title-bar account. */
  accountId: string | null
  code: string
}

/**
 * The form, the submission in flight and the last one that finished. Kept
 * while Penny runs so leaving the page loses nothing; never persisted, as a
 * code is not something to keep on disk.
 */
export const useLobbyHackStore = create<{
  draft: LobbyHackDraft
  pending: LobbyHackRequest | null
  last: LobbyHackSubmission | null
}>()(() => ({
  draft: { accountId: null, code: '' },
  pending: null,
  last: null,
}))

export function setLobbyHackDraft(patch: Partial<LobbyHackDraft>) {
  useLobbyHackStore.setState((state) => ({
    draft: { ...state.draft, ...patch },
  }))
}

type Send = (request: LobbyHackRequest) => Promise<LobbyHackResult>

const sendThroughPreload: Send = (request) =>
  window.electronAPI.submitLobbyHack(request)

/**
 * The page's Submit. Refuses while another submission is running and when
 * the code would fail the main process's checks, so nothing is sent then.
 *
 * The account is fixed when this is called: the request, the pending state
 * and the stored result all name the same account, whatever the picker
 * shows by the time Epic answers. There is no retry.
 */
export async function submitLobbyHackCode(
  accountId: string,
  rawCode: string,
  send: Send = sendThroughPreload
): Promise<LobbyHackSubmission | null> {
  if (useLobbyHackStore.getState().pending) {
    return null
  }

  const check = checkLobbyHackCode(rawCode)

  if (!check.ok || !isLobbyHackAccountId(accountId)) {
    return null
  }

  const request: LobbyHackRequest = { accountId, code: check.code }

  useLobbyHackStore.setState({ pending: request })

  let result: LobbyHackResult

  try {
    const reply = await send(request)

    result = isResultFor(reply, accountId) ? reply : unknownResult(accountId)
  } catch {
    // The main process failed past its own handling; the code may have gone.
    result = unknownResult(accountId)
  }

  const submission = { ...request, result }

  useLobbyHackStore.setState((state) => ({
    pending: null,
    last: submission,
    // A granted code is spent: clear it so it is not sent twice by habit.
    draft:
      result.outcome === 'granted' && state.draft.code.trim() === request.code
        ? { ...state.draft, code: '' }
        : state.draft,
  }))

  return submission
}
