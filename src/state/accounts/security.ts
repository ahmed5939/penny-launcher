import type { AccountSecurity, AccountSecurityPayload } from '../../features/account-security/model'

import { createAccountBroadcast } from './broadcast-store'

/** Two-factor, email and linked platforms for every linked account; kept ten minutes. */
const security = createAccountBroadcast<AccountSecurity, AccountSecurityPayload>({
  askAgainAfterMs: 10 * 60 * 1000,
  giveUpAfterMs: 2 * 60 * 1000,
  request: (refresh) => window.electronAPI.requestAccountSecurity(refresh),
  subscribe: (callback) => window.electronAPI.responseAccountSecurity(callback),
})

export const useAccountSecurityStore = security.useStore
export const requestAccountSecurity = security.request
export const useAccountSecurity = security.use
