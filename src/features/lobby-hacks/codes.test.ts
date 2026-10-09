import { describe, expect, it } from 'vitest'

import { checkLobbyHackCode } from '../../lib/lobby-hacks'

import {
  type KnownLobbyHackCode,
  groupLobbyHackCodes,
  isExpiredCode,
  isSubmittableCode,
  knownLobbyHackCodes,
  lobbyHackCodeCategories,
  lobbyHackCodeSources,
  lobbyHackCodesCheckedAt,
} from './codes'

const checked = new Date(`${lobbyHackCodesCheckedAt}T12:00:00Z`)

describe('the known codes list', () => {
  it('lists each code once, ignoring case', () => {
    const codes = knownLobbyHackCodes.map((entry) => entry.code.toLowerCase())

    expect(knownLobbyHackCodes.length).toBeGreaterThan(0)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('only holds codes the form would send unchanged', () => {
    for (const entry of knownLobbyHackCodes) {
      const check = checkLobbyHackCode(entry.code)

      expect(check.ok && check.code).toBe(entry.code)
    }
  })

  it('says where every code came from and what it gives', () => {
    for (const entry of knownLobbyHackCodes) {
      expect(lobbyHackCodeCategories).toContain(entry.category)
      expect(entry.reward.trim()).not.toBe('')
      expect(entry.sources.length).toBeGreaterThan(0)

      for (const source of entry.sources) {
        expect(lobbyHackCodeSources[source]?.url).toMatch(/^https:\/\//)
      }

      if (entry.expires !== undefined) {
        expect(entry.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it('keeps the exact spellings that are easy to get wrong', () => {
    const codes = knownLobbyHackCodes.map((entry) => entry.code)

    // A zero, not the letter O.
    expect(codes).toContain('H0p0nVC')
    expect(codes).toContain('s7h-50p-r03')
    expect(codes).toContain('powerout!')
  })
})

const entry = (fields: Partial<KnownLobbyHackCode>): KnownLobbyHackCode => ({
  code: 'CODE',
  category: 'xp',
  reward: '40,000 XP',
  sources: ['beebom'],
  ...fields,
})

describe('isSubmittableCode', () => {
  it('offers running reward codes only', () => {
    expect(isSubmittableCode(entry({}), checked)).toBe(true)
    expect(isSubmittableCode(entry({ category: 'lobby-effect' }), checked)).toBe(
      false
    )
    expect(isSubmittableCode(entry({ expires: '2026-09-14' }), checked)).toBe(
      false
    )
  })

  it('counts the last listed day as still valid', () => {
    const day = new Date('2026-09-14T23:00:00Z')

    expect(isExpiredCode(entry({ expires: '2026-09-14' }), day)).toBe(false)
    expect(
      isExpiredCode(entry({ expires: '2026-09-14' }), new Date('2026-09-15T00:00:00Z'))
    ).toBe(true)
  })

  it('treats NOPROLLAMA as expired and the lobby effects as in game only', () => {
    const byCode = new Map(knownLobbyHackCodes.map((item) => [item.code, item]))

    expect(isSubmittableCode(byCode.get('NOPROLLAMA')!, checked)).toBe(false)
    expect(isSubmittableCode(byCode.get('CrowsAreAfraid')!, checked)).toBe(false)
    expect(isSubmittableCode(byCode.get('OverrideXP')!, checked)).toBe(true)
  })
})

describe('groupLobbyHackCodes', () => {
  const codes = [
    entry({ code: 'Effect', category: 'lobby-effect', reward: 'Scarecrows' }),
    entry({ code: 'Old', category: 'gizmo', expires: '2026-09-14' }),
    entry({ code: 'Dust', category: 'sprite-dust', reward: '5,000 Sprite Dust', requires: 'Finish the Geno quests.' }),
    entry({ code: 'Sprite', category: 'sprite', reward: 'Gold Jonesy Sprite' }),
  ]

  it('orders rewards first, lobby effects after, expired last, and drops empty groups', () => {
    expect(
      groupLobbyHackCodes('', codes, checked).map((group) => [
        group.key,
        group.codes.map((item) => item.code),
      ])
    ).toEqual([
      ['sprite', ['Sprite']],
      ['sprite-dust', ['Dust']],
      ['lobby-effect', ['Effect']],
      ['expired', ['Old']],
    ])
  })

  it('searches the code, the reward and the requirement, ignoring case', () => {
    const keys = (query: string) =>
      groupLobbyHackCodes(query, codes, checked).flatMap((group) =>
        group.codes.map((item) => item.code)
      )

    expect(keys('jonesy')).toEqual(['Sprite'])
    expect(keys('  GENO ')).toEqual(['Dust'])
    expect(keys('effect')).toEqual(['Effect'])
    expect(keys('nothing like this')).toEqual([])
  })
})
