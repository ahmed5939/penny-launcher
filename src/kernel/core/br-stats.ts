import type { AccountData } from '../../types/accounts'
import type {
  AccountBrStats as BrStatsEntry,
  BrStatsPayload,
} from '../../features/br-stats/model'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { AccountsManager } from '../startup/accounts'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { responseStatus } from './launcher-token'

import { parseBrStats } from '../../features/br-stats/model'
import { getAccountStats } from '../../services/endpoints/stats'

/**
 * Battle Royale career stats for every linked account, each read on its own
 * Fortnite token from the account's own stats (`statsproxy/statsv2`). It is
 * read-only and never asks for anyone but the account itself: the only id in
 * the call is the account's, and nothing but the summed figures is kept.
 *
 * Mirrors `account-security.ts`: one account at a time, answered as each
 * lands, then once more with the full set (`complete`) so an account removed
 * since drops out. A request that arrives mid-check is answered by the check
 * already running.
 */

export type {
  AccountBrStats as BrStatsEntry,
  BrStatsPayload,
  BrStatLine,
  BrStatsSummary,
} from '../../features/br-stats/model'

/** A match is not played often enough to re-read sooner than this. */
const brStatsMaxAgeMs = 10 * 60 * 1000

export class BrStats {
  private static results = new Map<string, BrStatsEntry>()
  private static run: Promise<void> | null = null

  /** Every linked account in turn; the last reply carries the full set. */
  static request(refresh = false) {
    BrStats.run ??= BrStats.check(Boolean(refresh)).finally(() => {
      BrStats.run = null
    })

    return BrStats.run
  }

  private static async check(refresh: boolean) {
    const accounts: Record<string, BrStatsEntry> = {}

    for (const account of AccountsManager.getAccounts().values()) {
      const cached = BrStats.results.get(account.accountId)

      if (
        !refresh &&
        cached?.status === 'ok' &&
        Date.now() - Date.parse(cached.checkedAt) < brStatsMaxAgeMs
      ) {
        accounts[account.accountId] = cached

        continue
      }

      const entry = await BrStats.readAccount(account)

      BrStats.results.set(account.accountId, entry)
      accounts[account.accountId] = entry
      BrStats.send({ accounts: { [account.accountId]: entry }, complete: false })
    }

    BrStats.send({ accounts, complete: true })
  }

  private static async readAccount(account: AccountData): Promise<BrStatsEntry> {
    const checkedAt = new Date().toISOString()

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return {
          status: 'unknown',
          ...parseBrStats(null),
          checkedAt,
          errorMessage:
            'Could not sign in to this account. Add it again, then check again.',
        }
      }

      const response = await getAccountStats({
        accessToken,
        accountId: account.accountId,
      })

      return { status: 'ok', ...parseBrStats(response.data), checkedAt }
    } catch (error) {
      RuntimeLog.error('caught:core/br-stats.ts', error)

      const status = responseStatus(error)

      return {
        status: 'unknown',
        ...parseBrStats(null),
        checkedAt,
        errorMessage: status
          ? `Could not read Battle Royale stats (HTTP ${status}). Try again later.`
          : error instanceof Error
            ? error.message
            : 'Could not read Battle Royale stats. Try again later.',
      }
    }
  }

  private static send(payload: BrStatsPayload) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(ElectronAPIEventKeys.AccountBrStatsResponse, payload)
    }
  }
}
