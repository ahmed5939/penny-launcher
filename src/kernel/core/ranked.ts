import type { AccountData } from '../../types/accounts'
import type {
  AccountRanked,
  AccountRankedPayload,
  RankedTrackMeta,
} from '../../features/ranked/model'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { AccountsManager } from '../startup/accounts'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'

import {
  currentSeason,
  describeRanked,
  parseTrackProgress,
  parseTracks,
  rankedErrorMessage,
} from '../../features/ranked/model'
import { getRankedProgress, getRankedTracks } from '../../services/endpoints/habanero'

/**
 * Competitive rank, per linked account, from Fortnite's Habanero service.
 *
 * Each account is read on its own Fortnite token — the service answers only
 * for the account the token belongs to, so nothing here reaches another
 * player's profile. The active tracks' metadata (the season labels) is read
 * once per check on the first signed-in token and shared across the set; it
 * carries no per-account data and its failure never costs an account its rank.
 *
 * The parsing is pure and lives in `features/ranked/`.
 */

export type {
  AccountRanked,
  AccountRankedPayload,
  RankedTrack,
} from '../../features/ranked/model'

/** Divisions move a match at a time; a quarter of an hour is fresh enough. */
const rankedMaxAgeMs = 15 * 60 * 1000

/** Status of a failed request, when it got as far as an answer. */
function responseStatus(error: unknown) {
  return (error as { response?: { status?: number } } | null)?.response?.status
}

export class Ranked {
  private static results = new Map<string, AccountRanked>()
  private static tracks: Record<string, RankedTrackMeta> = {}
  private static tracksRead = false
  private static run: Promise<void> | null = null

  /**
   * Every linked account in turn; each fresh read is answered as it lands and
   * the last reply carries the full set, so an account removed since drops
   * out. A request that arrives mid-check is answered by the one running.
   */
  static request(refresh = false) {
    Ranked.run ??= Ranked.check(Boolean(refresh)).finally(() => {
      Ranked.run = null
    })

    return Ranked.run
  }

  private static async check(refresh: boolean) {
    if (refresh) {
      // Seasons turn over; a manual refresh re-reads the track metadata too.
      Ranked.tracksRead = false
      Ranked.tracks = {}
    }

    const accounts: Record<string, AccountRanked> = {}

    for (const account of AccountsManager.getAccounts().values()) {
      const cached = Ranked.results.get(account.accountId)
      const fresh =
        !refresh &&
        cached?.status === 'ok' &&
        Date.now() - Date.parse(cached.checkedAt) < rankedMaxAgeMs

      if (fresh) {
        accounts[account.accountId] = cached

        continue
      }

      const entry = await Ranked.readAccount(account)

      Ranked.results.set(account.accountId, entry)
      accounts[account.accountId] = entry
      Ranked.send({ accounts: { [account.accountId]: entry }, complete: false })
    }

    Ranked.send({ accounts, complete: true })
  }

  private static async readAccount(account: AccountData): Promise<AccountRanked> {
    const checkedAt = new Date().toISOString()

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return {
          status: 'unknown',
          tracks: [],
          season: currentSeason(Ranked.tracks),
          checkedAt,
          errorMessage:
            'Could not sign this account in to Epic. Sign in again from Accounts.',
        }
      }

      // The season labels, read once per check on the first token to hand.
      await Ranked.ensureTracks(accessToken)

      const { data } = await getRankedProgress({
        accessToken,
        accountId: account.accountId,
      })
      const progress = parseTrackProgress(data)

      if (!progress) {
        throw new Error('Epic sent no ranked progress')
      }

      return {
        status: 'ok',
        tracks: describeRanked(progress, Ranked.tracks),
        season: currentSeason(Ranked.tracks),
        checkedAt,
      }
    } catch (error) {
      RuntimeLog.error('caught:core/ranked.ts', error)

      return {
        status: 'unknown',
        tracks: [],
        season: currentSeason(Ranked.tracks),
        checkedAt,
        errorMessage: rankedErrorMessage(responseStatus(error)),
      }
    }
  }

  /**
   * The active tracks' metadata. Degrades silently: the labels come from the
   * rankingType regardless, so an empty map only drops the season heading.
   */
  private static async ensureTracks(accessToken: string) {
    if (Ranked.tracksRead) {
      return
    }

    Ranked.tracksRead = true

    try {
      const { data } = await getRankedTracks({ accessToken })

      Ranked.tracks = parseTracks(data)

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/ranked.ts', error)
    }
  }

  private static send(payload: AccountRankedPayload) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(ElectronAPIEventKeys.AccountRankedResponse, payload)
    }
  }
}
