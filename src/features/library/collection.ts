import type { GameAchievementSummary } from '../playtime/achievements'
import type { AccountPlaytime } from '../playtime/model'
import type { LibraryRecord, ProfileAccess } from './account'
import type { LibraryArt, LibraryMode } from './model'

import { libraryGames, secondsByApp, timeFor } from './account'

/**
 * Every linked account's Epic library as one collection.
 *
 * A launcher for several accounts can say what no single account's page
 * can: which accounts own a game, how long each has played it, what each
 * has unlocked. Each account's library list and game profile are read on
 * its own token (`AccountLibraryOverview`); time and achievements come
 * from the playtime read. This file is only the join.
 */

export type AccountLibraryOverview = {
  status: 'ok' | 'unknown'
  records: Array<LibraryRecord>
  /** The game profile's access tokens; null when it could not be read. */
  access: ProfileAccess | null
  checkedAt: string
  errorMessage?: string
}

export type LibraryOverviewPayload = {
  accounts: Record<string, AccountLibraryOverview>
  /** Fortnite's own art and modes, from the catalogue — the same for every account. */
  fortnite: { art: LibraryArt; modes: Array<LibraryMode> } | null
  /** The last reply of a check, carrying every linked account. */
  complete: boolean
}

export type CollectionOwner = {
  accountId: string
  acquiredAt: string | null
  seconds: number | null
  achievements: GameAchievementSummary | null
}

export type CollectionGame = {
  namespace: string
  title: string
  art: LibraryArt
  appNames: Array<string>
  /** In the order the accounts were given. */
  owners: Array<CollectionOwner>
  /** Every owner's recorded time, added up — one account's hours are not another's. */
  seconds: number | null
  /** The earliest any account got it. */
  acquiredAt: string | null
}

export type CollectionSort = 'played' | 'recent' | 'name'

function playtimeOf(playtime: Record<string, AccountPlaytime | undefined>, accountId: string) {
  const entry = playtime[accountId]

  return entry?.status === 'ok' ? entry : null
}

export function buildCollection({
  accountIds,
  overviews,
  playtime,
}: {
  accountIds: Array<string>
  overviews: Record<string, AccountLibraryOverview | undefined>
  playtime: Record<string, AccountPlaytime | undefined>
}) {
  const games = new Map<string, CollectionGame>()
  const tools = new Set<string>()

  for (const accountId of accountIds) {
    const overview = overviews[accountId]

    if (overview?.status !== 'ok') {
      continue
    }

    const timed = playtimeOf(playtime, accountId)
    const seconds = timed ? secondsByApp(timed.entries) : null
    const achievements = new Map((timed?.achievements ?? []).map((game) => [game.sandboxId, game]))
    const own = libraryGames(overview.records)

    own.tools.forEach((tool) => tools.add(tool))

    for (const game of own.games) {
      const known = games.get(game.namespace)
      const owner: CollectionOwner = {
        accountId,
        acquiredAt: game.acquiredAt,
        seconds: seconds ? timeFor(game.appNames, seconds) : null,
        achievements: achievements.get(game.namespace) ?? null,
      }

      if (!known) {
        games.set(game.namespace, {
          namespace: game.namespace,
          title: game.title,
          art: game.art,
          appNames: game.appNames,
          owners: [owner],
          seconds: owner.seconds,
          acquiredAt: game.acquiredAt,
        })

        continue
      }

      known.owners.push(owner)
      known.appNames = [...new Set([...known.appNames, ...game.appNames])]
      known.art = known.art.tall ? known.art : game.art
      known.seconds =
        known.seconds === null && owner.seconds === null ? null : (known.seconds ?? 0) + (owner.seconds ?? 0)
      known.acquiredAt =
        [known.acquiredAt, game.acquiredAt].filter((date): date is string => date !== null).sort()[0] ?? null
    }
  }

  return { games: [...games.values()], tools: [...tools] }
}

export function sortCollection(games: Array<CollectionGame>, sort: CollectionSort) {
  return [...games].sort((a, b) => {
    if (sort === 'name') {
      return a.title.localeCompare(b.title)
    }

    if (sort === 'recent') {
      return (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? '') || a.title.localeCompare(b.title)
    }

    return (b.seconds ?? -1) - (a.seconds ?? -1) || a.title.localeCompare(b.title)
  })
}

/** The linked accounts whose library lists a sandbox — for a free game, the ones that have it already. */
export function accountsOwning(
  namespace: string,
  accountIds: Array<string>,
  overviews: Record<string, AccountLibraryOverview | undefined>
) {
  return accountIds.filter((accountId) =>
    overviews[accountId]?.records.some((record) => record.namespace === namespace)
  )
}

/** One mode's recorded time on each account, in account order. */
export function modeTimes(
  mode: Pick<LibraryMode, 'appIds'>,
  accountIds: Array<string>,
  playtime: Record<string, AccountPlaytime | undefined>
) {
  return accountIds.map((accountId) => {
    const timed = playtimeOf(playtime, accountId)

    return {
      accountId,
      seconds: timed ? timeFor(mode.appIds, secondsByApp(timed.entries)) : null,
      read: timed !== null,
    }
  })
}
