import type { AccountPlaytime, AccountPlaytimePayload } from '../../kernel/core/playtime'

import { createAccountBroadcast } from './broadcast-store'

/**
 * Time played for every linked account. The main process keeps answers for
 * a quarter of an hour; each account costs a launcher sign-in, so a long
 * list takes a while.
 */
const playtime = createAccountBroadcast<AccountPlaytime, AccountPlaytimePayload>({
  askAgainAfterMs: 15 * 60 * 1000,
  giveUpAfterMs: 3 * 60 * 1000,
  request: (refresh) => window.electronAPI.requestAccountPlaytime(refresh),
  subscribe: (callback) => window.electronAPI.responseAccountPlaytime(callback),
})

export const useAccountPlaytimeStore = playtime.useStore
export const requestAccountPlaytime = playtime.request
/** Every linked account's playtime, read on mount and when an account is added. */
export const useAccountPlaytime = playtime.use
