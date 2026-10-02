import { describe, expect, it } from 'vitest'

import { parseCommander } from './stw-facts'

const reply = (profileId: string, items: Record<string, unknown>, attributes: Record<string, unknown> = {}) => ({
  profileChanges: [{ profile: { accountId: 'acc', profileId, items, stats: { attributes } } }],
})

const campaign = reply(
  'campaign',
  {
    loadout: {
      templateId: 'CampaignHeroLoadout:defaultloadout',
      attributes: { crew_members: { commanderslot: 'thora', followerslot1: 'kyle', followerslot2: 'missing' } },
    },
    thora: { templateId: 'Hero:hid_constructor_011_f_v1_roadtrip_sr_t05', attributes: { level: 50 } },
    kyle: { templateId: 'Hero:hid_constructor_basebig_sr_t05', attributes: { level: 60 } },
    kyleOld: { templateId: 'Hero:hid_constructor_basebig_sr_t04', attributes: { level: 40 } },
    wrath: { templateId: 'Schematic:sid_launcher_stormking_ur_t05', attributes: { level: 50 } },
    joel: { templateId: 'Worker:worker_joel_ur_t05', attributes: { level: 50 } },
    plain: { templateId: 'Worker:workerbasic_sr_t05', attributes: { level: 50, squad_id: 'Squad_Attribute_Medicine_EMTSquad', squad_slot_idx: 1 } },
    ssd1: { templateId: 'Quest:outpostquest_t1_l10', attributes: { quest_state: 'Claimed', last_state_change_time: '2022-08-07T14:36:33.755Z' } },
    ssd2: { templateId: 'Quest:outpostquest_t4_l3', attributes: { quest_state: 'Claimed', last_state_change_time: '2022-08-20T00:00:00.000Z' } },
    ssd3: { templateId: 'Quest:outpostquest_t4_l4', attributes: { quest_state: 'Active' } },
  },
  { selected_hero_loadout: 'loadout', research_levels: { fortitude: 120, offense: 120, resistance: 120, technology: 120 } }
)

const names: Record<string, { name: string; rarity: string }> = {
  'hero:hid_constructor_011_f_v1_roadtrip_sr_t05': { name: 'Thunder Thora', rarity: 'Legendary' },
  'hero:hid_constructor_basebig_sr_t05': { name: 'MEGA B.A.S.E. Kyle', rarity: 'Mythic' },
  'hero:hid_constructor_basebig_sr_t04': { name: 'MEGA B.A.S.E. Kyle', rarity: 'Mythic' },
  'schematic:sid_launcher_stormking_ur_t05': { name: "Storm King's Wrath ", rarity: 'Mythic' },
  'worker:worker_joel_ur_t05': { name: 'Joel', rarity: 'Mythic' },
  'worker:workerbasic_sr_t05': { name: 'Survivor', rarity: 'Legendary' },
}
const lookup = (templateId: string) => {
  const known = names[templateId.toLowerCase()]

  return known ? { ...known, image: `https://art/${known.name}.png` } : null
}

describe('parseCommander', () => {
  const facts = parseCommander(campaign, reply('common_public', {}, { homebase_name: ' Azkaban ' }), lookup)

  it('reads the equipped loadout, commander first, and skips empty slots', () => {
    expect(facts?.loadout.map((hero) => [hero.name, hero.level])).toEqual([
      ['Thunder Thora', 50],
      ['MEGA B.A.S.E. Kyle', 60],
    ])
  })

  it('keeps one of each mythic at its best level, heroes before weapons before survivors', () => {
    expect(facts?.mythics.map((item) => [item.name, item.level])).toEqual([
      ['MEGA B.A.S.E. Kyle', 60],
      ["Storm King's Wrath", 50],
      ['Joel', 50],
    ])
  })

  it('counts the collection and reads Power the way the Profile page does', () => {
    expect(facts?.collection).toEqual({ heroes: 3, survivors: 2, schematics: 1, defenders: 0 })
    expect(facts?.power).toBeGreaterThan(0)
    expect(parseCommander(reply('campaign', {}), null, lookup)?.power).toBeNull()
  })

  it('reads each Storm Shield, with when the tenth fell', () => {
    expect(facts?.shields).toEqual([
      { zone: 'Stonewood', completed: 1, finishedAt: '2022-08-07T14:36:33.755Z' },
      { zone: 'Plankerton', completed: 0, finishedAt: null },
      { zone: 'Canny Valley', completed: 0, finishedAt: null },
      { zone: 'Twine Peaks', completed: 1, finishedAt: null },
    ])
  })

  it('reads the homebase name', () => {
    expect(facts?.homebase).toBe('Azkaban')
  })

  it('still counts without the item database, with nothing to picture', () => {
    const plain = parseCommander(campaign, null, null)

    expect(plain?.loadout).toEqual([])
    expect(plain?.mythics).toEqual([])
    expect(plain?.collection.heroes).toBe(3)
    expect(plain?.homebase).toBeNull()
  })

  it('is null for anything but a campaign profile', () => {
    expect(parseCommander(reply('athena', {}), null, lookup)).toBeNull()
    expect(parseCommander(null, null, lookup)).toBeNull()
  })
})
