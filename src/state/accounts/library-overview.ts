import type {
  AccountLibraryOverview,
  LibraryOverviewPayload,
} from '../../features/library/collection'

import { createAccountBroadcast } from './broadcast-store'

/**
 * Every linked account's Epic library and game profile — the cross-account
 * Library. `last.fortnite` carries Fortnite's art and modes, the same for
 * every account.
 */
const overview = createAccountBroadcast<AccountLibraryOverview, LibraryOverviewPayload>({
  askAgainAfterMs: 10 * 60 * 1000,
  giveUpAfterMs: 3 * 60 * 1000,
  request: (refresh) => window.electronAPI.requestLibraryOverview(refresh),
  subscribe: (callback) => window.electronAPI.responseLibraryOverview(callback),
})

export const useLibraryOverviewStore = overview.useStore
export const useLibraryOverview = overview.use
