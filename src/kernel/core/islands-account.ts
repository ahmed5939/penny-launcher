import type { AccountData } from '../../types/accounts'

import { AccountsManager } from '../startup/accounts'
import { Authentication } from './authentication'

/**
 * Any signed-in account, for the reads that need *a* player but not a
 * particular one.
 *
 * Discover and the links service answer the same for every account — the
 * game client only needs to be signed in to ask — so the Islands page takes
 * no account and the main process borrows the first one whose token checks
 * out, the way `AccountExtras` does for avatars. Accounts last seen valid
 * are tried first.
 *
 * The choice is remembered for two minutes: verifying a token is a round
 * trip, and one Discover read asks for it several times.
 */

const reuseMs = 2 * 60 * 1000

export type LinkedAccount = { account: AccountData; accessToken: string }

let chosen: (LinkedAccount & { at: number }) | null = null
let choosing: Promise<LinkedAccount | null> | null = null

export function linkedAccount({ fresh = false } = {}): Promise<LinkedAccount | null> {
  if (
    !fresh &&
    chosen &&
    Date.now() - chosen.at < reuseMs &&
    AccountsManager.getAccountById(chosen.account.accountId)
  ) {
    return Promise.resolve({ account: chosen.account, accessToken: chosen.accessToken })
  }

  choosing ??= (async () => {
    const accounts = [...AccountsManager.getAccounts().values()]
      .filter((account) => account.authStatus !== 'invalid')
      .sort(
        (a, b) =>
          Number(b.authStatus === 'valid') - Number(a.authStatus === 'valid')
      )

    for (const account of accounts) {
      const accessToken = await Authentication.verifyAccessToken(account).catch(
        () => null
      )

      if (accessToken) {
        chosen = { account, accessToken, at: Date.now() }

        return { account, accessToken }
      }
    }

    chosen = null

    return null
  })().finally(() => {
    choosing = null
  })

  return choosing
}
