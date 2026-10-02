import type { AccountData } from '../../types/accounts'
import type {
  AchievementDefinitions,
  AchievementSummaries,
  GameAchievementsResult,
} from '../../features/playtime/achievements'
import type {
  AccountPlaytime,
  AccountPlaytimePayload,
  AppInfo,
} from '../../features/playtime/model'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { AccountsManager } from '../startup/accounts'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { responseStatus, withLauncherToken } from './launcher-token'

import {
  buildGameAchievements,
  isSandboxId,
  parseAchievementDefinitions,
  parseAchievementSummaries,
  parsePlayerAchievements,
} from '../../features/playtime/achievements'
import {
  describePlaytime,
  mergeAppInfo,
  parseAppBuilds,
  parsePlaytimeTotals,
  playtimeErrorMessage,
  unnamedApps,
} from '../../features/playtime/model'
import { parseMinutesPlayed } from '../../features/playtime/stats'
import { getAccountStats } from '../../services/endpoints/stats'
import {
  getAchievementDefinitions,
  getAchievementSummaries,
  getAppBuilds,
  getPlayerAchievements,
  getPlaytimeTotals,
} from '../../services/endpoints/epic-graphql'

/**
 * Time played, per linked account, from the launcher's GraphQL gateway.
 *
 * Each account is read on its own launcher token — the playtime service
 * refuses one account's token for another's totals. The app names in the
 * totals are named from `appBuilds`, read once per account per session and
 * only when that account has played something not yet named; one account's
 * builds name the shared Fortnite apps for every other.
 *
 * Epic achievements ride along: each account's per-game summary is read
 * with the same token right after its totals, and a game's full list —
 * definitions joined to the account's unlocks — only when it is opened.
 *
 * The parsing is pure and lives in `features/playtime/`.
 */

export type {
  AccountPlaytime,
  AccountPlaytimePayload,
  PlaytimeEntry,
} from '../../features/playtime/model'
export type {
  GameAchievements,
  GameAchievementsResult,
} from '../../features/playtime/achievements'

/** Totals move when a session ends; a quarter of an hour is fresh enough. */
const playtimeMaxAgeMs = 15 * 60 * 1000

/** A game's achievement list changes with its patches, not by the minute. */
const definitionsMaxAgeMs = 60 * 60 * 1000

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

export class Playtime {
  private static results = new Map<string, AccountPlaytime>()
  private static apps: Record<string, AppInfo> = {}
  private static buildsRead = new Set<string>()
  private static definitions = new Map<
    string,
    { at: number; value: AchievementDefinitions | null }
  >()
  private static run: Promise<void> | null = null

  /**
   * Every linked account, one after another. Each fresh read is answered as
   * it lands; the last reply carries the full set so the renderer can drop
   * accounts that have since been removed. A request that arrives mid-check
   * is answered by the check already running.
   */
  static request(refresh = false) {
    Playtime.run ??= Playtime.check(Boolean(refresh)).finally(() => {
      Playtime.run = null
    })

    return Playtime.run
  }

  private static async check(refresh: boolean) {
    const accounts: Record<string, AccountPlaytime> = {}

    for (const account of AccountsManager.getAccounts().values()) {
      const cached = Playtime.results.get(account.accountId)
      const fresh =
        !refresh &&
        cached?.status === 'ok' &&
        Date.now() - Date.parse(cached.checkedAt) < playtimeMaxAgeMs

      if (fresh) {
        accounts[account.accountId] = cached

        continue
      }

      const entry = await Playtime.readAccount(account)

      Playtime.results.set(account.accountId, entry)
      accounts[account.accountId] = entry
      Playtime.send({
        accounts: { [account.accountId]: entry },
        complete: false,
      })
    }

    Playtime.send({ accounts, complete: true })
  }

  /**
   * The launcher's records and Fortnite's stats side by side: two services,
   * two tokens, and either can fail without costing the other.
   */
  private static async readAccount(account: AccountData): Promise<AccountPlaytime> {
    const [launcher, allPlatforms] = await Promise.all([
      Playtime.readLauncher(account),
      Playtime.readAllPlatforms(account),
    ])

    return { ...launcher, allPlatforms }
  }

  /** Every platform, from the stats service on the account's Fortnite token. */
  private static async readAllPlatforms(account: AccountData) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return null
      }

      const response = await getAccountStats({ accessToken, accountId: account.accountId })

      return parseMinutesPlayed(response.data)
    } catch (error) {
      RuntimeLog.error('caught:core/playtime.ts (stats)', error)

      return null
    }
  }

  private static async readLauncher(
    account: AccountData
  ): Promise<Omit<AccountPlaytime, 'allPlatforms'>> {
    const checkedAt = new Date().toISOString()

    try {
      return await withLauncherToken(account, async (accessToken) => {
        const reply = await getPlaytimeTotals({
          accessToken,
          accountId: account.accountId,
        })
        const totals = parsePlaytimeTotals(reply) ?? []

        if (
          unnamedApps(totals, Playtime.apps).length > 0 &&
          !Playtime.buildsRead.has(account.accountId)
        ) {
          await Playtime.readApps(account, accessToken)
        }

        if (unnamedApps(totals, Playtime.apps).length > 0) {
          await Playtime.readFortniteApps()
        }

        const summaries = await Playtime.readSummaries(account, accessToken)

        return {
          status: 'ok' as const,
          entries: describePlaytime(totals, Playtime.apps),
          achievements: summaries.games,
          profileVisibility: summaries.visibility,
          checkedAt,
        }
      })
    } catch (error) {
      RuntimeLog.error('caught:core/playtime.ts (totals)', error)

      return {
        status: 'unknown',
        entries: [],
        achievements: null,
        profileVisibility: null,
        checkedAt,
        errorMessage: responseStatus(error)
          ? playtimeErrorMessage(responseStatus(error), errorText(error))
          : // Not signed in, a timeout: the thrown message already says so.
            errorText(error),
      }
    }
  }

  /** Names only — a failure here leaves the totals unnamed, not unread. */
  private static async readApps(account: AccountData, accessToken: string) {
    Playtime.buildsRead.add(account.accountId)

    try {
      const found = parseAppBuilds(await getAppBuilds({ accessToken }))

      for (const [appName, info] of Object.entries(found)) {
        Playtime.apps[appName] = mergeAppInfo(Playtime.apps[appName], info)
      }
    } catch (error) {
      RuntimeLog.error('caught:core/playtime.ts (app names)', error)
    }
  }

  /**
   * Fortnite's modes from its catalogue item — Battle Royale's app has no
   * build for `appBuilds` to name. Shares the Library's cached catalogue.
   */
  private static async readFortniteApps() {
    try {
      const { Library } = await import('./library')

      for (const [appName, info] of Object.entries(await Library.fortniteApps())) {
        Playtime.apps[appName] = mergeAppInfo(Playtime.apps[appName], {
          title: info.title,
          namespace: 'fn',
          art: info.art,
        })
      }
    } catch (error) {
      RuntimeLog.error('caught:core/playtime.ts (Fortnite apps)', error)
    }
  }

  /** Achievements only — a failure here leaves the playtime standing. */
  private static async readSummaries(
    account: AccountData,
    accessToken: string
  ): Promise<AchievementSummaries> {
    try {
      return parseAchievementSummaries(
        await getAchievementSummaries({
          accessToken,
          accountId: account.accountId,
        })
      )
    } catch (error) {
      RuntimeLog.error('caught:core/playtime.ts (achievement summaries)', error)

      return { visibility: null, games: null }
    }
  }

  /**
   * One game's achievements for one linked account: the public list joined
   * to the account's unlocks, read side by side. Answered with a result
   * rather than thrown, so the dialog can say what went wrong.
   */
  static async gameAchievements(
    accountId: unknown,
    sandboxId: unknown
  ): Promise<GameAchievementsResult> {
    const account =
      typeof accountId === 'string'
        ? AccountsManager.getAccounts().get(accountId)
        : undefined

    if (!account) {
      return { ok: false, error: 'This account is no longer linked.' }
    }

    if (!isSandboxId(sandboxId)) {
      return { ok: false, error: 'That is not a game Epic knows.' }
    }

    try {
      const [definitions, player] = await Promise.all([
        Playtime.readDefinitions(sandboxId),
        withLauncherToken(account, (accessToken) =>
          getPlayerAchievements({
            accessToken,
            accountId: account.accountId,
            sandboxId,
          })
        ),
      ])

      if (!definitions) {
        return { ok: false, error: 'Epic lists no achievements for this game.' }
      }

      return {
        ok: true,
        data: buildGameAchievements({
          accountId: account.accountId,
          sandboxId,
          definitions,
          player: parsePlayerAchievements(player),
          summary:
            Playtime.results
              .get(account.accountId)
              ?.achievements?.find((game) => game.sandboxId === sandboxId) ?? null,
        }),
      }
    } catch (error) {
      RuntimeLog.error('caught:core/playtime.ts (game achievements)', error)

      const status = responseStatus(error)

      return {
        ok: false,
        error: status
          ? `Could not load achievements (HTTP ${status}). Try again later.`
          : `Could not load achievements (${errorText(error)}). Try again later.`,
      }
    }
  }

  private static async readDefinitions(sandboxId: string) {
    const cached = Playtime.definitions.get(sandboxId)

    if (cached && Date.now() - cached.at < definitionsMaxAgeMs) {
      return cached.value
    }

    const value = parseAchievementDefinitions(
      await getAchievementDefinitions({ sandboxId })
    )

    Playtime.definitions.set(sandboxId, { at: Date.now(), value })

    return value
  }

  private static send(payload: AccountPlaytimePayload) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(ElectronAPIEventKeys.AccountPlaytimeResponse, payload)
    }
  }
}
