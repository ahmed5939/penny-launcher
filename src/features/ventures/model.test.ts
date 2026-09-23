import { describe, expect, it } from 'vitest'

import { levelFloor, nextZone, parseVenturesProfile, seasonalQuests, ventureObjectiveProgress, ventureZones, zonesUnlocked } from './model'

const profile = (items: Record<string, unknown>, attributes: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  profileChanges: [{ profile: { accountId: 'acc', profileId: 'campaign', items, stats: { attributes }, ...extra } }],
})

describe('ventures model', () => {
  it('knows five chains of twelve quests for each of the five seasons', () => {
    expect(seasonalQuests).toHaveLength(300)
    for (const season of ['adventure', 'beginnings', 'fall', 'phoenix', 'winter']) {
      expect(seasonalQuests.filter((quest) => quest.season === season)).toHaveLength(60)
    }
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
    expect(result.season).toBeNull()
    expect(result.quests).toEqual([])
  })

  it.each(['adventure', 'beginnings', 'fall', 'winter'])('matches claimed and live %s quests', (season) => {
    const result = parseVenturesProfile(profile({
      claimed: { templateId: `Quest:${season}_seasonal_destroy_01`, attributes: { quest_state: 'Claimed' } },
      live: { templateId: `Quest:${season}_seasonal_destroy_02`, attributes: { quest_state: 'Active', completion_tables: 7 } },
    }), 'acc')
    expect(result.season).toBe(season)
    expect(result.quests).toHaveLength(60)
    expect(result.quests.filter((quest) => quest.state === 'claimed')).toHaveLength(1)
    expect(result.quests.find((quest) => quest.state === 'active')?.objectives).toEqual([{ backendName: 'tables', completed: 7 }])
    expect(result.quests.every((quest) => quest.templateId.startsWith(`Quest:${season}_`))).toBe(true)
  })

  it('recognizes all three summer quest naming conventions', () => {
    const ids = ['phoenix_seasonal_destroy_summer_01', 'phoenix_seasonal_locating_01', 'phoenixseasonal_mission_01', 'phoenixseasonal_monster_01', 'phoenixseasonal_weapon_01']
    const result = parseVenturesProfile(profile(Object.fromEntries(ids.map((id) => [id, {
      templateId: `Quest:${id}`, attributes: { quest_state: 'Claimed' },
    }]))), 'acc')
    expect(result.season).toBe('phoenix')
    expect(result.quests).toHaveLength(60)
    expect(result.quests.filter((quest) => quest.state === 'claimed')).toHaveLength(5)
  })

  it('keeps older season completions out of the latest season, even when fully claimed', () => {
    const result = parseVenturesProfile(profile({
      old: { templateId: 'Quest:adventure_seasonal_destroy_01', attributes: { quest_state: 'Active', last_state_change_time: '2026-04-01T00:00:00Z' } },
      recent: { templateId: 'Quest:fall_seasonal_destroy_01', attributes: { quest_state: 'Claimed', last_state_change_time: '2026-09-01T00:00:00Z' } },
    }), 'acc')
    expect(result.season).toBe('fall')
    expect(result.quests.filter((quest) => quest.state === 'claimed')).toHaveLength(1)
    expect(result.quests.some((quest) => quest.templateId.includes('adventure'))).toBe(false)
  })

  it('uses claimed campaign history even when objective counters are absent', () => {
    const result = parseVenturesProfile(profile({
      history: {
        templateId: 'quest:ADVENTURE_SEASONAL_DESTROY_01',
        attributes: { quest_state: 'Claimed', last_state_change_time: '2026-09-01T00:00:00Z' },
      },
      ready: {
        templateId: 'Quest:adventure_seasonal_destroy_02',
        attributes: { quest_state: 'Completed' },
      },
    }), 'acc')
    const [claimed, ready, missing] = result.quests.filter((quest) => quest.chain === 'destroy')
    expect(claimed.state).toBe('claimed')
    expect(claimed.lastChange).toBe('2026-09-01T00:00:00Z')
    expect(ventureObjectiveProgress(claimed, 'adventure_seasonal_destroy_01', 25)).toBe(25)
    expect(ready.state).toBe('completed')
    expect(ventureObjectiveProgress(ready, 'adventure_seasonal_destroy_02', 10)).toBe(10)
    expect(missing.state).toBe('not-started')
    expect(ventureObjectiveProgress(missing, 'adventure_seasonal_destroy_03', 10)).toBe(0)
  })

  it('keeps live quest objectives separate and caps progress at the requirement', () => {
    const result = parseVenturesProfile(profile({
      live: {
        templateId: 'Quest:adventure_seasonal_destroy_01',
        attributes: { quest_state: 'Active', completion_tables: 7, completion_chairs: 30 },
      },
    }), 'acc')
    const quest = result.quests.find((item) => item.templateId === 'Quest:adventure_seasonal_destroy_01')!
    expect(ventureObjectiveProgress(quest, 'tables', 10)).toBe(7)
    expect(ventureObjectiveProgress(quest, 'chairs', 25)).toBe(25)
    expect(ventureObjectiveProgress(quest, 'shrubs', 25)).toBe(0)
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
