import { describe, expect, it } from 'vitest'
import { SOURCES, classify, counts, extractProfile, kindOf, normalizeItem, normalizeProfile } from './model'
import legacyData from './data/legacy-perks.json'
import currentData from './data/current-perks.json'
import aoePerks from './data/aoe-perks.json'
import rules from '../../../rare-item-finder-assets/slot-rules.json'
import type { FinderSourceId, SlotRules } from './types'

const slotRules = rules as unknown as SlotRules
const old = 'Alteration:aid_att_melee_critchance'
const modern = 'Alteration:aid_test_modern'
const records = { [modern.toLowerCase()]: { name: 'Modern critical rating' } }
const item = (attributes: unknown = { alterations: [old] }) => ({ templateId: 'Schematic:sid_assault_auto_sr_ore_t01', quantity: 1, attributes })
const response = (items: Record<string, unknown>, profileId = 'campaign', accountId = 'account-one') => ({
  profileChanges: [{ changeType: 'fullProfileUpdate', profile: { profileId, accountId, rvn: 12, items } }],
})

describe('rare item finder model', () => {
  it('all 147 combined legacy rules match, including case variants', () => {
    expect(Object.keys(legacyData)).toHaveLength(147)
    for (const [id, name] of Object.entries(legacyData)) {
      const result = classify({ alterations: [id.toUpperCase()] })
      expect(result.status).toBe('legacy')
      expect(result.reasons).toEqual([name])
    }
  })
  it('checks both perk fields independently without legacy badge leaking to modern perks', () => {
    const result = classify({ alterations: [old, modern], alterationDefinitions: [old, 'Alteration:aid_att_melee_critchance_alt1'] }, records)
    expect(result.perks).toHaveLength(3)
    expect(result.perks[1].legacy).toBe(false)
    expect(result.reasons).toHaveLength(2)
    expect(result.perks[0].fields).toEqual(['alterations', 'alterationDefinitions'])
  })
  it('unknown perks and Epic flags require review, never a confirmed match', () => {
    for (const attributes of [{ alterations: ['Alteration:unfamiliar'] }, { refund_legacy_item: true }, { legacy_item: true }, { alterations: {} }, null]) {
      expect(classify(attributes, records).status).toBe('review')
    }
    expect(classify({ alterations: [modern] }, records).status).toBe('modern')
    expect(classify({ alterations: [] }).status).toBe('modern')
    expect(classify({ refund_legacy_item: true, alterations: [old] }).status).toBe('legacy')
  })
  it('API current perks on mixed legacy items remain readable and are not marked legacy', () => {
    expect(Object.keys(currentData)).toHaveLength(301)
    for (const [id, name] of Object.entries(currentData)) {
      const result = classify({ alterations: [old, id] })
      expect(result.status).toBe('legacy')
      expect(result.perks[1].legacy).toBe(false)
      expect(result.perks[1].known).toBe(true)
      expect(result.perks[1].name).toBe(name)
      expect(result.reasons).toHaveLength(1)
    }
  })
  it('repeated perk slots on one item remain visible, mirrored secondary data does not duplicate them', () => {
    const result = classify({ alterations: [old, old, modern], alterationDefinitions: [old] }, records)
    expect(result.perks).toHaveLength(3)
    expect(result.perks.filter((p) => p.legacy)).toHaveLength(2)
    expect(result.perks[0].slot).toBe(0)
    expect(result.perks[1].slot).toBe(1)
  })
  it('all four profile namespaces are kept separate, ignoring heroes and ingredients', () => {
    expect(kindOf('Schematic:sid_floor_spikes_sr_t01', 'campaign')).toBe('trap')
    expect(kindOf('Schematic:sid_ceiling_electric_sr_t01', 'collection_book_schematics0')).toBe('trap')
    expect(kindOf('Weapon:wid_assault_auto_sr_ore_t05', 'theater0')).toBe('weapon')
    expect(kindOf('Trap:tid_wall_launcher_sr_t05', 'outpost0')).toBe('trap')
    for (const id of ['Hero:hid_test', 'Ingredient:ore', 'Schematic:sid_ingredient_blastpowder', 'Schematic:sid_ammo_bullets']) expect(kindOf(id, 'campaign')).toBeNull()
    expect(kindOf(item().templateId, 'theater0')).toBeNull()
  })
  it('identical templates are distinct copies, fallback names and quantities survive', () => {
    const profile = normalizeProfile('account-one', 'campaign', response({ a: item(), b: item({ alterations: [modern] }) }), slotRules, { records })
    expect(profile.items).toHaveLength(2)
    expect(profile.items[0].status).toBe('legacy')
    expect(profile.items[1].status).toBe('review')
    expect(profile.items[0].key).not.toBe(profile.items[1].key)
    const world = normalizeItem('account-one', 'theater0', 'a', { templateId: 'Weapon:wid_unknown_sr_t05', quantity: 17, attributes: { alterationDefinitions: [old] } }, slotRules)!
    expect(world.quantity).toBe(17)
    expect(world.status).toBe('legacy')
    expect(world.name).toBeTruthy()
    expect(world.metadataMissing).toBe(true)
  })
  it('missing snapshots, delta-only responses, account/profile mismatches are not empty success', () => {
    for (const data of [{}, { profileChanges: [] }, { profileChanges: [{ changeType: 'itemAttrChanged' }] }, response({}, 'outpost0'), response({}, 'campaign', 'wrong')]) {
      expect(() => extractProfile(data, 'campaign', 'account-one')).toThrow()
    }
    expect(extractProfile(response({}), 'campaign', 'account-one').items).toEqual({})
  })
  it('counts only inventory schematics as eligible, partial/malformed profiles stay incomplete', () => {
    const profiles = SOURCES.map((s) => normalizeProfile('account-one', s.id, response({ a: s.schematic ? item() : { templateId: 'Trap:tid_wall_launcher_sr_t01', attributes: { alterations: [old] } } }, s.id), slotRules))
    expect(counts(profiles).legacy).toBe(4)
    expect(counts(profiles).eligible).toBe(1)
    expect(counts(profiles).complete).toBe(true)
    expect(counts(profiles.slice(1)).eligible).toBe(0)
    expect(counts(profiles.slice(1)).complete).toBe(false)
    profiles[0].malformedItems = 1
    expect(counts(profiles).complete).toBe(false)
  })
  it('Knockback AOE only: both exact legacy IDs, either field, case insensitive; excludes modern AOE and traps', () => {
    for (const id of aoePerks) {
      for (const field of ['alterations', 'alterationDefinitions']) {
        const result = normalizeItem('account-one', 'campaign', 'copy', item({ [field]: [modern, id.toUpperCase()] }), slotRules, { records })!
        expect(result.aoe).toBe(true)
        expect(result.perks.filter((p) => p.aoe)).toHaveLength(1)
        expect(result.perks[0].aoe).toBe(false)
      }
    }
    const modernAoe = normalizeItem('account-one', 'campaign', 'copy', item({ alterations: ['Alteration:aid_g_weapon_hitstreak_aoe_dmg_v2'] }), slotRules)!
    expect(modernAoe.aoe).toBe(false)
    const trap = normalizeItem('account-one', 'outpost0', 'copy', { templateId: 'Trap:tid_wall_launcher_sr_t05', attributes: { alterations: [aoePerks[0]] } }, slotRules)!
    expect(trap.aoe).toBe(false)
  })
  it('AOE account count includes separate copies in every location, even with the same GUID and template', () => {
    const profiles = SOURCES.map((s) => normalizeProfile('account-one', s.id, response({ sharedGuid: {
      templateId: s.schematic ? 'Schematic:sid_assault_auto_sr_ore_t05' : 'Weapon:wid_assault_auto_sr_ore_t05',
      attributes: { alterationDefinitions: [aoePerks[0], old] },
    } }, s.id), slotRules))
    expect(counts(profiles).aoe).toBe(4)
    expect(new Set(profiles.flatMap((p) => p.items.map((i) => i.key))).size).toBe(4)
    profiles[1] = { sourceId: 'collection_book_schematics0' as FinderSourceId, status: 'error', items: [], error: null }
    expect(counts(profiles).aoe).toBe(3)
    expect(counts(profiles).complete).toBe(false)
  })
})
