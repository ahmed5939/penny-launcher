import { describe, expect, it } from 'vitest'
import type { InventoryItem } from '../../kernel/core/inventory'
import type { DefenderCatalog } from './types'
import data from './catalog.json'
import { assessDefender, compareDefenders } from './assess'
import { matchWeapons } from './weapons'

const catalog = data as DefenderCatalog
function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return { itemId: 'synthetic', templateId: 'Defender:did_defenderassault_basic_sr_t05', kind: 'defender', name: 'Defender', subtitle: null, rarity: 'legendary', tier: 5, level: 50, quantity: 1, lockedReason: null, personality: null, setBonus: null, portrait: null, alterations: [], ...overrides }
}
const dp = (...ids: string[]) => ids.map(id => 'Alteration:aid_att_def_' + id)
function weapon(name: string, perks: string[], level = 50) {
  const templateId = Object.entries(catalog.schematics).find(([id,w]) => w.name === name && id.endsWith('_sr_ore_t05'))?.[0]
  if (!templateId) throw new Error(`Missing fixture weapon ${name}`)
  return item({ itemId: `${name}-${level}`, kind: 'schematic', templateId, level, alterations: perks.map(id => 'Alteration:' + id) })
}

describe('defender usefulness', () => {
  it('favours a low-level Epic three-weapon roll over a level-50 Legendary survival roll', () => {
    const epic=assessDefender(item({rarity:'epic',level:1,alterations:dp('firerate','firerate','reload','maxhealth')}),catalog)
    const survival=assessDefender(item({alterations:dp('maxhealth','maxshield','shieldregen','maxhealth','reload')}),catalog)
    expect(epic.label).toBe('Strong weapon roll')
    expect(compareDefenders(epic,survival)).toBeLessThan(0)
  })
  it('counts repeated compatible perks but does not combine different melee subtypes', () => {
    const melee=assessDefender(item({templateId:'Defender:did_defendermelee_basic_sr_t05',alterations:dp('weapondamage_club','weapondamage_sword','weapondamage_hammer')}),catalog)
    expect(melee.weaponPerks).toBe(3)
    expect(melee.effectiveWeaponPerks).toBe(1)
    expect(melee.band).toBe(1)
  })
  it('does combine two club rolls with general melee damage', () => {
    const d=assessDefender(item({templateId:'Defender:did_defendermelee_basic_sr_t05',alterations:dp('weapondamage_club','weapondamage_club','weapondamage_melee')}),catalog)
    expect(d.effectiveWeaponPerks).toBe(3)
    expect(d.subtypes).toEqual(['club'])
  })
  it('does not give weapon value to resource perks or unknown perks', () => {
    const d=assessDefender(item({alterations:dp('ammosave','durability','movespeed','unrecognised')}),catalog)
    expect(d.effectiveWeaponPerks).toBe(0)
    expect(d.label).toBe('Needs review')
  })
  it('resolves the exact sniper template instead of inferring class from weapon perks', () => {
    const d=assessDefender(item({templateId:'Defender:did_defendersniper_basic_m_sr_t05',alterations:dp('firerate','reload')}),catalog)
    expect(d.className).toBe('Sniper')
  })
})

describe('exact weapon roll synergies', () => {
  const defender=assessDefender(item({alterations:dp('firerate','firerate','reload')}),catalog)
  const argonPerks=['aid_att_ranged_firerate','aid_att_ranged_recoil','aid_att_ranged_reloadspeed_alt1','aid_att_ranged_damage_alt2','aid_g_weapon_ondmg_afflictedenemy_knockbackaoe','aid_g_affliction_v2']
  it('recognises self-applied affliction plus a legacy AOE outside the sixth slot', () => {
    const [m]=matchWeapons(defender,[weapon('Argon Assault Rifle',argonPerks)],catalog)
    expect(m.roles).toEqual(['Crowd damage', 'Crowd control'])
    expect(m.reasons.join(' ')).toContain('also affects minibosses')
    expect(m.sixth).toContain('Affliction')
    expect(m.reasons.join(' ')).toContain('applies affliction itself')
    expect(m.limits.join(' ')).toContain('separate confirmation')
  })
  it('retains Dragon’s Roar despite a wasted headshot perk and recognises innate affliction', () => {
    const roar=weapon("Dragon's Roar",['aid_att_headshotdamage_t01','aid_att_weapon_afflicted_critdmg_alt1','aid_att_ranged_damage_alt1','aid_att_weapon_afflicted_critdmg_alt2','aid_g_weapon_ondmg_afflictedenemy_knockbackaoe','aid_g_weapon_onkill_spawn_firework_v2'],60)
    const [m]=matchWeapons(defender,[roar],catalog)
    expect(m.roles).toEqual(['Crowd damage', 'Crowd control'])
    expect(m.reasons.join(' ')).toContain('stalls nearby husks')
    expect(m.inactivePerks).toHaveLength(1)
    expect(m.reasons.join(' ')).toContain('3-second affliction')
    expect(m.sixth).toContain('Roman Candle')
    expect(m.limits.join(' ')).not.toContain('another verified affliction source')
  })
  it('does not cap supercharged level at 50 when comparing the same roll', () => {
    const matches=matchWeapons(defender,[weapon('Argon Assault Rifle',argonPerks),weapon('Argon Assault Rifle',argonPerks,60)],catalog)
    expect(matches[0].item.level).toBe(60)
  })
  it('does not suggest assault rifles for sniper defenders', () => {
    const sniper=assessDefender(item({templateId:'Defender:did_defendersniper_basic_sr_t05'}),catalog)
    expect(matchWeapons(sniper,[weapon('Argon Assault Rifle',argonPerks)],catalog)).toEqual([])
  })
  it('does not label unknown rolls as well-evidenced recommendations', () => {
    const [m]=matchWeapons(defender,[weapon('Argon Assault Rifle',['unknown_new_perk'])],catalog)
    expect(m.relevance).toBe(0)
    expect(m.limits.join(' ')).toContain('incomplete')
  })
  it('preserves the sixth slot when earlier slots are empty', () => {
    const w=weapon('Argon Assault Rifle',argonPerks)
    w.alterationSlots=[null, ...w.alterations.slice(1)]
    w.alterations=w.alterationSlots.filter((v): v is string => v !== null)
    expect(matchWeapons(defender,[w],catalog)[0].sixth).toContain('Affliction')
  })
  it('never mutates account items when scoring them', () => {
    const owned=[weapon('Argon Assault Rifle',argonPerks)]
    const before=JSON.stringify(owned)
    matchWeapons(defender,owned,catalog)
    expect(JSON.stringify(owned)).toBe(before)
  })
})
