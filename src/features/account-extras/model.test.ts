import { describe, expect, it } from 'vitest'

import {
  avatarInitials,
  chunk,
  classifyStanding,
  describeAvatar,
  fallbackAvatarImageUrl,
  formatBanDuration,
  humaniseStandingText,
  isEpicAccountId,
  isStandingItemActive,
  parseAvatarId,
  parseAvatarList,
  parseStanding,
  parseStandingItem,
  readPersistedAvatar,
  summariseStanding,
  toIsoTime,
} from './model'

const now = Date.parse('2026-10-02T12:00:00Z')
const past = '2026-09-01T00:00:00.000Z'
const future = '2026-12-01T00:00:00.000Z'

describe('avatars', () => {
  it('takes the cosmetic id from after the first colon, whatever the prefix', () => {
    expect(parseAvatarId('ATHENACHARACTER:CID_029_Athena_Commando_F_Halloween')).toBe(
      'CID_029_Athena_Commando_F_Halloween'
    )
    expect(parseAvatarId('AthenaCharacter:Character_Foo')).toBe('Character_Foo')
    expect(parseAvatarId('CID_001_Athena_Commando_F')).toBe('CID_001_Athena_Commando_F')
    expect(parseAvatarId('  ')).toBeNull()
    expect(parseAvatarId('ATHENACHARACTER:')).toBeNull()
    expect(parseAvatarId(null)).toBeNull()
    expect(parseAvatarId(42)).toBeNull()
  })

  it('points the fallback image at fortnite-api, lower-cased, without a variant', () => {
    expect(fallbackAvatarImageUrl('CID_029_Athena_Commando_F_Halloween')).toBe(
      'https://fortnite-api.com/images/cosmetics/br/cid_029_athena_commando_f_halloween/smallicon.png'
    )
    expect(fallbackAvatarImageUrl('Character_Foo:Mat2')).toBe(
      'https://fortnite-api.com/images/cosmetics/br/character_foo/smallicon.png'
    )
    expect(fallbackAvatarImageUrl('../../etc')).toBeNull()
  })

  it('reads the service reply defensively, keyed by lower-cased account id', () => {
    const found = parseAvatarList([
      {
        accountId: 'ABCDEF0123456789ABCDEF0123456789',
        namespace: 'fortnite',
        avatarId: 'ATHENACHARACTER:CID_029_Athena_Commando_F_Halloween',
      },
      { accountId: '0123456789abcdef0123456789abcdef', namespace: 'fortnite', avatarId: '' },
      { namespace: 'fortnite', avatarId: 'ATHENACHARACTER:CID_X' },
      null,
      'nonsense',
    ])

    expect([...found.entries()]).toEqual([
      ['abcdef0123456789abcdef0123456789', 'CID_029_Athena_Commando_F_Halloween'],
      ['0123456789abcdef0123456789abcdef', null],
    ])
    expect(parseAvatarList({ error: 'nope' }).size).toBe(0)
  })

  it('prefers the catalogue, then keeps a known name for the same outfit', () => {
    expect(describeAvatar(null)).toEqual({ cosmeticId: null, imageUrl: null, name: null })

    expect(
      describeAvatar('CID_029_Athena_Commando_F_Halloween', {
        name: 'Skull Trooper',
        imageUrl: 'https://fortnite-api.com/x/smallicon.png',
      })
    ).toEqual({
      cosmeticId: 'CID_029_Athena_Commando_F_Halloween',
      imageUrl: 'https://fortnite-api.com/x/smallicon.png',
      name: 'Skull Trooper',
    })

    const previous = {
      cosmeticId: 'cid_029_athena_commando_f_halloween',
      imageUrl: 'https://fortnite-api.com/old.png',
      name: 'Skull Trooper',
    }

    expect(describeAvatar('CID_029_Athena_Commando_F_Halloween', null, previous)).toEqual({
      cosmeticId: 'CID_029_Athena_Commando_F_Halloween',
      imageUrl:
        'https://fortnite-api.com/images/cosmetics/br/cid_029_athena_commando_f_halloween/smallicon.png',
      name: 'Skull Trooper',
    })
    expect(describeAvatar('CID_001_Athena_Commando_F', null, previous).name).toBeNull()
  })

  it('reads persisted entries and rejects anything else', () => {
    expect(
      readPersistedAvatar({ cosmeticId: 'CID_1', imageUrl: 'u', name: '', fetchedAt: 5 })
    ).toEqual({ cosmeticId: 'CID_1', imageUrl: 'u', name: null, fetchedAt: 5 })
    expect(readPersistedAvatar({ cosmeticId: 'CID_1' })).toBeNull()
    expect(readPersistedAvatar('CID_1')).toBeNull()
  })

  it('batches ids in groups of at most the batch size', () => {
    const ids = Array.from({ length: 205 }, (_, index) => String(index))
    const batches = chunk(ids, 100)

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5])
    expect(batches.flat()).toEqual(ids)
    expect(chunk([], 100)).toEqual([])
    expect(chunk([1, 2, 3], 0)).toEqual([[1], [2], [3]])
  })

  it('only accepts Epic-shaped account ids', () => {
    expect(isEpicAccountId('0123456789abcdef0123456789ABCDEF')).toBe(true)
    expect(isEpicAccountId('alt-account')).toBe(false)
    expect(isEpicAccountId('0123456789abcdef0123456789abcdef0')).toBe(false)
    expect(isEpicAccountId(undefined)).toBe(false)
  })

  it('draws one or two initials', () => {
    expect(avatarInitials('Penny Bot')).toBe('PB')
    expect(avatarInitials('penny')).toBe('P')
    expect(avatarInitials('ay dast xooshhhh')).toBe('AD')
    expect(avatarInitials('  [TTV] gamer ')).toBe('TG')
    expect(avatarInitials('')).toBe('?')
    expect(avatarInitials(null)).toBe('?')
  })
})

describe('social standing', () => {
  it('reads the empty reply as good standing', () => {
    const { bans, warnings } = parseStanding({ bans: [], warnings: [] })

    expect(bans).toEqual([])
    expect(warnings).toEqual([])
    expect(classifyStanding(bans, warnings, now)).toBe('good')
  })

  it('treats a missing or odd list as empty', () => {
    expect(parseStanding({ bans: null })).toEqual({ bans: [], warnings: [] })
    expect(parseStanding(null)).toEqual({ bans: [], warnings: [] })
  })

  it('picks out reason, type and times from likely field names, keeping the rest', () => {
    const item = parseStandingItem({
      banId: 'b-1',
      offenderId: '0123456789abcdef0123456789abcdef',
      banReason: 'VOICE_CHAT_ABUSE',
      banType: 'VoiceChat',
      createdAt: '2026-09-20T10:00:00Z',
      banEndTime: 1793577600,
      somethingNew: { nested: true },
    })

    expect(item).toMatchObject({
      id: 'b-1',
      reason: 'VOICE_CHAT_ABUSE',
      type: 'VoiceChat',
      startsAt: '2026-09-20T10:00:00.000Z',
      expiresAt: new Date(1793577600 * 1000).toISOString(),
      lifted: false,
    })
    expect(item.raw.somethingNew).toEqual({ nested: true })
  })

  it('reads snake_case, nested reasons and millisecond epochs', () => {
    const item = parseStandingItem({
      id: 'w-9',
      details: { reason: { code: 'harassment' } },
      issued_at: 1790000000000,
      expires: null,
    })

    expect(item.id).toBe('w-9')
    expect(item.reason).toBe('harassment')
    expect(item.startsAt).toBe(new Date(1790000000000).toISOString())
    expect(item.expiresAt).toBeNull()
  })

  it('does not mistake who was involved for when it happened', () => {
    const item = parseStandingItem({
      reporterId: 'abc',
      offenderAccountId: 'def',
      userCreatedAt: '2020-01-01T00:00:00Z',
      startTime: '2026-09-01T00:00:00Z',
    })

    expect(item.id).toBeNull()
    expect(item.startsAt).toBe('2026-09-01T00:00:00.000Z')
    expect(item.expiresAt).toBeNull()
  })

  it('reads the known ban shape: starts_at, ends_at, acked, duration_s', () => {
    const item = parseStandingItem({
      starts_at: '2026-09-28T08:00:00Z',
      ends_at: '2026-10-05T08:00:00Z',
      acked: false,
      duration_s: 604800,
    })

    expect(item).toMatchObject({
      startsAt: '2026-09-28T08:00:00.000Z',
      expiresAt: '2026-10-05T08:00:00.000Z',
      durationSeconds: 604800,
      acknowledged: false,
      lifted: false,
    })
    expect(classifyStanding([item], [], now)).toBe('banned')
  })

  it('works the expiry out from starts_at + duration_s when ends_at is null', () => {
    const item = parseStandingItem({
      starts_at: '2026-09-28T08:00:00Z',
      ends_at: null,
      acked: true,
      duration_s: 86400,
    })

    expect(item.expiresAt).toBe('2026-09-29T08:00:00.000Z')
    expect(item.acknowledged).toBe(true)
    // Ended on 29 September; "now" is 2 October.
    expect(isStandingItemActive(item, now)).toBe(false)
    expect(classifyStanding([item], [], now)).toBe('good')
  })

  it('treats a ban with neither ends_at nor duration_s as permanent', () => {
    const item = parseStandingItem({ starts_at: past, ends_at: null, acked: true })

    expect(item.expiresAt).toBeNull()
    expect(classifyStanding([item], [], now)).toBe('banned')
  })

  it('formats a ban length in whole units', () => {
    expect(formatBanDuration(604800)).toBe('7 days')
    expect(formatBanDuration(86400)).toBe('1 day')
    expect(formatBanDuration(7200)).toBe('2 hours')
    expect(formatBanDuration(90)).toBe('2 minutes')
    expect(formatBanDuration(0)).toBeNull()
    expect(formatBanDuration(null)).toBeNull()
  })

  it('keeps strings as reasons', () => {
    expect(parseStandingItem('Repeated reports')).toMatchObject({
      reason: 'Repeated reports',
      raw: { value: 'Repeated reports' },
    })
  })

  it('classifies an active ban as banned, ahead of warnings', () => {
    const { bans, warnings } = parseStanding({
      bans: [{ reason: 'x', expiresAt: future }],
      warnings: [{ reason: 'y' }],
    })

    expect(classifyStanding(bans, warnings, now)).toBe('banned')
  })

  it('ignores a ban whose expiry has passed', () => {
    const { bans, warnings } = parseStanding({
      bans: [{ reason: 'x', expiresAt: past }],
      warnings: [],
    })

    expect(isStandingItemActive(bans[0], now)).toBe(false)
    expect(classifyStanding(bans, warnings, now)).toBe('good')
  })

  it('counts a ban with no expiry as in force', () => {
    const { bans } = parseStanding({ bans: [{ reason: 'x' }] })

    expect(classifyStanding(bans, [], now)).toBe('banned')
  })

  it('falls back to warned when only a warning is live', () => {
    const { bans, warnings } = parseStanding({
      bans: [{ reason: 'old', endTime: past }],
      warnings: [{ acked: true }],
    })

    expect(classifyStanding(bans, warnings, now)).toBe('warned')
  })

  it('honours a ban that says it is over', () => {
    const { bans } = parseStanding({ bans: [{ reason: 'x', active: false }] })

    expect(classifyStanding(bans, [], now)).toBe('good')
  })

  it('counts any warning present, acknowledged or not, and gives it no dates', () => {
    const { warnings } = parseStanding({
      bans: [],
      warnings: [{ acked: true }, { acked: false }],
    })

    expect(warnings.map((item) => item.acknowledged)).toEqual([true, false])
    expect(warnings[0]).toMatchObject({
      startsAt: null,
      expiresAt: null,
      durationSeconds: null,
      reason: null,
    })
    expect(classifyStanding([], warnings, now)).toBe('warned')
  })

  it('turns epoch seconds, milliseconds and dates into ISO times', () => {
    expect(toIsoTime(1790000000)).toBe(new Date(1790000000 * 1000).toISOString())
    expect(toIsoTime('1790000000000')).toBe(new Date(1790000000000).toISOString())
    expect(toIsoTime('2026-09-01T00:00:00Z')).toBe('2026-09-01T00:00:00.000Z')
    expect(toIsoTime('not a date')).toBeNull()
    expect(toIsoTime(0)).toBeNull()
    expect(toIsoTime(true)).toBeNull()
  })

  it('humanises codes and leaves prose alone', () => {
    expect(humaniseStandingText('VOICE_CHAT_ABUSE')).toBe('Voice chat abuse')
    expect(humaniseStandingText('TextChat')).toBe('Text chat')
    expect(humaniseStandingText('harassment')).toBe('Harassment')
    expect(humaniseStandingText('You were reported in a match.')).toBe(
      'You were reported in a match.'
    )
    expect(humaniseStandingText(null)).toBeNull()
  })

  it('summarises linked accounts, counting unchecked ones as pending', () => {
    const entry = (status: 'good' | 'warned' | 'banned' | 'unknown') => ({
      status,
      bans: [],
      warnings: [],
      checkedAt: past,
    })

    expect(summariseStanding({ a: entry('good'), b: entry('good') }, ['a', 'b'])).toMatchObject({
      allGood: true,
      good: 2,
      total: 2,
    })
    expect(
      summariseStanding({ a: entry('good'), b: entry('warned'), c: entry('unknown') }, [
        'a',
        'b',
        'c',
        'd',
      ])
    ).toMatchObject({ allGood: false, good: 1, warned: 1, unknown: 1, pending: 1, total: 4 })
    expect(summariseStanding({}, []).allGood).toBe(false)
  })
})
