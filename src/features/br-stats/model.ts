/**
 * Battle Royale career stats, as Fortnite's own stats service reports them
 * to the account itself.
 *
 * The stats service (`statsproxy`) keeps one running total per metric, per
 * input device, per playlist, for every platform the account plays on —
 * console, mobile and PC alike. Keys look like
 * `br_placetop1_keyboardmouse_m0_playlist_defaultsolo`: the metric, the
 * input, a season marker (`m0`, lifetime), and the playlist. There are
 * dozens of playlists (solo/duo/trio/squad plus every limited-time mode), so
 * a career figure is the sum of a metric across all of them — kept here,
 * per input and overall.
 *
 * Save the World keeps no match stats, so an account that only plays it (or
 * has never played Battle Royale) has nothing here: that is `empty`, not an
 * error.
 *
 * Everything in this file is pure, so it can be tested against a recorded
 * reply. The matching live read is `kernel/core/br-stats.ts`.
 */

/** The input devices Epic splits stats by. */
export type BrInput = 'keyboardmouse' | 'gamepad' | 'touch'

/** Shown in this order; keyboard and mouse first, as the game does. */
export const brInputs: ReadonlyArray<BrInput> = ['keyboardmouse', 'gamepad', 'touch']

/**
 * The top-N placements Epic records besides the win (`placetop1`). Shown in
 * this order, smallest bracket first.
 */
export const topTiers = [3, 5, 6, 10, 12, 25] as const

const inputLabels: Record<BrInput, string> = {
  keyboardmouse: 'Keyboard and mouse',
  gamepad: 'Controller',
  touch: 'Touch',
}

export function inputLabel(input: BrInput) {
  return inputLabels[input]
}

/** One career line: a set of playlists summed, with the derived rates. */
export type BrStatLine = {
  wins: number
  matches: number
  kills: number
  /** `wins / matches`, 0..1; 0 when no matches. */
  winRate: number
  /**
   * `kills / (matches − wins)` — kills per death. When there are no deaths
   * (`matches === wins`, including a line with no matches at all) it is the
   * kill count itself, never a divide-by-zero.
   */
  kd: number
  /** Minutes played across the summed playlists. Surfaced by playtime too. */
  minutes: number
  /** Top-N placements by bracket, e.g. `{ 10: 42, 25: 310 }`. */
  top: Record<number, number>
}

/** A career broken out by input, with the all-inputs total. */
export type BrStatsSummary = {
  overall: BrStatLine
  byInput: Record<BrInput, BrStatLine>
  /** True when Epic returned no Battle Royale matches at all. */
  empty: boolean
}

/** One account's Battle Royale career, as the broadcast carries it. */
export type AccountBrStats = BrStatsSummary & {
  status: 'ok' | 'unknown'
  checkedAt: string
  errorMessage?: string
}

export type BrStatsPayload = {
  accounts: Record<string, AccountBrStats>
  /** The last reply of a check, carrying every linked account. */
  complete: boolean
}

/** A line while it is still being summed, before the rates are worked out. */
type RawLine = { wins: number; matches: number; kills: number; minutes: number; top: Record<number, number> }

function rawLine(): RawLine {
  return { wins: 0, matches: 0, kills: 0, minutes: 0, top: {} }
}

/** The rates are derived once, when the summing is done. */
function finalize(raw: RawLine): BrStatLine {
  const deaths = raw.matches - raw.wins

  return {
    wins: raw.wins,
    matches: raw.matches,
    kills: raw.kills,
    minutes: raw.minutes,
    winRate: raw.matches > 0 ? raw.wins / raw.matches : 0,
    // No deaths (a flawless line, or one with no matches) is kills, not NaN.
    kd: deaths > 0 ? raw.kills / deaths : raw.kills,
    top: raw.top,
  }
}

function isBrInput(input: string): input is BrInput {
  return input === 'keyboardmouse' || input === 'gamepad' || input === 'touch'
}

/**
 * The stats reply (`{ stats: { "br_…": number } }`) summed into a career.
 *
 * Every `br_<metric>_<input>_m0_playlist_<playlist>` key is added to the
 * overall line and, when the input is one we show, to that input's line.
 * Metrics we do not chart (score, players outlived, last modified) are
 * skipped; a non-matching or non-positive value is ignored.
 */
export function parseBrStats(body: unknown): BrStatsSummary {
  const stats = (body as { stats?: unknown } | null)?.stats
  const overall = rawLine()
  const byInput: Record<BrInput, RawLine> = {
    keyboardmouse: rawLine(),
    gamepad: rawLine(),
    touch: rawLine(),
  }

  if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
    for (const [key, value] of Object.entries(stats as Record<string, unknown>)) {
      // br_<metric>_<input>_m0_playlist_<playlist>
      const match = /^br_([a-z0-9]+)_([a-z]+)_m0_playlist_.+$/.exec(key)
      const amount = Number(value)

      if (!match || !Number.isFinite(amount) || amount <= 0) {
        continue
      }

      const [, metric, input] = match
      // The overall line counts every input; an unknown input still totals here.
      const lines = isBrInput(input) ? [overall, byInput[input]] : [overall]

      for (const line of lines) {
        if (metric === 'matchesplayed') {
          line.matches += amount
        } else if (metric === 'kills') {
          line.kills += amount
        } else if (metric === 'minutesplayed') {
          line.minutes += amount
        } else if (metric === 'placetop1') {
          line.wins += amount
        } else if (metric.startsWith('placetop')) {
          const tier = Number(metric.slice('placetop'.length))

          if (Number.isInteger(tier)) {
            line.top[tier] = (line.top[tier] ?? 0) + amount
          }
        }
        // Any other metric (score, playersoutlived, lastmodified) is not charted.
      }
    }
  }

  return {
    overall: finalize(overall),
    byInput: {
      keyboardmouse: finalize(byInput.keyboardmouse),
      gamepad: finalize(byInput.gamepad),
      touch: finalize(byInput.touch),
    },
    empty: overall.matches === 0,
  }
}

/** The input lines with matches to show, in display order. */
export function inputLines(summary: BrStatsSummary) {
  return brInputs
    .map((input) => ({ input, label: inputLabel(input), line: summary.byInput[input] }))
    .filter((entry) => entry.line.matches > 0)
}

/** A line's top placements as rows, smallest bracket first, zeros dropped. */
export function topPlacements(line: BrStatLine) {
  return topTiers.flatMap((tier) => {
    const value = line.top[tier] ?? 0

    return value > 0 ? [{ tier, value }] : []
  })
}

/** "12%" or "1.4%" — one decimal only under ten per cent, and "0%" for none. */
export function formatWinRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return '0%'
  }

  const pct = rate * 100

  return pct >= 10 ? `${Math.round(pct)}%` : `${Math.floor(pct * 10) / 10}%`
}

/** K/D to two places: "2.74", "9.00", "0.00". */
export function formatKd(kd: number) {
  return Number.isFinite(kd) && kd > 0 ? kd.toFixed(2) : '0.00'
}

/** A whole-count figure grouped for the locale: "1,234". */
export function formatCount(value: number, locale?: string) {
  return (Number.isFinite(value) ? Math.round(value) : 0).toLocaleString(locale)
}
