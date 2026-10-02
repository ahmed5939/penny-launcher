import type { AccountData } from '../../types/accounts'
import type {
  AccountTournaments as AccountTournamentsEntry,
  AccountTournamentsPayload,
  EventsData,
  WindowResult,
} from '../../features/tournaments/model'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { AccountsManager } from '../startup/accounts'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { responseStatus } from './launcher-token'

import {
  parseEventHistory,
  parseEventsData,
  recentEventsForHistory,
  summarizeEvents,
  tournamentsErrorMessage,
} from '../../features/tournaments/model'
import { getEventHistory, getEventsData } from '../../services/endpoints/events'

/**
 * Each linked account's own competitive history, from the Fortnite events
 * service.
 *
 * Read on the account's *own* Fortnite token (the one the stats service
 * takes): the events service answers an account's calendar and results only
 * for the account behind the token. Nothing but that account's own id is ever
 * asked for, and nothing is ever written.
 *
 * Each account costs one calendar read — retried with a region only when a
 * deployment refuses an unscoped one — and a history read for the handful of
 * recent events the account could have a result in, capped so a full
 * calendar stays cheap. The parsing and the join are pure and live in
 * `features/tournaments/`.
 */

export type {
  AccountTournaments,
  AccountTournamentsPayload,
  EventSummary,
} from '../../features/tournaments/model'

/** Results only move when a window ends; a quarter of an hour is fresh enough. */
const tournamentsMaxAgeMs = 15 * 60 * 1000

/** The regions to try when a deployment will not answer without one. */
const regionsToRetry = ['EU', 'NAE', 'NAC', 'NAW', 'ASIA', 'OCE', 'BR', 'ME'] as const

/** Keep the per-account cost to a handful of history calls. */
const historyEventCap = 5

function errorText(error: unknown) {
  const data = (
    error as {
      response?: { data?: { errorMessage?: unknown; errorCode?: unknown } }
    } | null
  )?.response?.data
  const message = typeof data?.errorMessage === 'string' ? data.errorMessage : null
  const code = typeof data?.errorCode === 'string' ? data.errorCode : null

  if (message) {
    return code ? `${message} (${code})` : message
  }

  return error instanceof Error ? error.message : 'Unknown error'
}

export class Tournaments {
  private static results = new Map<string, AccountTournamentsEntry>()
  private static run: Promise<void> | null = null

  /**
   * Every linked account, one after another. Each fresh read is answered as
   * it lands; the last reply carries the full set so the renderer can drop
   * accounts removed since. A request mid-check is answered by the check
   * already running.
   */
  static request(refresh = false) {
    Tournaments.run ??= Tournaments.check(Boolean(refresh)).finally(() => {
      Tournaments.run = null
    })

    return Tournaments.run
  }

  private static async check(refresh: boolean) {
    const accounts: Record<string, AccountTournamentsEntry> = {}

    for (const account of AccountsManager.getAccounts().values()) {
      const cached = Tournaments.results.get(account.accountId)
      const fresh =
        !refresh &&
        cached?.status === 'ok' &&
        Date.now() - Date.parse(cached.checkedAt) < tournamentsMaxAgeMs

      if (fresh) {
        accounts[account.accountId] = cached

        continue
      }

      const entry = await Tournaments.readAccount(account)

      Tournaments.results.set(account.accountId, entry)
      accounts[account.accountId] = entry
      Tournaments.send({
        accounts: { [account.accountId]: entry },
        complete: false,
      })
    }

    Tournaments.send({ accounts, complete: true })
  }

  private static async readAccount(
    account: AccountData
  ): Promise<AccountTournamentsEntry> {
    const checkedAt = new Date().toISOString()

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return {
          status: 'unknown',
          events: [],
          region: null,
          checkedAt,
          errorMessage:
            'This account is signed out. Sign in again from Accounts.',
        }
      }

      const { data, region } = await Tournaments.readCalendar(
        account.accountId,
        accessToken
      )
      const history = await Tournaments.readHistory(
        account.accountId,
        accessToken,
        data
      )

      return {
        status: 'ok',
        events: summarizeEvents(data, history),
        region,
        checkedAt,
      }
    } catch (error) {
      RuntimeLog.error('caught:core/tournaments.ts', error)

      const status = responseStatus(error)

      return {
        status: 'unknown',
        events: [],
        region: null,
        checkedAt,
        errorMessage: tournamentsErrorMessage(status, errorText(error)),
      }
    }
  }

  /** The account's own calendar: no region first, a region only when Epic insists. */
  private static async readCalendar(
    accountId: string,
    accessToken: string
  ): Promise<{ data: EventsData; region: string | null }> {
    try {
      const response = await getEventsData({ accessToken, accountId })

      return { data: parseEventsData(response.data), region: null }
    } catch (error) {
      for (const region of regionsToRetry) {
        try {
          const response = await getEventsData({ accessToken, accountId, region })

          return { data: parseEventsData(response.data), region }
        } catch (retryError) {
          RuntimeLog.error(
            `caught:core/tournaments.ts (region ${region})`,
            retryError
          )
        }
      }

      // Every region refused too: let the original failure carry the status.
      throw error
    }
  }

  /**
   * A history read for the handful of recent events the account could have a
   * result in. A missing or private history leaves that event unplayed, not
   * the whole read broken, so each call is settled on its own.
   */
  private static async readHistory(
    accountId: string,
    accessToken: string,
    data: EventsData
  ): Promise<Record<string, Array<WindowResult>>> {
    const history: Record<string, Array<WindowResult>> = {}

    await Promise.allSettled(
      recentEventsForHistory(data, { cap: historyEventCap }).map(
        async (eventId) => {
          try {
            const response = await getEventHistory({
              accessToken,
              accountId,
              eventId,
            })
            const results = parseEventHistory(response.data)

            if (results.length > 0) {
              history[eventId] = results
            }
          } catch (error) {
            RuntimeLog.error('caught:core/tournaments.ts (history)', error)
          }
        }
      )
    )

    return history
  }

  private static send(payload: AccountTournamentsPayload) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(
        ElectronAPIEventKeys.AccountTournamentsResponse,
        payload
      )
    }
  }
}
