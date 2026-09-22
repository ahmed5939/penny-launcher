import { describe, expect, it } from 'vitest'
import { confirmedRewards, expeditionKind, recyclableRewards, resourceGains, selectTeam, type Items } from './model'
import data from './expedition-data.json'

describe('expedition coverage', () => {
  it('classifies every offered expedition in the live bot data', () => {
    for (const id of Object.keys(data.attributes)) expect(expeditionKind(id).category, id).not.toBe('')
  })
  it('covers lead survivors, heroes, weapons and rare traps', () => {
    for (const [fragment, category] of [['managers', 'Survivors'], ['heroes', 'Heroes'], ['weapons', 'Weapons'], ['traps', 'Traps']]) {
      expect(expeditionKind(`Expedition:expedition_rare_sea_${fragment}_t05`).category).toBe(category)
    }
  })
})
describe('reward accounting and recycling', () => {
  const reward = { templateId: 'Worker:worker_r_t01', quantity: 1, itemId: 'reward' }
  const inventory: Items = { reward: { templateId: reward.templateId, quantity: 1, attributes: {} } }
  it('uses notification quantities even when rewards merge into an existing stack', () => {
    expect(confirmedRewards([{ itemType: 'Ingredient:ore', quantity: 25, itemGuid: 'existing' }])).toEqual([{ templateId: 'Ingredient:ore', quantity: 25, itemId: 'existing' }])
  })
  it('accepts only confirmed newly granted eligible GUIDs', () => {
    expect(recyclableRewards([reward], {}, inventory, 'Rare')).toEqual([reward])
    expect(recyclableRewards([reward], inventory, inventory, 'Rare')).toEqual([])
    expect(recyclableRewards([{ ...reward, itemId: undefined }], {}, inventory, 'Rare')).toEqual([])
    expect(recyclableRewards([reward, reward], {}, inventory, 'Rare')).toHaveLength(1)
    expect(recyclableRewards([reward], {}, inventory, 'off')).toEqual([])
  })
  it.each(['favorite', 'is_favorite', 'squad_id', 'building_slot_used'])('protects %s', (flag) => {
    expect(recyclableRewards([reward], {}, { reward: { ...inventory.reward, attributes: { [flag]: 1 } } }, 'Epic')).toEqual([])
  })
  it('protects loadout members, unknown rarity, legendary, mythic and world items', () => {
    expect(recyclableRewards([reward], {}, { ...inventory, loadout: { templateId: 'CampaignHeroLoadout:x', attributes: { crew_members: ['reward'] } } }, 'Epic')).toEqual([])
    for (const templateId of ['Hero:unknown', 'Hero:hid_ninja_sr_t01', 'Hero:hid_ninja_ur_t01', 'Weapon:wid_r_t01', 'Trap:tid_r_t01']) {
      expect(recyclableRewards([{ ...reward, templateId }], {}, { reward: { templateId, quantity: 1 } }, 'Epic')).toEqual([])
    }
  })
  it('records positive recycling resource deltas including existing stacks', () => {
    expect(resourceGains({ x: { templateId: 'AccountResource:xp', quantity: 10 } }, { x: { templateId: 'AccountResource:xp', quantity: 30 }, y: { templateId: 'Ingredient:ore', quantity: 2 } })).toEqual([{ templateId: 'AccountResource:xp', quantity: 20 }, { templateId: 'Ingredient:ore', quantity: 2 }])
  })
})
describe('vehicle and hero selection', () => {
  const items: Items = {
    unlock: { templateId: 'HomebaseNode:questreward_expedition_dirtbike1' },
    hero: { templateId: 'Hero:hid_ninja_sr_t01', attributes: { level: 1 } },
  }
  it('uses actual power and criteria multipliers', () => {
    const team = selectTeam(items, 'Expedition:expedition_supplyrun_short_t01', { expedition_max_target_power: 20, expedition_criteria: ['RequiresNinja'] })
    expect(team.heroIds).toEqual(['hero'])
    expect(team.power).toBe(18)
    expect(team.squadId).toBe('Squad_Expedition_ExpeditionSquadOne')
  })
  it('rejects locked or occupied vehicles, assigned heroes and unsatisfied criteria', () => {
    const attrs = { expedition_max_target_power: 12 }
    expect(selectTeam({ hero: items.hero }, 'Expedition:x', attrs).heroIds).toEqual([])
    expect(selectTeam({ ...items, busy: { templateId: 'Expedition:x', attributes: { expedition_end_time: '2020-01-01', expedition_squad_id: 'squad_expedition_expeditionsquadone' } } }, 'Expedition:x', attrs).heroIds).toEqual([])
    expect(selectTeam(items, 'Expedition:x', { ...attrs, expedition_criteria: ['RequiresCommando'] }).heroIds).toEqual([])
    expect(selectTeam(items, 'Expedition:x', { ...attrs, expedition_criteria: ['UnknownCriterion'] }).heroIds).toEqual([])
  })
  it('does not launch below the 80 percent threshold', () => {
    expect(selectTeam(items, 'Expedition:x', { expedition_max_target_power: 100 }).heroIds).toEqual([])
  })
})
