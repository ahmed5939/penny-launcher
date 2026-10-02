import type { LibraryArt } from '../library/model'
import type { GameAchievementSummary } from './achievements'
import type { AllPlatformsTime } from './stats'

import { pickArt } from '../library/model'

/**
 * Time played, as Epic records it.
 *
 * The Epic Games Launcher's playtime service keeps one running total per
 * launcher app an account has played — `Fortnite`, `Fortnite_Studio` (UEFN),
 * and every other Epic game, keyed by the launcher's app name. Fortnite's
 * modes have app names of their own (Save the World and LEGO Fortnite are
 * "content" items under it), and Epic keeps separate totals for those too.
 *
 * The totals carry no names. `Launcher.appBuilds` lists the apps an account
 * may install, each with its catalogue item, and that is where the titles
 * and the box art come from. An app with no build (a game no longer owned,
 * one with no Windows build) stays unnamed.
 *
 * Everything here is the parsing and the join, kept pure so it can be
 * tested against recorded replies.
 */

export const fortniteNamespace = 'fn'
export const fortniteAppName = 'Fortnite'
export const uefnAppName = 'Fortnite_Studio'

export type PlaytimeAppKind =
  /** Fortnite itself — every mode's time, as one launcher app. */
  | 'fortnite'
  /** A Fortnite mode with its own launcher app: Save the World, LEGO Fortnite. */
  | 'mode'
  /** Unreal Editor for Fortnite. */
  | 'uefn'
  /** Any other Epic game. */
  | 'other'

/** What `Launcher.appBuilds` says about one launcher app. */
export type AppInfo = {
  art: LibraryArt
  namespace: string | null
  title: string | null
}

export type PlaytimeTotal = {
  artifactId: string
  seconds: number
}

export type PlaytimeEntry = PlaytimeTotal & {
  art: LibraryArt
  kind: PlaytimeAppKind
  /** The catalogue namespace — the achievements' "sandbox". */
  namespace: string | null
  /** For display: "Save the World", not "Fortnite Save the World Content". */
  title: string | null
}

export type AccountPlaytime = {
  status: 'ok' | 'unknown'
  /** Most played first. */
  entries: Array<PlaytimeEntry>
  /** Epic achievements per game; null when they could not be read. */
  achievements: Array<GameAchievementSummary> | null
  /** Who can see the account's Epic profile, as Epic words it. */
  profileVisibility: string | null
  /**
   * Fortnite's own stats: Battle Royale and islands on every platform,
   * console included. Null when they could not be read.
   */
  allPlatforms: AllPlatformsTime | null
  checkedAt: string
  errorMessage?: string
}

export type AccountPlaytimePayload = {
  accounts: Record<string, AccountPlaytime>
  /** The last reply of a check, carrying every linked account. */
  complete: boolean
}

/**
 * Fortnite's own apps, for when `appBuilds` cannot be read. App names and
 * titles as the catalogue gave them on 2026-10-02; the box art is left to
 * the live reply.
 */
export const knownApps: Record<string, AppInfo> = {
  [fortniteAppName]: {
    title: 'Fortnite',
    namespace: fortniteNamespace,
    art: { tall: null, wide: null },
  },
  [uefnAppName]: {
    title: 'Unreal Editor for Fortnite',
    namespace: fortniteNamespace,
    art: { tall: null, wide: null },
  },
  aa31f9e94e844b299ca757d1d0b97a09: {
    title: 'Fortnite Save the World Content',
    namespace: fortniteNamespace,
    art: { tall: null, wide: null },
  },
  '94bc5ec13f8f438c97fdbef3e9019e27': {
    title: 'LEGO® Fortnite Content',
    namespace: fortniteNamespace,
    art: { tall: null, wide: null },
  },
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** `data.A.B…`, or undefined as soon as a step is missing. */
function dig(body: unknown, ...path: Array<string>) {
  let current: unknown = record(body)?.data

  for (const key of path) {
    current = record(current)?.[key]
  }

  return current
}

export type GraphQLProblem = { message: string; status: number | null }

/**
 * The `errors` of a GraphQL reply. Epic's gateway answers HTTP 200 when a
 * service behind it refused — the refusal is in here, with the service's
 * own status, and the field it was for is null.
 */
export function graphQLProblems(body: unknown): Array<GraphQLProblem> {
  const errors = record(body)?.errors

  if (!Array.isArray(errors)) {
    return []
  }

  return errors.flatMap((entry) => {
    const error = record(entry)

    if (!error) {
      return []
    }

    const status = Number(error.status ?? record(error.extensions)?.status)

    return [
      {
        message: text(error.message) ?? 'Unknown GraphQL error',
        status: Number.isInteger(status) && status > 0 ? status : null,
      },
    ]
  })
}

/**
 * `PlaytimeTracking.total`, or null when it did not come back — read the
 * problems for why. An account that has never played anything is an empty
 * list, not null. Seconds: see `formatPlaytime`.
 */
export function parsePlaytimeTotals(body: unknown): Array<PlaytimeTotal> | null {
  const total = dig(body, 'PlaytimeTracking', 'total')

  if (!Array.isArray(total)) {
    return null
  }

  const byApp = new Map<string, number>()

  for (const entry of total) {
    const row = record(entry)
    const artifactId = text(row?.artifactId)
    const seconds = Number(row?.totalTime)

    if (!artifactId || !Number.isFinite(seconds) || seconds < 0) {
      continue
    }

    // One row per app has been all Epic sends; a repeat is not added on top.
    byApp.set(artifactId, Math.max(byApp.get(artifactId) ?? 0, Math.round(seconds)))
  }

  return [...byApp].map(([artifactId, seconds]) => ({ artifactId, seconds }))
}

/** `Launcher.appBuilds`, by app name. Empty when it did not come back. */
export function parseAppBuilds(body: unknown): Record<string, AppInfo> {
  const builds = dig(body, 'Launcher', 'appBuilds')
  const apps: Record<string, AppInfo> = {}

  if (!Array.isArray(builds)) {
    return apps
  }

  for (const entry of builds) {
    const build = record(entry)
    const appName = text(build?.appName)
    const item = record(build?.catalogItem)

    if (!appName || apps[appName]) {
      continue
    }

    apps[appName] = {
      title: text(item?.title),
      namespace: text(build?.namespace) ?? text(item?.namespace),
      art: pickArt(item?.keyImages),
    }
  }

  return apps
}

/**
 * New knowledge over old, field by field, so an `appBuilds` reply that
 * names an app but has no art for it does not wipe art already known.
 */
export function mergeAppInfo(known: AppInfo | undefined, next: AppInfo): AppInfo {
  return {
    title: next.title ?? known?.title ?? null,
    namespace: next.namespace ?? known?.namespace ?? null,
    art: {
      tall: next.art.tall ?? known?.art.tall ?? null,
      wide: next.art.wide ?? known?.art.wide ?? null,
    },
  }
}

export function appKind(artifactId: string, info: AppInfo | undefined): PlaytimeAppKind {
  if (artifactId === fortniteAppName) {
    return 'fortnite'
  }

  if (artifactId === uefnAppName) {
    return 'uefn'
  }

  return info?.namespace === fortniteNamespace ? 'mode' : 'other'
}

/**
 * The name to show. A mode's catalogue title is the store's
 * ("Fortnite Save the World Content"); the game calls it "Save the World".
 * UEFN goes by its initials, which is also what fits under its box art.
 */
export function displayTitle(kind: PlaytimeAppKind, title: string | null) {
  if (kind === 'uefn') {
    return 'UEFN'
  }

  if (!title || kind !== 'mode') {
    return title
  }

  const trimmed = title
    .replace(/\s+content$/i, '')
    .replace(/^fortnite\s+(?=\S)/i, '')
    .trim()

  return trimmed || title
}

const kindOrder: Record<PlaytimeAppKind, number> = {
  fortnite: 0,
  mode: 1,
  uefn: 2,
  other: 3,
}

/** Totals joined to what is known of each app: Fortnite's first, then most played. */
export function describePlaytime(
  totals: Array<PlaytimeTotal>,
  apps: Record<string, AppInfo>
): Array<PlaytimeEntry> {
  return totals
    .map((total) => {
      const info = apps[total.artifactId] ?? knownApps[total.artifactId]
      const kind = appKind(total.artifactId, info)

      return {
        ...total,
        kind,
        namespace: info?.namespace ?? null,
        title: displayTitle(kind, info?.title ?? null),
        art: info?.art ?? { tall: null, wide: null },
      }
    })
    .sort(
      (a, b) =>
        kindOrder[a.kind] - kindOrder[b.kind] ||
        b.seconds - a.seconds ||
        a.artifactId.localeCompare(b.artifactId)
    )
}

/** App names in the totals that nothing known names yet. */
export function unnamedApps(totals: Array<PlaytimeTotal>, apps: Record<string, AppInfo>) {
  return totals
    .map((total) => total.artifactId)
    .filter((id) => !(apps[id]?.title ?? knownApps[id]?.title))
}

export function isFortniteEntry(entry: Pick<PlaytimeEntry, 'kind'>) {
  return entry.kind !== 'other'
}

/** Seconds on Fortnite itself — the figure that already covers every mode. */
export function fortniteSeconds(entries: Array<PlaytimeEntry>) {
  return entries.find((entry) => entry.kind === 'fortnite')?.seconds ?? 0
}

/**
 * Epic's `totalTime` is read as seconds. Epic does not say so, but it is
 * the only reading that fits: one account's Hogwarts Legacy total of
 * 114,189 is 31.7 hours as seconds and 79 days nonstop as minutes.
 *
 * Under an hour: minutes. Under a hundred: hours to one place. Past that:
 * whole hours, grouped for the locale.
 */
export function formatPlaytime(seconds: number, locale?: string) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 min'
  }

  if (seconds < 60) {
    return 'under a minute'
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min`
  }

  const hours = seconds / 3600

  if (hours < 100) {
    return `${(Math.floor(hours * 10) / 10).toLocaleString(locale, { maximumFractionDigits: 1 })} h`
  }

  return `${Math.floor(hours).toLocaleString(locale)} h`
}

/** "Could not read playtime (HTTP 403)." from a thrown request or a GraphQL problem. */
export function playtimeErrorMessage(status: number | null | undefined, fallback: string) {
  if (status === 403) {
    return 'Epic refused to share this account’s playtime (HTTP 403). Try again later.'
  }

  return status
    ? `Could not read playtime (HTTP ${status}). Try again later.`
    : `Could not read playtime (${fallback}). Try again later.`
}
