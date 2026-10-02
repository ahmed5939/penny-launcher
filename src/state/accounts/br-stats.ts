import type { AccountBrStats, BrStatsPayload } from '../../features/br-stats/model'

import { createAccountBroadcast } from './broadcast-store'

/**
 * Every linked account's Battle Royale career; kept ten minutes. Each
 * account costs a Fortnite sign-in, so a long list fills in as it goes.
 */
const brStats = createAccountBroadcast<AccountBrStats, BrStatsPayload>({
  askAgainAfterMs: 10 * 60 * 1000,
  giveUpAfterMs: 3 * 60 * 1000,
  request: (refresh) => window.electronAPI.requestAccountBrStats(refresh),
  subscribe: (callback) => window.electronAPI.responseAccountBrStats(callback),
})

export const useAccountBrStatsStore = brStats.useStore
export const requestAccountBrStats = brStats.request
/** Every linked account's Battle Royale stats, read on mount and when one is added. */
export const useAccountBrStats = brStats.use
