import { describe, expect, it } from 'vitest'

import type { FriendEntry } from '../../kernel/core/friends-manager'

import { groupFriendEntries, matchesFriendFilter } from './group'

function entry(
  overrides: Partial<FriendEntry> & Pick<FriendEntry, 'kind' | 'displayName'>
): FriendEntry {
  return {
    accountId: overrides.accountId ?? 'id-1',
    alias: overrides.alias ?? '',
    created: overrides.created ?? '',
    displayName: overrides.displayName,
    favorite: overrides.favorite ?? false,
    nameSource: overrides.nameSource ?? 'epic',
    kind: overrides.kind,
    linked: overrides.linked ?? [],
    mutual: overrides.mutual ?? 0,
    note: overrides.note ?? '',
  }
}

describe('groupFriendEntries', () => {
  const list = [
    entry({ kind: 'friend', displayName: 'Penny' }),
    entry({
      kind: 'incoming',
      displayName: 'Storm',
      accountId: 'id-2',
    }),
    entry({
      kind: 'outgoing',
      displayName: 'Lara',
      accountId: 'id-3',
    }),
    entry({
      kind: 'blocked',
      displayName: 'Spam',
      accountId: 'id-4',
    }),
  ]

  it('splits by kind when unfiltered', () => {
    const grouped = groupFriendEntries(list, '')

    expect(grouped.friends).toHaveLength(1)
    expect(grouped.incoming).toHaveLength(1)
    expect(grouped.outgoing).toHaveLength(1)
    expect(grouped.blocked).toHaveLength(1)
  })

  it('filters by display name across kinds', () => {
    const grouped = groupFriendEntries(list, 'pen')

    expect(grouped.friends.map((item) => item.displayName)).toEqual(['Penny'])
    expect(grouped.incoming).toHaveLength(0)
  })
})

describe('matchesFriendFilter', () => {
  it('matches linked platform names', () => {
    const friend = entry({
      kind: 'friend',
      displayName: 'EpicName',
      linked: [{ platform: 'psn', displayName: 'PSN_Lara' }],
    })

    expect(matchesFriendFilter(friend, 'psn_lara')).toBe(true)
    expect(matchesFriendFilter(friend, 'nobody')).toBe(false)
  })
})
