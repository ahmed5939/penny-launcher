import type { LibraryArt } from '../library/model'
import type { PlaytimeEntry } from './model'

import { pickArt } from '../library/model'

/**
 * Epic achievements — the store's, not Fortnite's.
 *
 * Epic keeps achievements per game "sandbox" (the catalogue namespace):
 * Hogwarts Legacy has 45 of them, Fortnite has none (its definitions come
 * back empty). Three reads cover it:
 *
 * - the player profile's `achievementsSummaries`: per game, how many an
 *   account has unlocked and for how much XP, with the game's name, art and
 *   totals — one read per account, on its own launcher token;
 * - a game's definitions: names, descriptions, icons, XP and how rare each
 *   is — public, the same for everyone;
 * - an account's unlocks in one game, with dates — its own token again.
 *
 * Hidden achievements come back with their real names and descriptions; the
 * store masks them until unlocked, and so does the dialog unless asked not to.
 */

export type GameAchievementSummary = {
  sandboxId: string
  title: string | null
  unlocked: number
  xp: number
  /** The game's totals, when Epic sent them. */
  total: number | null
  totalXp: number | null
  platinum: boolean
  art: LibraryArt
}

export type AchievementSummaries = {
  /** Who can see the account's Epic profile: "FRIENDS_OF_FRIENDS"… */
  visibility: string | null
  /** Null when the achievement service answered with an error. */
  games: Array<GameAchievementSummary> | null
}

export type AchievementDefinition = {
  name: string
  title: string
  description: string | null
  hidden: boolean
  xp: number
  /** Share of players who have it, 0–100. */
  rarity: number | null
  unlockedIcon: string | null
  lockedIcon: string | null
}

export type AchievementDefinitions = {
  total: number
  totalXp: number
  platinumRarity: number | null
  definitions: Array<AchievementDefinition>
}

export type PlayerUnlock = {
  unlockedAt: string | null
  /** 0–1. Only worth showing between the two. */
  progress: number | null
}

export type PlayerAchievements = {
  unlocks: Map<string, PlayerUnlock>
  platinum: boolean
}

export type AchievementRow = AchievementDefinition & {
  unlocked: boolean
  unlockedAt: string | null
  progress: number | null
}

export type GameAchievements = {
  accountId: string
  sandboxId: string
  title: string | null
  art: LibraryArt
  total: number
  totalXp: number
  unlocked: number
  unlockedXp: number
  platinum: boolean
  platinumRarity: number | null
  /** Unlocked first, newest first; then locked, most common first. */
  rows: Array<AchievementRow>
}

export type GameAchievementsResult =
  | { ok: true; data: GameAchievements }
  | { ok: false; error: string }

/** Achievement icons come from here, which the CSP allows. */
export const achievementIconHost = 'shared-static-prod.epicgames.com'

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function count(value: unknown) {
  const number = Number(value)

  return Number.isFinite(number) && number >= 0 ? number : null
}

function dig(body: unknown, ...path: Array<string>) {
  let current: unknown = record(body)?.data

  for (const key of path) {
    current = record(current)?.[key]
  }

  return current
}

function hasPlatinum(awards: unknown) {
  return (
    Array.isArray(awards) &&
    awards.some((award) => /platinum/i.test(text(record(award)?.awardType) ?? ''))
  )
}

export function achievementIconUrl(value: unknown) {
  const raw = text(value)

  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw)

    return url.protocol === 'https:' && url.hostname === achievementIconHost ? raw : null
  } catch {
    return null
  }
}

export function isSandboxId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
}

/** `PlayerProfile.playerProfile`: profile visibility and per-game summaries. */
export function parseAchievementSummaries(body: unknown): AchievementSummaries {
  const profile = record(dig(body, 'PlayerProfile', 'playerProfile'))
  const visibility = text(record(profile?.privacy)?.accessLevel)
  const summaries = record(profile?.achievementsSummaries)
  const data = summaries?.data

  if (!Array.isArray(data)) {
    return { visibility, games: null }
  }

  const games = data.flatMap((entry): Array<GameAchievementSummary> => {
    const game = record(entry)
    const sandboxId = text(game?.sandboxId)

    if (!game || !sandboxId) {
      return []
    }

    const totals = record(game.productAchievements)

    return [
      {
        sandboxId,
        title: text(record(game.product)?.name),
        unlocked: count(game.totalUnlocked) ?? 0,
        xp: count(game.totalXP) ?? 0,
        total: count(totals?.totalAchievements),
        totalXp: count(totals?.totalProductXP),
        platinum: hasPlatinum(game.playerAwards),
        art: pickArt(record(game.baseOfferForSandbox)?.keyImages),
      },
    ]
  })

  return { visibility, games }
}

/** A game's definitions, or null when it has none (Fortnite's come back empty). */
export function parseAchievementDefinitions(body: unknown): AchievementDefinitions | null {
  const product = record(dig(body, 'Achievement', 'productAchievementsRecordBySandbox'))
  const list = product?.achievements

  if (!Array.isArray(list) || list.length === 0) {
    return null
  }

  const definitions = list.flatMap((entry): Array<AchievementDefinition> => {
    const achievement = record(record(entry)?.achievement)
    const name = text(achievement?.name)

    if (!achievement || !name) {
      return []
    }

    return [
      {
        name,
        title:
          text(achievement.unlockedDisplayName) ?? text(achievement.lockedDisplayName) ?? name,
        description:
          text(achievement.unlockedDescription) ?? text(achievement.lockedDescription),
        hidden: achievement.hidden === true,
        xp: count(achievement.XP) ?? 0,
        rarity: count(record(achievement.rarity)?.percent),
        unlockedIcon: achievementIconUrl(achievement.unlockedIconLink),
        lockedIcon: achievementIconUrl(achievement.lockedIconLink),
      },
    ]
  })

  return {
    total: count(product?.totalAchievements) ?? definitions.length,
    totalXp:
      count(product?.totalProductXP) ?? definitions.reduce((sum, item) => sum + item.xp, 0),
    platinumRarity: count(record(product?.platinumRarity)?.percent),
    definitions,
  }
}

/** One account's unlocks in one game. No record at all is no unlocks. */
export function parsePlayerAchievements(body: unknown): PlayerAchievements {
  const records = dig(body, 'PlayerAchievement', 'playerAchievementGameRecordsBySandbox', 'records')
  const unlocks = new Map<string, PlayerUnlock>()
  let platinum = false

  for (const entry of Array.isArray(records) ? records : []) {
    const game = record(entry)

    platinum ||= hasPlatinum(game?.playerAwards)

    for (const item of Array.isArray(game?.playerAchievements) ? game.playerAchievements : []) {
      const achievement = record(record(item)?.playerAchievement)
      const name = text(achievement?.achievementName)

      if (!achievement || !name || achievement.unlocked !== true) {
        continue
      }

      const progress = count(achievement.progress)

      unlocks.set(name, {
        unlockedAt: text(achievement.unlockDate),
        progress: progress === null ? null : Math.min(progress, 1),
      })
    }
  }

  return { unlocks, platinum }
}

function time(iso: string | null) {
  const parsed = iso ? Date.parse(iso) : NaN

  return Number.isNaN(parsed) ? 0 : parsed
}

/** Definitions and unlocks, joined and in the order the dialog shows them. */
export function buildGameAchievements({
  accountId,
  definitions,
  player,
  sandboxId,
  summary,
}: {
  accountId: string
  definitions: AchievementDefinitions
  player: PlayerAchievements
  sandboxId: string
  summary: GameAchievementSummary | null
}): GameAchievements {
  const rows: Array<AchievementRow> = definitions.definitions.map((definition) => {
    const unlock = player.unlocks.get(definition.name)

    return {
      ...definition,
      unlocked: Boolean(unlock),
      unlockedAt: unlock?.unlockedAt ?? null,
      progress: unlock?.progress ?? null,
    }
  })

  rows.sort((a, b) => {
    if (a.unlocked !== b.unlocked) {
      return a.unlocked ? -1 : 1
    }

    if (a.unlocked) {
      return time(b.unlockedAt) - time(a.unlockedAt)
    }

    return (b.rarity ?? -1) - (a.rarity ?? -1) || a.title.localeCompare(b.title)
  })

  const unlocked = rows.filter((row) => row.unlocked)

  return {
    accountId,
    sandboxId,
    title: summary?.title ?? null,
    art: summary?.art ?? { tall: null, wide: null },
    total: definitions.total,
    totalXp: definitions.totalXp,
    unlocked: unlocked.length,
    unlockedXp: unlocked.reduce((sum, row) => sum + row.xp, 0),
    platinum: player.platinum || Boolean(summary?.platinum),
    platinumRarity: definitions.platinumRarity,
    rows,
  }
}

/** "17 of 45 achievements", or just the unlocked count when the total is unknown. */
export function achievementCaption(summary: GameAchievementSummary) {
  const of = summary.total ? ` of ${summary.total}` : ''
  const noun = (summary.total ?? summary.unlocked) === 1 ? 'achievement' : 'achievements'

  return `${summary.unlocked}${of} ${noun}${summary.platinum ? ' · Platinum' : ''}`
}

/** `FRIENDS_OF_FRIENDS` → "friends of friends". */
export function describeVisibility(accessLevel: string | null) {
  if (!accessLevel) {
    return null
  }

  const known: Record<string, string> = {
    PUBLIC: 'everyone',
    EVERYONE: 'everyone',
    FRIENDS: 'friends',
    FRIENDS_OF_FRIENDS: 'friends of friends',
    PRIVATE: 'only you',
  }

  return known[accessLevel] ?? accessLevel.toLowerCase().replaceAll('_', ' ')
}

export type OtherGameRow = {
  key: string
  title: string | null
  /** The app id, shown when there is no title. */
  artifactId: string | null
  art: LibraryArt
  seconds: number | null
  achievements: GameAchievementSummary | null
}

/**
 * The "Other Epic games" list: every played app outside Fortnite, each with
 * its game's achievements (joined on namespace = sandbox), then games with
 * achievements but no time recorded. A game with several apps (a game and
 * its DLC) carries its achievements on the most played one only.
 */
export function otherGameRows(
  entries: Array<PlaytimeEntry>,
  games: Array<GameAchievementSummary> | null
): Array<OtherGameRow> {
  const bySandbox = new Map((games ?? []).map((game) => [game.sandboxId, game]))
  const claimed = new Set<string>()
  const rows: Array<OtherGameRow> = []

  for (const entry of entries) {
    if (entry.namespace && bySandbox.has(entry.namespace)) {
      // Fortnite's own apps share the `fn` namespace; they claim it either way.
      if (entry.kind !== 'other') {
        claimed.add(entry.namespace)

        continue
      }

      if (!claimed.has(entry.namespace)) {
        claimed.add(entry.namespace)
        rows.push({
          key: entry.artifactId,
          title: entry.title ?? bySandbox.get(entry.namespace)?.title ?? null,
          artifactId: entry.artifactId,
          art: entry.art.tall ? entry.art : (bySandbox.get(entry.namespace)?.art ?? entry.art),
          seconds: entry.seconds,
          achievements: bySandbox.get(entry.namespace) ?? null,
        })

        continue
      }
    }

    if (entry.kind === 'other') {
      rows.push({
        key: entry.artifactId,
        title: entry.title,
        artifactId: entry.artifactId,
        art: entry.art,
        seconds: entry.seconds,
        achievements: null,
      })
    }
  }

  for (const game of games ?? []) {
    if (!claimed.has(game.sandboxId)) {
      rows.push({
        key: `sandbox:${game.sandboxId}`,
        title: game.title,
        artifactId: null,
        art: game.art,
        seconds: null,
        achievements: game,
      })
    }
  }

  return rows
}
