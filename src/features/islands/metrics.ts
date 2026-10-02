/**
 * Epic's public ecosystem API, normalised.
 *
 * `api.fortnite.com/ecosystem/v1` answers any creator island code with its
 * metadata and three resolutions of figures, no sign-in and no Cloudflare.
 * Every metric is an array of `{ value, timestamp }`; the bucket still being
 * counted comes back as a trailing `null`, and an hour Epic lost comes back
 * as a `null` in the middle. The first is dropped here; the second is kept,
 * because a gap drawn as a gap is honest and a gap drawn as a zero is not.
 *
 * Shared by the main process and the page: no Electron, no Node.
 */

export const metricNames = [
  'peakCCU',
  'uniquePlayers',
  'plays',
  'minutesPlayed',
  'favorites',
  'recommendations',
  'averageMinutesPerPlayer',
] as const

export type MetricName = (typeof metricNames)[number]

export type MetricPoint = { t: string; value: number | null }

export type MetricSeries = Array<MetricPoint>

export type MetricSet = Record<MetricName, MetricSeries>

export type IslandMetadata = {
  title: string | null
  creatorCode: string | null
  /** "UEFN" or "Fortnite Creative". */
  createdIn: string | null
  tags: Array<string>
}

export type Retention = { d1: number | null; d7: number | null }

export type IslandMetricsPayload = {
  code: string
  status: 'ok' | 'error'
  /** ISO. Also the "now" every derived figure was chosen against. */
  fetchedAt: string
  island: IslandMetadata | null
  /** About the last 24 hours, one bucket an hour. */
  hour: MetricSet
  /** The last few days, one bucket a day (UTC). */
  day: MetricSet
  /** For the same day `dayFigures` picks. Fractions, 0–1. */
  retention: Retention | null
  errorMessage?: string
}

const dayMs = 24 * 60 * 60 * 1000

const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const timestamp = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null

/** Sorted, de-duplicated, trailing nulls dropped, inner nulls kept as gaps. */
export function normaliseSeries(raw: unknown): MetricSeries {
  if (!Array.isArray(raw)) {
    return []
  }

  const byTime = new Map<string, MetricPoint>()

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const t = timestamp((entry as { timestamp?: unknown }).timestamp)

    if (t) {
      byTime.set(t, { t, value: finite((entry as { value?: unknown }).value) })
    }
  }

  const series = [...byTime.values()].sort(
    (a, b) => Date.parse(a.t) - Date.parse(b.t)
  )

  while (series.length > 0 && series[series.length - 1].value === null) {
    series.pop()
  }

  return series
}

export function normaliseMetricSet(raw: unknown): MetricSet {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  return Object.fromEntries(
    metricNames.map((name) => [name, normaliseSeries(source[name])])
  ) as MetricSet
}

export function emptyMetricSet(): MetricSet {
  return normaliseMetricSet(null)
}

export function normaliseIsland(raw: unknown): IslandMetadata | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const island = raw as Record<string, unknown>
  const text = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null

  return {
    title: text(island.title),
    creatorCode: text(island.creatorCode),
    createdIn: text(island.createdIn),
    tags: Array.isArray(island.tags)
      ? island.tags
          .map(text)
          .filter((tag): tag is string => tag !== null)
          .slice(0, 20)
      : [],
  }
}

/** The newest point that has a value, if any. */
export function latestValue(series: ReadonlyArray<MetricPoint>) {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (series[index].value !== null) {
      return series[index] as { t: string; value: number }
    }
  }

  return null
}

/**
 * Which daily bucket to quote. The newest one is usually today, still being
 * counted, so the newest *finished* day is preferred and today is only used
 * — and flagged — when it is all there is.
 */
export function pickDay(day: MetricSet, now: number) {
  const times = [
    ...new Set(
      metricNames.flatMap((name) =>
        day[name].filter((point) => point.value !== null).map((point) => point.t)
      )
    ),
  ].sort((a, b) => Date.parse(a) - Date.parse(b))

  if (times.length === 0) {
    return null
  }

  const finished = times.filter((t) => Date.parse(t) + dayMs <= now)

  return finished.length > 0
    ? { t: finished[finished.length - 1], partial: false }
    : { t: times[times.length - 1], partial: true }
}

export function dayFigures(day: MetricSet, now: number) {
  const chosen = pickDay(day, now)

  if (!chosen) {
    return null
  }

  const at = (name: MetricName) =>
    day[name].find((point) => point.t === chosen.t)?.value ?? null

  return {
    ...chosen,
    uniquePlayers: at('uniquePlayers'),
    plays: at('plays'),
    minutesPlayed: at('minutesPlayed'),
    favorites: at('favorites'),
    recommendations: at('recommendations'),
    averageMinutesPerPlayer: at('averageMinutesPerPlayer'),
    peakCCU: at('peakCCU'),
  }
}

/**
 * Retention for the day `pickDay` chose, so the dialog never pairs one day's
 * plays with another day's retention. Falls back to the newest stated value.
 */
export function pickRetention(
  raw: unknown,
  day: MetricSet,
  now: number
): Retention | null {
  if (!Array.isArray(raw)) {
    return null
  }

  const fraction = (value: unknown) => {
    const number = finite(value)

    return number !== null && number >= 0 && number <= 1 ? number : null
  }
  const points = raw
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === 'object')
    )
    .map((entry) => ({
      t: timestamp(entry.timestamp),
      d1: fraction(entry.d1),
      d7: fraction(entry.d7),
    }))
    .filter((point) => point.t && (point.d1 !== null || point.d7 !== null))
    .sort((a, b) => Date.parse(a.t!) - Date.parse(b.t!))

  if (points.length === 0) {
    return null
  }

  const chosen = pickDay(day, now)
  const match = chosen ? points.find((point) => point.t === chosen.t) : null
  const point = match ?? points[points.length - 1]

  return { d1: point.d1, d7: point.d7 }
}

/** `0.34` → "34%". */
export function formatPercent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

/** Minutes played run to the millions; hours read better past a few thousand. */
export function formatMinutes(value: number | null) {
  if (value === null) {
    return '—'
  }

  return value >= 10_000
    ? `${Math.round(value / 60).toLocaleString('en-GB')} hours`
    : `${Math.round(value).toLocaleString('en-GB')} minutes`
}
