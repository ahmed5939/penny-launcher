import type { AccountRanked, AccountRankedPayload } from '../../kernel/core/ranked'

import { createAccountBroadcast } from './broadcast-store'

/**
 * Competitive rank for every linked account. The main process keeps answers
 * for a quarter of an hour; each account costs a Fortnite sign-in, so a long
 * list takes a moment.
 */
const ranked = createAccountBroadcast<AccountRanked, AccountRankedPayload>({
  askAgainAfterMs: 15 * 60 * 1000,
  giveUpAfterMs: 3 * 60 * 1000,
  request: (refresh) => window.electronAPI.requestAccountRanked(refresh),
  subscribe: (callback) => window.electronAPI.responseAccountRanked(callback),
})

export const useAccountRankedStore = ranked.useStore
export const requestAccountRanked = ranked.request
/** Every linked account's ranked progress, read on mount and when an account is added. */
export const useAccountRanked = ranked.use
