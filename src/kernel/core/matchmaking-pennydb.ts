import type { PennyDBProfileResponse } from '../../services/endpoints/pennydb'
import type { MatchmakingPennyDBMission } from '../../types/data/advanced-mode/matchmaking'

import { World } from '../../config/constants/fortnite/world-info'

/**
 * PennyDB names zones the way the game does; Epic's session carries theater
 * ids. Mapping one to the other lets the card reuse the zone's colour, letter
 * and key art even when Epic returns no session.
 */
const theaterIdsByZone: Record<string, World> = {
  stonewood: World.Stonewood,
  plankerton: World.Plankerton,
  'canny valley': World.CannyValley,
  'twine peaks': World.TwinePeaks,
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : null
}

function names(value: unknown) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value)
      : []

  return entries
    .map((entry) =>
      text(
        entry && typeof entry === 'object' && 'name' in entry
          ? entry.name
          : entry
      )
    )
    .filter((entry): entry is string => entry !== null)
}

/** "4:57 mins", "1:02:10 mins" -> seconds. */
export function parsePennyDBSessionSeconds(value: unknown) {
  const match = text(value)?.match(/^(\d+(?::\d{1,2}){0,2})/)

  if (!match) {
    return null
  }

  return match[1]
    .split(':')
    .reduce((total, part) => total * 60 + Number(part), 0)
}

/**
 * Narrows `what_mission_data` from a PennyDB profile. The site answers
 * "Player is not currently in a mission" (with no other fields) when idle,
 * so a mission only counts when it comes with a zone or players.
 */
export function parsePennyDBMission(
  data: PennyDBProfileResponse['what_mission_data'] | undefined,
  now = Date.now()
): MatchmakingPennyDBMission | null {
  const name = text(data?.mission_playing)
  const zone = text(data?.zone)
  const players = names(data?.players)

  if (!data || !name || (!zone && players.length === 0)) {
    return null
  }

  const difficulty = Number.parseInt(`${data.difficulty ?? ''}`, 10)
  const seconds = parsePennyDBSessionSeconds(data.session_time)

  return {
    name,
    zone,
    theaterId: zone ? theaterIdsByZone[zone.toLowerCase()] ?? null : null,
    difficulty: Number.isFinite(difficulty) ? difficulty : null,
    startedAt:
      seconds === null ? null : new Date(now - seconds * 1_000).toISOString(),
    launched: data.launched_mission === true,
    players,
    rewards: names(data.mission_rewards),
    alerts: names(data.mission_alerts),
  }
}
