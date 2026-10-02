import type { AccountData } from '../../types/accounts'
import type {
  AccountSecurity as AccountSecurityEntry,
  AccountSecurityPayload,
} from '../../features/account-security/model'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { AccountsManager } from '../startup/accounts'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { responseStatus, withLauncherToken } from './launcher-token'

import { parseMyAccount } from '../../features/account-security/model'
import { getMyAccount } from '../../services/endpoints/epic-graphql'

/**
 * Two-factor, email and linked platforms for every linked account, from the
 * launcher's GraphQL gateway (`Account.myAccount`) on each account's own
 * launcher token. Nothing personal leaves this file: the email and the
 * platform ids are not even asked for.
 */

export type {
  AccountSecurity as AccountSecurityEntry,
  AccountSecurityPayload,
} from '../../features/account-security/model'

/** Turning on two-factor is the one change worth noticing soon after. */
const securityMaxAgeMs = 10 * 60 * 1000

export class AccountSecurity {
  private static results = new Map<string, AccountSecurityEntry>()
  private static run: Promise<void> | null = null

  /** Every linked account in turn; the last reply carries the full set. */
  static request(refresh = false) {
    AccountSecurity.run ??= AccountSecurity.check(Boolean(refresh)).finally(() => {
      AccountSecurity.run = null
    })

    return AccountSecurity.run
  }

  private static async check(refresh: boolean) {
    const accounts: Record<string, AccountSecurityEntry> = {}

    for (const account of AccountsManager.getAccounts().values()) {
      const cached = AccountSecurity.results.get(account.accountId)

      if (
        !refresh &&
        cached?.status === 'ok' &&
        Date.now() - Date.parse(cached.checkedAt) < securityMaxAgeMs
      ) {
        accounts[account.accountId] = cached

        continue
      }

      const entry = await AccountSecurity.readAccount(account)

      AccountSecurity.results.set(account.accountId, entry)
      accounts[account.accountId] = entry
      AccountSecurity.send({ accounts: { [account.accountId]: entry }, complete: false })
    }

    AccountSecurity.send({ accounts, complete: true })
  }

  private static async readAccount(account: AccountData): Promise<AccountSecurityEntry> {
    const checkedAt = new Date().toISOString()

    try {
      const parsed = parseMyAccount(
        await withLauncherToken(account, (accessToken) => getMyAccount({ accessToken })),
        checkedAt
      )

      if (parsed) {
        return parsed
      }

      throw new Error('Epic sent no account')
    } catch (error) {
      RuntimeLog.error('caught:core/account-security.ts', error)

      const status = responseStatus(error)

      return {
        status: 'unknown',
        tfaEnabled: null,
        emailVerified: null,
        country: null,
        cabinedMode: null,
        platforms: [],
        checkedAt,
        errorMessage: status
          ? `Could not check account security (HTTP ${status}). Try again later.`
          : error instanceof Error
            ? error.message
            : 'Could not check account security. Try again later.',
      }
    }
  }

  private static send(payload: AccountSecurityPayload) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(ElectronAPIEventKeys.AccountSecurityResponse, payload)
    }
  }
}
