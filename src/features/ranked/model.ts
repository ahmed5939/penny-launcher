/**
 * Competitive rank, as Fortnite's Habanero service reports it to the account
 * itself.
 *
 * A "track" is one ranked mode for one season — Battle Royale (Build), Zero
 * Build, Reload, OG, Ballistic, Rocket Racing. Each is identified by a
 * `trackguid` and a `rankingType`. The account's progress on it is a division
 * (0–17, Bronze I up to Unreal) with a 0–1 bar toward the next division.
 * Unreal is the top: it has no bar — it has a ladder position instead
 * (`currentPlayerRanking`, the "#1234"). A division below zero means the
 * account has not placed on that track this season.
 *
 * Everything here is parsing and labelling, kept pure so it can be tested
 * against recorded replies.
 */

/** `rankingType` → the name the game shows. Unknown ids are humanized. */
export const rankingTypeLabels: Record<string, string> = {
  'ranked-br': 'Battle Royale (Build)',
  'ranked-zb': 'Zero Build',
  'ranked-br-combined': 'BR Combined',
  'delmar-competitive': 'Rocket Racing',
  ranked_blastberry_build: 'Reload (Build)',
  ranked_blastberry_nobuild: 'Reload (Zero Build)',
  'ranked-blastberry-combined': 'Reload Combined',
  'ranked-feral': 'Ballistic',
  'ranked-figment-build': 'OG (Build)',
  'ranked-figment-nobuild': 'OG (Zero Build)',
}

/** Display order: the main modes first, then Reload, OG, Ballistic, Racing. */
const rankingTypeOrder = [
  'ranked-br',
  'ranked-zb',
  'ranked-br-combined',
  'ranked_blastberry_build',
  'ranked_blastberry_nobuild',
  'ranked-blastberry-combined',
  'ranked-figment-build',
  'ranked-figment-nobuild',
  'ranked-feral',
  'delmar-competitive',
]

/**
 * The name for a `rankingType`. An id nothing names is humanized — the
 * `ranked` prefix dropped, the rest title-cased — so a mode added after this
 * ships ("ranked-foo-build" → "Foo Build") still reads as something.
 */
export function rankingTypeLabel(rankingType: string): string {
  const known = rankingTypeLabels[rankingType]

  if (known) {
    return known
  }

  const words = rankingType
    .replace(/^ranked[-_]?/i, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return words || rankingType
}

/** The eighteen rank tiers, by division index (0 = Bronze I, 17 = Unreal). */
export const rankTierNames = [
  'Bronze I',
  'Bronze II',
  'Bronze III',
  'Silver I',
  'Silver II',
  'Silver III',
  'Gold I',
  'Gold II',
  'Gold III',
  'Platinum I',
  'Platinum II',
  'Platinum III',
  'Diamond I',
  'Diamond II',
  'Diamond III',
  'Elite',
  'Champion',
  'Unreal',
] as const

/** A named accent per tier group, for the colour bar beside the tier. */
const groupColors: Record<string, string> = {
  Bronze: '#b08d57',
  Silver: '#a7b1c2',
  Gold: '#e8b73a',
  Platinum: '#36c6c6',
  Diamond: '#58a6ff',
  Elite: '#7a60c9',
  Champion: '#e14f8a',
  Unreal: '#f0c24b',
}

export type RankTier = {
  /** Division index, 0–17. */
  index: number
  /** "Gold II", "Elite", "Unreal". */
  name: string
  /** "Gold", "Elite", "Unreal". */
  group: string
  /** "II", or null for the single-division tiers (Elite, Champion, Unreal). */
  roman: string | null
  /** The group's accent colour. */
  color: string
}

/**
 * The tier for a division, or null when the account has not placed (a
 * division below zero, or an id Epic has not sent before).
 */
export function rankTier(division: number | null | undefined): RankTier | null {
  if (
    typeof division !== 'number' ||
    !Number.isInteger(division) ||
    division < 0 ||
    division >= rankTierNames.length
  ) {
    return null
  }

  const name = rankTierNames[division]
  const space = name.lastIndexOf(' ')
  const group = space === -1 ? name : name.slice(0, space)
  const roman = space === -1 ? null : name.slice(space + 1)

  return {
    index: division,
    name,
    group,
    roman,
    color: groupColors[group] ?? '#9aa7b8',
  }
}

export type RankedTrackProgress = {
  trackguid: string
  rankingType: string
  /** 0–17, or -1 when the account has not placed. */
  currentDivision: number
  highestDivision: number
  /** 0–1 toward the next division. */
  promotionProgress: number
  /** The ladder position, set only in Unreal. */
  currentPlayerRanking: number | null
  lastUpdated: string | null
}

export type RankedTrackMeta = {
  trackguid: string
  rankingType: string
  beginTime: string | null
  endTime: string | null
  season: number | null
}

export type RankedTrack = {
  trackguid: string
  rankingType: string
  /** "Battle Royale (Build)". */
  label: string
  /** The current tier, or null when not placed this season. */
  tier: RankTier | null
  /** The best tier reached this season, for the "Highest …" line. */
  highestTier: RankTier | null
  /** 0–1 toward the next division. */
  promotionProgress: number
  /** The bar is hidden in Unreal (no next division) and when not placed. */
  showProgress: boolean
  /** The Unreal ladder position, "#1234", or null. */
  ranking: number | null
  season: number | null
  lastUpdated: string | null
}

export type AccountRanked = {
  status: 'ok' | 'unknown'
  /** The account's active tracks, in mode order. */
  tracks: Array<RankedTrack>
  /** The current competitive season, for the panel's heading. */
  season: number | null
  checkedAt: string
  errorMessage?: string
}

export type AccountRankedPayload = {
  accounts: Record<string, AccountRanked>
  /** The last reply of a check, carrying every linked account. */
  complete: boolean
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function finiteNumber(value: unknown) {
  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

/**
 * `GET /trackprogress/{accountId}`, an array of track rows, or null when the
 * reply was not an array (a refusal is read by the caller for its status). An
 * account that has never played ranked is an empty list, not null.
 */
export function parseTrackProgress(body: unknown): Array<RankedTrackProgress> | null {
  if (!Array.isArray(body)) {
    return null
  }

  const rows: Array<RankedTrackProgress> = []

  for (const entry of body) {
    const row = record(entry)
    const trackguid = text(row?.trackguid)
    const rankingType = text(row?.rankingType)

    if (!trackguid || !rankingType) {
      continue
    }

    const ranking = finiteNumber(row?.currentPlayerRanking)

    rows.push({
      trackguid,
      rankingType,
      currentDivision: Math.trunc(finiteNumber(row?.currentDivision) ?? -1),
      highestDivision: Math.trunc(finiteNumber(row?.highestDivision) ?? -1),
      promotionProgress: clamp01(finiteNumber(row?.promotionProgress) ?? 0),
      currentPlayerRanking: ranking !== null && ranking > 0 ? Math.trunc(ranking) : null,
      lastUpdated: text(row?.lastUpdated),
    })
  }

  return rows
}

/**
 * `GET /tracks/query`, by `trackguid`. Tolerant of the two shapes seen — a
 * bare array, or `{ tracks: [...] }` — and empty for anything else, since the
 * labels fall back to the rankingType and only the season heading is lost.
 */
export function parseTracks(body: unknown): Record<string, RankedTrackMeta> {
  const list = Array.isArray(body)
    ? body
    : Array.isArray(record(body)?.tracks)
      ? (record(body)!.tracks as Array<unknown>)
      : []
  const tracks: Record<string, RankedTrackMeta> = {}

  for (const entry of list) {
    const row = record(entry)
    const trackguid = text(row?.trackguid)

    if (!trackguid || tracks[trackguid]) {
      continue
    }

    tracks[trackguid] = {
      trackguid,
      rankingType: text(row?.rankingType) ?? '',
      beginTime: text(row?.beginTime),
      endTime: text(row?.endTime),
      season: finiteNumber(row?.season),
    }
  }

  return tracks
}

function rankingTypeRank(rankingType: string) {
  const index = rankingTypeOrder.indexOf(rankingType)

  return index === -1 ? rankingTypeOrder.length : index
}

/** Progress rows joined to the tracks' labels and season, in mode order. */
export function describeRanked(
  progress: Array<RankedTrackProgress>,
  tracks: Record<string, RankedTrackMeta> = {}
): Array<RankedTrack> {
  return progress
    .map((entry) => {
      const meta = tracks[entry.trackguid]
      const tier = rankTier(entry.currentDivision)
      const isUnreal = tier?.name === 'Unreal'

      return {
        trackguid: entry.trackguid,
        rankingType: entry.rankingType,
        label: rankingTypeLabel(entry.rankingType),
        tier,
        highestTier: rankTier(entry.highestDivision),
        promotionProgress: entry.promotionProgress,
        showProgress: tier !== null && !isUnreal,
        ranking: isUnreal ? entry.currentPlayerRanking : null,
        season: meta?.season ?? null,
        lastUpdated: entry.lastUpdated,
      }
    })
    .sort(
      (a, b) =>
        rankingTypeRank(a.rankingType) - rankingTypeRank(b.rankingType) ||
        a.label.localeCompare(b.label)
    )
}

/** The newest season among the active tracks, for the panel's heading. */
export function currentSeason(tracks: Record<string, RankedTrackMeta>): number | null {
  const seasons = Object.values(tracks)
    .map((track) => track.season)
    .filter((season): season is number => typeof season === 'number')

  return seasons.length > 0 ? Math.max(...seasons) : null
}

/**
 * The account's best current rank across its tracks, for the comparison — the
 * highest division, and within a tie the one furthest toward promotion. Null
 * when the account has not placed on any track.
 */
export function peakTrack(tracks: Array<RankedTrack>): RankedTrack | null {
  return tracks.reduce<RankedTrack | null>((best, track) => {
    if (!track.tier || !isPlacedTrack(track)) {
      return best
    }

    if (!best || !best.tier || track.tier.index !== best.tier.index) {
      return !best || !best.tier || track.tier.index > best.tier.index ? track : best
    }

    return track.promotionProgress > best.promotionProgress ? track : best
  }, null)
}

/**
 * Whether the account has actually touched this track — not an untouched
 * Bronze I. The service hands back a track per season/split of every mode, so
 * most are Bronze I at 0%; those are noise, not ranks.
 */
export function isPlacedTrack(track: RankedTrack): boolean {
  return (
    (track.tier?.index ?? 0) > 0 ||
    track.promotionProgress > 0 ||
    track.ranking !== null ||
    (track.highestTier?.index ?? 0) > 0
  )
}

/** Best of two tracks: played over untouched, higher tier, nearer promotion, newer. */
function betterTrack(a: RankedTrack, b: RankedTrack): boolean {
  const placed = Number(isPlacedTrack(a)) - Number(isPlacedTrack(b))
  if (placed !== 0) {
    return placed > 0
  }

  const tier = (a.tier?.index ?? -1) - (b.tier?.index ?? -1)
  if (tier !== 0) {
    return tier > 0
  }

  if (a.promotionProgress !== b.promotionProgress) {
    return a.promotionProgress > b.promotionProgress
  }

  return (a.lastUpdated ?? '') > (b.lastUpdated ?? '')
}

/**
 * One track per ranking type — the account's best on that mode — so the many
 * past seasons and splits the service returns for the same mode collapse into
 * a single row. Order is preserved (`rankingTypeOrder`, then label).
 */
export function collapseTracks(tracks: Array<RankedTrack>): Array<RankedTrack> {
  const byType = new Map<string, RankedTrack>()

  for (const track of tracks) {
    const current = byType.get(track.rankingType)

    if (!current || betterTrack(track, current)) {
      byType.set(track.rankingType, track)
    }
  }

  return [...byType.values()].sort(
    (a, b) =>
      rankingTypeRank(a.rankingType) - rankingTypeRank(b.rankingType) ||
      a.label.localeCompare(b.label)
  )
}

/** The promotion bar as a whole percent, "42%". */
export function formatPromotion(progress: number): string {
  return `${Math.round(clamp01(progress) * 100)}%`
}

/** "Could not read ranked progress (HTTP 403)." from a thrown request. */
export function rankedErrorMessage(status: number | null | undefined): string {
  if (status === 403) {
    return 'Epic refused to share this account’s ranked progress (HTTP 403). Try again later.'
  }

  return status
    ? `Could not read ranked progress (HTTP ${status}). Try again later.`
    : 'Could not read ranked progress. Try again later.'
}
