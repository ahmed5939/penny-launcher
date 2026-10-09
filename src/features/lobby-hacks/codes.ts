import catalogue from '../../data/lobby-hack-codes.json'

/**
 * The season's known Lobby Hack codes, from `src/data/lobby-hack-codes.json`.
 *
 * Epic publishes no list and the reward codes are checked server-side, so
 * the game holds none of them: these are the codes community guides have
 * published, cross-checked and spelled as published. Picking one only fills
 * the form; it is sent when the user presses Submit.
 */

export type LobbyHackCodeCategory =
  | 'sprite'
  | 'sprite-dust'
  | 'xp'
  | 'gizmo'
  | 'cosmetic'
  | 'lobby-effect'

export type KnownLobbyHackCode = {
  code: string
  category: LobbyHackCodeCategory
  /** What the guides say it gives or does. */
  reward: string
  /** A quest the account must finish before the code works. */
  requires?: string
  /** Last day the code worked, `YYYY-MM-DD`. */
  expires?: string
  note?: string
  /** Keys into `lobbyHackCodeSources`. */
  sources: Array<string>
}

export type LobbyHackCodeSource = {
  name: string
  url: string
  updated: string | null
}

export const knownLobbyHackCodes =
  catalogue.codes as Array<KnownLobbyHackCode>

export const lobbyHackCodeSources = catalogue.sources as Record<
  string,
  LobbyHackCodeSource
>

/** `YYYY-MM-DD`: when the list was last checked against its sources. */
export const lobbyHackCodesCheckedAt = catalogue.checkedAt

/** Reward codes first, in the order a player cares about them. */
export const lobbyHackCodeCategories: ReadonlyArray<LobbyHackCodeCategory> = [
  'sprite',
  'sprite-dust',
  'xp',
  'gizmo',
  'cosmetic',
  'lobby-effect',
]

function today(now: Date) {
  return now.toISOString().slice(0, 10)
}

export function isExpiredCode(entry: KnownLobbyHackCode, now = new Date()) {
  return entry.expires !== undefined && today(now) > entry.expires
}

/**
 * Worth sending from Penny: a reward the server grants, still running.
 * Lobby effects play inside the game client and do nothing from here.
 */
export function isSubmittableCode(
  entry: KnownLobbyHackCode,
  now = new Date()
) {
  return entry.category !== 'lobby-effect' && !isExpiredCode(entry, now)
}

export type LobbyHackCodeGroup = {
  key: LobbyHackCodeCategory | 'expired'
  codes: Array<KnownLobbyHackCode>
}

/**
 * The list as the page shows it: one group per category in
 * `lobbyHackCodeCategories` order, expired codes last, empty groups
 * dropped. `query` matches the code, the reward or the requirement,
 * ignoring case.
 */
export function groupLobbyHackCodes(
  query = '',
  codes = knownLobbyHackCodes,
  now = new Date()
): Array<LobbyHackCodeGroup> {
  const needle = query.trim().toLowerCase()
  const matches = codes.filter(
    (entry) =>
      !needle ||
      [entry.code, entry.reward, entry.requires ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
  )
  const live = matches.filter((entry) => !isExpiredCode(entry, now))
  const groups: Array<LobbyHackCodeGroup> = lobbyHackCodeCategories.map(
    (key) => ({
      key,
      codes: live.filter((entry) => entry.category === key),
    })
  )

  groups.push({
    key: 'expired',
    codes: matches.filter((entry) => isExpiredCode(entry, now)),
  })

  return groups.filter((group) => group.codes.length > 0)
}
