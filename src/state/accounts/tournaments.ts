import type {
  AccountTournaments,
  AccountTournamentsPayload,
} from '../../kernel/core/tournaments'

import { createAccountBroadcast } from './broadcast-store'

/**
 * Each linked account's own competitive history. The main process keeps
 * answers for a quarter of an hour; every account costs a calendar read and a
 * few history reads, so a long list takes a while.
 */
const tournaments = createAccountBroadcast<
  AccountTournaments,
  AccountTournamentsPayload
>({
  askAgainAfterMs: 15 * 60 * 1000,
  giveUpAfterMs: 3 * 60 * 1000,
  request: (refresh) => window.electronAPI.requestAccountTournaments(refresh),
  subscribe: (callback) => window.electronAPI.responseAccountTournaments(callback),
})

export const useAccountTournamentsStore = tournaments.useStore
export const requestAccountTournaments = tournaments.request
/** Every linked account's competitive history, read on mount and when an account is added. */
export const useAccountTournaments = tournaments.use
