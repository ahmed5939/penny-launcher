/**
 * Time played on every platform, from Fortnite's own stats.
 *
 * The launcher's playtime records only see a PC with the Epic Games
 * Launcher. Fortnite's stats service counts minutes played wherever the
 * account plays — console, mobile, PC — split by input device, in every
 * playlist that keeps stats: Battle Royale, Creative and other islands.
 * Save the World keeps none, so its time is in neither figure from here.
 *
 * Keys look like `br_minutesplayed_gamepad_m0_playlist_defaultsolo`; the
 * same shape carries matches, wins (`placetop1`), kills and players outlived.
 */

export type InputTime = { input: string; label: string; minutes: number }

export type ModeCareer = { key: string; label: string; minutes: number; matches: number; wins: number }

export type SquadSize = 'solo' | 'duo' | 'trio' | 'squad'

export type SquadCareer = { size: SquadSize; label: string; matches: number; wins: number; kills: number }

export type AllPlatformsTime = {
  minutes: number
  /** Most played first. */
  byInput: Array<InputTime>
  matches: number
  wins: number
  kills: number
  /** Opponents finished below — Epic's "players outlived". */
  outlived: number
  /** Playlists grouped into the modes players know, most played first. */
  modes: Array<ModeCareer>
  /** Matches, wins and kills by squad size, where the playlist says it. */
  squads: Array<SquadCareer>
}

const squadLabels: Record<SquadSize, string> = { solo: 'Solo', duo: 'Duos', trio: 'Trios', squad: 'Squads' }

/** A playlist's squad size from its name, when it says one: `defaultsolo`, `habaneroduo`, `trios`. */
export function squadOfPlaylist(playlist: string): SquadSize | null {
  const found = /(solo|duo|trio|squad)/.exec(playlist)

  return found ? (found[1] as SquadSize) : null
}

/**
 * Playlist codenames into the modes players call them by. First match wins;
 * anything unknown is a limited-time mode.
 */
const modeGroups: Array<[RegExp, string, string]> = [
  [/^(playground|creative)/, 'creative', 'Creative and islands'],
  [/^showdowntournament/, 'tournaments', 'Tournaments'],
  [/^showdown/, 'arena', 'Arena'],
  [/^habanero/, 'ranked', 'Ranked'],
  [/^nobuild/, 'zerobuild', 'Zero Build'],
  [/^respawn/, 'teamrumble', 'Team Rumble'],
  [/^(default(solo|duo|squad)|trios|bots_)/, 'battleroyale', 'Battle Royale'],
]

export function modeOfPlaylist(playlist: string) {
  const found = modeGroups.find(([pattern]) => pattern.test(playlist))

  return found ? { key: found[1], label: found[2] } : { key: 'ltm', label: 'Limited-time modes' }
}

const inputLabels: Record<string, string> = {
  gamepad: 'Controller',
  keyboardmouse: 'Keyboard and mouse',
  touch: 'Touch',
}

export function inputLabel(input: string) {
  return inputLabels[input] ?? input.charAt(0).toUpperCase() + input.slice(1)
}

/** The stats reply's career, or null when it carried no stats at all. */
export function parseMinutesPlayed(body: unknown): AllPlatformsTime | null {
  const stats = (body as { stats?: unknown } | null)?.stats

  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return null
  }

  const byInput = new Map<string, number>()
  const modes = new Map<string, ModeCareer>()
  const squads = new Map<SquadSize, SquadCareer>()
  const totals = { matches: 0, wins: 0, kills: 0, outlived: 0 }

  for (const [key, value] of Object.entries(stats as Record<string, unknown>)) {
    // br_<stat>_<input>_m0_playlist_<playlist>
    const match = /^br_([a-z0-9]+)_([a-z]+)_m0_playlist_(.+)$/.exec(key)
    const amount = Number(value)

    if (!match || !Number.isFinite(amount) || amount <= 0) {
      continue
    }

    const [, stat, input, playlist] = match
    const group = modeOfPlaylist(playlist)
    const mode = modes.get(group.key) ?? { ...group, minutes: 0, matches: 0, wins: 0 }
    const size = squadOfPlaylist(playlist)
    const squad = size ? (squads.get(size) ?? { size, label: squadLabels[size], matches: 0, wins: 0, kills: 0 }) : null

    if (squad && (stat === 'matchesplayed' || stat === 'placetop1' || stat === 'kills')) {
      squad[stat === 'matchesplayed' ? 'matches' : stat === 'placetop1' ? 'wins' : 'kills'] += amount
      squads.set(squad.size, squad)
    }

    if (stat === 'minutesplayed') {
      byInput.set(input, (byInput.get(input) ?? 0) + amount)
      mode.minutes += amount
    } else if (stat === 'matchesplayed') {
      totals.matches += amount
      mode.matches += amount
    } else if (stat === 'placetop1') {
      totals.wins += amount
      mode.wins += amount
    } else if (stat === 'kills') {
      totals.kills += amount
    } else if (stat === 'playersoutlived') {
      totals.outlived += amount
    } else {
      continue
    }

    modes.set(group.key, mode)
  }

  const inputs = [...byInput]
    .map(([input, minutes]) => ({ input, label: inputLabel(input), minutes }))
    .sort((a, b) => b.minutes - a.minutes)

  return {
    minutes: inputs.reduce((sum, entry) => sum + entry.minutes, 0),
    byInput: inputs,
    ...totals,
    modes: [...modes.values()].filter((mode) => mode.minutes > 0 || mode.matches > 0).sort((a, b) => b.minutes - a.minutes || b.matches - a.matches),
    squads: (['solo', 'duo', 'trio', 'squad'] as const).flatMap((size) => {
      const squad = squads.get(size)

      return squad && squad.matches > 0 ? [squad] : []
    }),
  }
}
