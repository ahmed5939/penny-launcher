import type { AccountRewindFacts, RewindFactsPayload } from '../../features/rewind/facts'

import { createAccountBroadcast } from './broadcast-store'

/** Penny Rewind's game-profile facts for every linked account; kept half an hour. */
const facts = createAccountBroadcast<AccountRewindFacts, RewindFactsPayload>({
  askAgainAfterMs: 30 * 60 * 1000,
  giveUpAfterMs: 3 * 60 * 1000,
  request: (refresh) => window.electronAPI.requestRewindFacts(refresh),
  subscribe: (callback) => window.electronAPI.responseRewindFacts(callback),
})

export const useRewindFacts = facts.use
