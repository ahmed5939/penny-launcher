import { describe, expect, it } from 'vitest'

import { levelFloor, nextZone, parseVenturesProfile, seasonalQuests, ventureZones, zonesUnlocked } from './model'

const profile = (items: Record<string, unknown>, attributes: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  profileChanges: [{ profile: { accountId: 'acc', profileId: 'campaign', items, stats: { attributes }, ...extra } }],
})

describe('ventures model', () => {
  it('knows five chains of twelve seasonal quests with XP', () => {
    expect(seasonalQuests).toHaveLength(60)
    const chains = new Set(seasonalQuests.map((q) => q.chain))
    expect([...chains].sort()).toEqual(['destroy', 'locating', 'mission', 'monster', 'weapon'])
    expect(seasonalQuests.find((q) => q.templateId === 'Quest:adventure_seasonal_destroy_01')?.xp).toBe(2175)
  })

  it('reads xp, fort stats and quest states off the campaign profile', () => {
    const result = parseVenturesProfile(
      profile({
        a: { templateId: 'AccountResource:phoenixxp', quantity: 90_000 },
        b: { templateId: 'Stat:fortitude_phoenix', quantity: 12 },
        c: { templateId: 'Stat:technology_phoenix', quantity: 5 },
        d: { templateId: 'Quest:adventure_seasonal_destroy_01', attributes: { quest_state: 'Claimed', last_state_change_time: '2026-09-01T00:00:00Z' } },
        e: { templateId: 'Quest:adventure_seasonal_destroy_02', attributes: { quest_state: 'Active', completion_destroy_tables: 7 } },
        f: { templateId: 'Quest:daily_something', attributes: { quest_state: 'Active' } },
      }),
      'acc'
    )
    expect(result.xp).toBe(90_000)
    expect(result.level).toBeNull()
    expect(result.fort).toEqual({ fortitude: 12, offense: 0, resistance: 0, technology: 5 })
    const destroy = result.quests.filter((q) => q.chain === 'destroy')
    expect(destroy.map((q) => q.state).slice(0, 3)).toEqual(['claimed', 'active', 'not-started'])
    expect(destroy[1].objectives).toEqual([{ backendName: 'destroy_tables', completed: 7 }])
    expect(destroy[0].lastChange).toBe('2026-09-01T00:00:00Z')
  })

  it('leaves xp and fort null when the profile has neither', () => {
    const result = parseVenturesProfile(profile({}), 'acc')
    expect(result.xp).toBeNull()
    expect(result.fort).toBeNull()
    expect(result.quests.every((q) => q.state === 'not-started')).toBe(true)
  })

  it('only trusts a level the profile states', () => {
    expect(parseVenturesProfile(profile({}, { phoenix_level: 12 }), 'acc').level).toBe(12)
    expect(parseVenturesProfile(profile({}, { phoenix_level: '12' }), 'acc').level).toBeNull()
  })

  it('rejects the wrong profile or account', () => {
    expect(() => parseVenturesProfile({ profileChanges: [{ profile: { profileId: 'theater0', accountId: 'acc' } }] }, 'acc')).toThrow()
    expect(() => parseVenturesProfile(profile({}, {}, { accountId: 'other' }), 'acc')).toThrow()
  })

  it('derives zone unlocks from the xp ladder', () => {
    expect(zonesUnlocked(null)).toBeNull()
    expect(zonesUnlocked(0)).toBe(0)
    expect(zonesUnlocked(37_350)).toBe(1)
    expect(zonesUnlocked(2_000_000)).toBe(ventureZones.length)
    expect(nextZone(90_000)?.level).toBe(16)
    expect(nextZone(2_000_000)).toBeNull()
    expect(levelFloor(0)).toBe(0)
    expect(levelFloor(10)).toBe(1)
    expect(levelFloor(90_000)).toBe(11)
  })
})
