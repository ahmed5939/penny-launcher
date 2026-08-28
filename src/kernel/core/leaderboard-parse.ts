import {
  pennyDBLeaderboardMetrics,
  type PennyDBLeaderboardMetric,
  type PennyDBLeaderboardResponse,
  type PennyDBLeaderboardRow,
} from '../../services/endpoints/pennydb'

export const leaderboardMetrics = pennyDBLeaderboardMetrics

export type LeaderboardMetric = PennyDBLeaderboardMetric

export type LeaderboardRow = {
  /** PennyDB's internal profile id — not an Epic account id. */
  profileId: number
  rank: number
  displayName: string
  value: number
  previousValue: number | null
  delta: number | null
}

export type LeaderboardPayload = {
  errorMessage?: string
  metric: LeaderboardMetric
  rows: Array<LeaderboardRow>
}

const maxRows = 100
const metricSet = new Set<string>(leaderboardMetrics)

export function isLeaderboardMetric(
  value: unknown
): value is LeaderboardMetric {
  return typeof value === 'string' && metricSet.has(value)
}

/**
 * Names PennyDB can actually resolve. Empty strings and dumped JSON objects
 * (the API occasionally stores a failed lookup as the display name) would
 * open a 404.
 */
export function isLinkablePennyDBDisplayName(displayName: string) {
  const name = displayName.trim()

  return (
    name.length > 0 &&
    name.length <= 256 &&
    !name.startsWith('{') &&
    !name.startsWith('[')
  )
}

function asFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

export function parseLeaderboardRow(
  raw: PennyDBLeaderboardRow | null | undefined,
  index: number
): LeaderboardRow | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = asFiniteNumber(raw.current_value)

  if (value === null) {
    return null
  }

  const profileId = asFiniteNumber(raw.profile_id) ?? index + 1
  const rank = asFiniteNumber(raw.leaderboard_position) ?? index + 1
  const displayName =
    typeof raw.display_name === 'string' ? raw.display_name.trim() : ''

  /**
   * `epic_account_id` is intentionally unread. Live payloads currently echo
   * `profile_id` as a decimal string ("1", "125"), not a 32-char Epic id.
   * Treating it as authoritative would match the wrong local account.
   */
  void raw.epic_account_id

  return {
    profileId,
    rank,
    displayName: displayName || 'Unknown commander',
    value,
    previousValue: asFiniteNumber(raw.yesterday_value),
    delta: asFiniteNumber(raw.delta_1d),
  }
}

export function parseLeaderboardResponse(
  data: PennyDBLeaderboardResponse | null | undefined,
  metric: LeaderboardMetric
): LeaderboardPayload {
  const rows = Array.isArray(data?.rows) ? data.rows : []

  return {
    metric,
    rows: rows
      .slice(0, 500)
      .map((row, index) => parseLeaderboardRow(row, index))
      .filter((row): row is LeaderboardRow => row !== null)
      .slice(0, maxRows),
  }
}
