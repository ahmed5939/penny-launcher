import type { FriendEntry } from '../../kernel/core/friends-manager'

export type GroupedFriends = {
  blocked: Array<FriendEntry>
  friends: Array<FriendEntry>
  incoming: Array<FriendEntry>
  outgoing: Array<FriendEntry>
}

/**
 * Local filter for the friends workspace. Matches Epic name, alias, note,
 * and linked console names so a PSN id still finds the row.
 */
export function groupFriendEntries(
  entries: Array<FriendEntry>,
  filter: string
): GroupedFriends {
  const needle = filter.trim().toLowerCase()
  const matching = needle
    ? entries.filter((entry) => matchesFriendFilter(entry, needle))
    : entries

  return {
    blocked: matching.filter((entry) => entry.kind === 'blocked'),
    friends: matching.filter((entry) => entry.kind === 'friend'),
    incoming: matching.filter((entry) => entry.kind === 'incoming'),
    outgoing: matching.filter((entry) => entry.kind === 'outgoing'),
  }
}

export function matchesFriendFilter(entry: FriendEntry, needle: string) {
  if (entry.displayName.toLowerCase().includes(needle)) return true
  if (entry.alias.toLowerCase().includes(needle)) return true
  if (entry.note.toLowerCase().includes(needle)) return true
  if (entry.accountId.toLowerCase().includes(needle)) return true

  return entry.linked.some((link) =>
    link.displayName.toLowerCase().includes(needle)
  )
}
