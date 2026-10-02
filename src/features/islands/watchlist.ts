import { formatPlayers, isCreatorIslandCode } from './model'

/**
 * Islands the user watches, and when to tell them.
 *
 * Kept in `islands-watchlist.json` and checked every ten minutes by the main
 * process against the ecosystem API's ten-minute peak. An alert fires when
 * an island *crosses* its threshold, not every time it is above it, and only
 * re-arms once the count has fallen clearly back (below 90%), so an island
 * hovering on the line does not toast every check.
 *
 * Shared by the main process and the page: no Electron, no Node.
 */

export type WatchedIsland = {
  code: string
  title: string
  /** Players that make it "busy"; null watches without alerting. */
  threshold: number | null
  addedAt: string
  /** The latest ten-minute peak the API stated. */
  lastPeakCcu: number | null
  lastCheckedAt: string | null
  /** Last seen at or over the threshold — the alert has fired and is not re-armed yet. */
  above: boolean
}

export type Watchlist = {
  version: 1
  islands: Array<WatchedIsland>
}

export type WatchlistUpdate =
  | { action: 'add'; code: string; title?: string }
  | { action: 'remove'; code: string }
  | { action: 'threshold'; code: string; threshold: number | null }

export type WatchlistPayload = {
  /** `imageUrl` is whatever Discover last showed for the island; not stored. */
  islands: Array<WatchedIsland & { imageUrl: string | null }>
  errorMessage?: string
}

/** Each watched island costs one request per check; keep the list a watchlist. */
export const watchlistLimit = 50

export const thresholdLimits = { min: 1, max: 10_000_000 } as const

/** Back below this share of the threshold before it can alert again. */
export const rearmRatio = 0.9

/** The steps the page offers. Player counts span four orders of magnitude. */
export const thresholdSteps = [
  50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
  250_000,
] as const

export function emptyWatchlist(): Watchlist {
  return { version: 1, islands: [] }
}

const text = (value: unknown, max = 200) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null

const isoOrNull = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null

export function validThreshold(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= thresholdLimits.min &&
    value <= thresholdLimits.max
    ? value
    : null
}

/** A file from an older build, or edited by hand, loads as far as it makes sense. */
export function normaliseWatchlist(raw: unknown): Watchlist {
  const list =
    raw &&
    typeof raw === 'object' &&
    (raw as { version?: unknown }).version === 1 &&
    Array.isArray((raw as { islands?: unknown }).islands)
      ? ((raw as { islands: Array<unknown> }).islands)
      : []
  const seen = new Set<string>()
  const islands: Array<WatchedIsland> = []

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const island = entry as Record<string, unknown>
    const code = typeof island.code === 'string' ? island.code.trim() : ''

    if (!isCreatorIslandCode(code) || seen.has(code)) {
      continue
    }

    seen.add(code)

    const peak = island.lastPeakCcu

    islands.push({
      code,
      title: text(island.title) ?? code,
      threshold: validThreshold(island.threshold),
      addedAt: isoOrNull(island.addedAt) ?? new Date(0).toISOString(),
      lastPeakCcu:
        typeof peak === 'number' && Number.isFinite(peak) && peak >= 0
          ? Math.round(peak)
          : null,
      lastCheckedAt: isoOrNull(island.lastCheckedAt),
      above: island.above === true,
    })
  }

  return { version: 1, islands: islands.slice(0, watchlistLimit) }
}

/**
 * Apply one change from the page. Returns the list unchanged with an error
 * for anything the page should not have been able to send.
 */
export function applyWatchlistUpdate(
  list: Watchlist,
  update: WatchlistUpdate,
  now: number
): { list: Watchlist; changed: boolean; error?: string } {
  const code = typeof update?.code === 'string' ? update.code.trim() : ''

  if (!isCreatorIslandCode(code)) {
    return { list, changed: false, error: 'That is not an island code.' }
  }

  const existing = list.islands.find((island) => island.code === code)

  if (update.action === 'add') {
    if (existing) {
      return { list, changed: false }
    }

    if (list.islands.length >= watchlistLimit) {
      return {
        list,
        changed: false,
        error: `You can watch up to ${watchlistLimit} islands. Remove one first.`,
      }
    }

    return {
      list: {
        ...list,
        islands: [
          ...list.islands,
          {
            code,
            title: text(update.title) ?? code,
            threshold: null,
            addedAt: new Date(now).toISOString(),
            lastPeakCcu: null,
            lastCheckedAt: null,
            above: false,
          },
        ],
      },
      changed: true,
    }
  }

  if (!existing) {
    return { list, changed: false }
  }

  if (update.action === 'remove') {
    return {
      list: {
        ...list,
        islands: list.islands.filter((island) => island.code !== code),
      },
      changed: true,
    }
  }

  if (update.action === 'threshold') {
    const threshold =
      update.threshold === null ? null : validThreshold(update.threshold)

    if (update.threshold !== null && threshold === null) {
      return { list, changed: false, error: 'Choose a player count to alert at.' }
    }

    return {
      list: {
        ...list,
        islands: list.islands.map((island) =>
          island.code === code
            ? {
                ...island,
                threshold,
                /*
                 * Armed against the count the user can see beside the
                 * picker: setting 1,000 on an island already at 5,000 should
                 * not toast at once — the alert is for the *next* rush.
                 */
                above:
                  threshold !== null &&
                  island.lastPeakCcu !== null &&
                  island.lastPeakCcu >= threshold,
              }
            : island
        ),
      },
      changed: true,
    }
  }

  return { list, changed: false }
}

/**
 * One check's verdict. Fires on the way up through the threshold; re-arms
 * only below `rearmRatio` of it. No reading keeps the previous state.
 */
export function evaluateWatch(
  state: { threshold: number | null; above: boolean },
  peak: number | null
): { above: boolean; fire: boolean } {
  if (state.threshold === null) {
    return { above: false, fire: false }
  }

  if (peak === null) {
    return { above: state.above, fire: false }
  }

  if (!state.above && peak >= state.threshold) {
    return { above: true, fire: true }
  }

  if (state.above && peak < state.threshold * rearmRatio) {
    return { above: false, fire: false }
  }

  return { above: state.above, fire: false }
}

export function busyNotification(island: { code: string; title: string }, peak: number) {
  return {
    title: `${island.title} is busy`,
    body: `${formatPlayers(peak)} players in the last 10 minutes · ${island.code}`,
  }
}

export function thresholdLabel(threshold: number | null) {
  return threshold === null
    ? 'No alert'
    : `Alert at ${formatPlayers(threshold)} players`
}
