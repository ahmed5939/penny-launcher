import { describe, expect, it } from 'vitest'
import { auditSlots } from './slot-audit'
import { SOURCES, counts, normalizeItem } from './model'
import legacy from './data/legacy-perks.json'
import historical from './data/historical-perks.json'
import defenders from './data/defender-perks.json'
import confirmedModded from './data/confirmed-modded.json'
import rulesData from '../../../rare-item-finder-assets/slot-rules.json'
import type { FinderSourceId, SlotRules } from './types'

const rules = rulesData as unknown as SlotRules
const legacyIds = legacy as Record<string, string>
const weapon = 'weapon:wid_assault_auto_sr_ore_t05'
const valid = (id: string) => rules.items[id].slots.map((s) => s.allowed.find((p) => !legacyIds[p]) || s.allowed[0] || null)
const attrs = (id: string): { level: number; alterations: Array<string | null>; [key: string]: unknown } => ({ level: 50, alterations: valid(id) })
const schematicFor = (target: string) => Object.keys(rules.schematicToItem).find((k) => rules.schematicToItem[k] === target)
const normalize = (source: FinderSourceId, templateId: string, attributes: Record<string, unknown>) =>
  normalizeItem('account', source, 'copy', { templateId, attributes }, rules)!
const trap = Object.keys(rules.items).find((k) => k.startsWith('trap:') && rules.items[k].rarity === 'Legendary' && rules.items[k].slots.length === 6)!

describe('slot audit against the 42.10 extraction', () => {
  it('Third Rail slot 4 magazine is currently allowed across all variants and sources', () => {
    const ids = Object.keys(rules.items).filter((id) => rules.items[id].name === 'Third Rail')
    expect(ids).toHaveLength(14)
    for (const id of ids) {
      const a = attrs(id)
      a.alterations[3] = 'alteration:aid_att_magazinesize_t03'
      const schematic = schematicFor(id)
      for (const source of SOURCES) {
        expect(!source.schematic || schematic).toBeTruthy()
        const item = normalize(source.id, source.schematic ? schematic! : id, a)
        expect(item.historical).toBe(false)
        expect(item.modded).toBe(false)
        expect(item.slotAudit.status).toBe('matches_current_rules')
      }
    }
  })
  it('Shooting Star +50% magazine slot 4 is historical across all variants and locations only', () => {
    const exception = historical.exceptions.find((e) => e.id === 'shooting-star-magazine-slot-four')!
    expect(exception.itemTemplateIds).toHaveLength(14)
    for (const id of exception.itemTemplateIds) {
      const a = attrs(id)
      a.alterations[3] = exception.perkId
      const schematic = schematicFor(id)
      for (const source of SOURCES) {
        expect(!source.schematic || schematic).toBeTruthy()
        const item = normalize(source.id, source.schematic ? schematic! : id, a)
        expect(item.historical).toBe(true)
        expect(item.modded).toBe(false)
        expect(item.slotAudit.status).toBe('historical_perk')
      }
      a.alterations.push(a.alterations[0])
      expect(auditSlots(id, a, false, rules).candidate).toBe(true)
      const wrong = attrs(id)
      wrong.alterations[0] = exception.perkId
      expect(auditSlots(id, wrong, false, rules).findings.some((f) => f.code === 'historical_perk')).toBe(false)
      const strength = attrs(id)
      strength.alterations[3] = 'alteration:aid_att_magazinesize_t05'
      expect(auditSlots(id, strength, false, rules).candidate).toBe(true)
    }
    const other = attrs(weapon)
    other.alterations[3] = exception.perkId
    expect(auditSlots(weapon, other, false, rules).findings.some((f) => f.code === 'historical_perk')).toBe(false)
  })
  it('all resolved current loadouts accept an allowed choice per slot, including Common sixth perks', () => {
    let checked = 0
    for (const [id, record] of Object.entries(rules.items)) {
      if (record.coverage !== 'resolved' || !record.slots.length || record.slots.some((s) => !s.allowed.length)) continue
      expect(auditSlots(id, attrs(id), false, rules).status, id).toBe('matches_current_rules')
      checked++
    }
    expect(checked).toBeGreaterThan(4000)
  })
  it('known disallowed perk detected for every resolved loadout, with exact slot evidence', () => {
    let checked = 0
    for (const [id, record] of Object.entries(rules.items)) {
      if (record.coverage !== 'resolved' || !record.slots.length) continue
      const bad = rules.knownPerks.find((p) => !legacyIds[p] && !record.slots[0].allowed.includes(p))!
      const a = attrs(id)
      a.alterations[0] = bad
      const result = auditSlots(id, a, false, rules)
      expect(result.candidate, id).toBe(true)
      expect(result.findings.some((f) => f.slot === 0 && f.perkId === bad)).toBe(true)
      checked++
    }
    expect(checked).toBeGreaterThan(4000)
  })
  it('schematic alias and crafted weapon/trap in all four sources retain independent candidates', () => {
    for (const target of [weapon, trap]) {
      const schematic = schematicFor(target)!
      const a = attrs(target)
      a.alterations.push(a.alterations[0])
      const profiles = SOURCES.map((s) => ({ status: 'success' as const, items: [normalizeItem('account', s.id, 'same-guid', { templateId: s.schematic ? schematic : target, attributes: a }, rules)!] }))
      expect(counts(profiles).modded).toBe(4)
      expect(new Set(profiles.flatMap((p) => p.items.map((i) => i.key))).size).toBe(4)
    }
  })
  it('missing entries retain indexes, unlocked omissions are incomplete, locked omissions allowed', () => {
    const a = attrs(weapon)
    a.alterations[0] = null
    const result = auditSlots(weapon, a, false, rules)
    expect(result.status).toBe('incomplete')
    expect(result.candidate).toBe(false)
    expect(auditSlots(weapon, { level: 1, alterations: [] }, false, rules).status).toBe('matches_current_rules')
  })
  it('empty extra slot is still a structural anomaly, legitimate repeated perks are allowed', () => {
    const a = attrs(weapon)
    a.alterations.push(null)
    expect(auditSlots(weapon, a, false, rules).candidate).toBe(true)
    const b = attrs(weapon)
    const shared = rules.items[weapon].slots[0].allowed.find((p) => rules.items[weapon].slots[3].allowed.includes(p))!
    b.alterations[0] = shared
    b.alterations[3] = shared
    expect(auditSlots(weapon, b, false, rules).candidate).toBe(false)
  })
  it('unknown template, unknown perk, malformed and conflicting arrays are review, not modded', () => {
    expect(auditSlots('weapon:unknown', attrs(weapon), false, rules).status).toBe('unknown')
    const a = attrs(weapon)
    a.alterations[0] = 'alteration:future_perk'
    expect(auditSlots(weapon, a, false, rules).candidate).toBe(false)
    expect(auditSlots(weapon, { alterations: [{}] }, false, rules).candidate).toBe(false)
    expect(auditSlots(weapon, { ...attrs(weapon), alterationDefinitions: [] }, false, rules).status).toBe('unknown')
  })
  it('crafted alterationDefinitions field and casing work; mirrored arrays do not double-count', () => {
    const a = attrs(weapon)
    const uppercase = a.alterations.map((v) => v!.toUpperCase())
    expect(auditSlots(weapon, { level: 50, alterationDefinitions: uppercase }, false, rules).status).toBe('matches_current_rules')
    expect(auditSlots(weapon, { ...a, alterationDefinitions: uppercase }, false, rules).status).toBe('matches_current_rules')
  })
  it('legacy and mixed copies keep AOE and legacy highlights without false modded classification', () => {
    const a = attrs(weapon)
    a.alterations[0] = 'alteration:aid_g_weapon_ondmg_afflictedenemy_knockbackaoe'
    a.alterations.push('alteration:aid_att_buildingheal_t01')
    const item = normalize('theater0', weapon, a)
    expect(item.aoe).toBe(true)
    expect(item.status).toBe('legacy')
    expect(item.modded).toBe(false)
    expect(item.slotAudit.status).toBe('historical_review')
    expect(auditSlots(weapon, { ...attrs(weapon), refund_legacy_item: true }, false, rules).status).toBe('matches_current_rules')
  })
  it('legacy dictionary excludes defenders and includes all extracted weapon/trap definitions', () => {
    expect(Object.keys(legacyIds)).toHaveLength(147)
    expect(Object.keys(legacyIds).every((k) => !k.includes('defender'))).toBe(true)
  })
  it('user-confirmed Vindertech slot 6 is historical, not modded, across every exception variant and location', () => {
    const exception = historical.exceptions[0]
    for (const target of exception.itemTemplateIds) {
      const a = attrs(target)
      a.alterations[5] = exception.perkId
      const schematic = schematicFor(target)
      for (const source of SOURCES) {
        if (source.schematic && !schematic) continue
        const item = normalize(source.id, source.schematic ? schematic! : target, a)
        expect(item.historical, target).toBe(true)
        expect(item.modded, target).toBe(false)
      }
    }
  })
  it('historical exception does not hide other mismatches or apply to another slot or weapon', () => {
    const exception = historical.exceptions[0]
    const id = exception.itemTemplateIds[0]
    const a = attrs(id)
    a.alterations[5] = exception.perkId
    a.alterations.push(a.alterations[0])
    expect(auditSlots(id, a, false, rules).candidate).toBe(true)
    const wrong = attrs(id)
    wrong.alterations[0] = exception.perkId
    expect(auditSlots(id, wrong, false, rules).findings.some((f) => f.code === 'disallowed_slot' && f.slot === 0)).toBe(true)
    const other = attrs(weapon)
    other.alterations[5] = exception.perkId
    expect(auditSlots(weapon, other, false, rules).findings.some((f) => f.code === 'historical_perk')).toBe(false)
  })
  it('Discharger reload is historical review until its original slots are confirmed', () => {
    const exceptions = historical.exceptions.filter((e) => e.id.startsWith('plasmatic-'))
    expect(exceptions).toHaveLength(5)
    for (const exception of exceptions) {
      for (const id of exception.itemTemplateIds) {
        const a = attrs(id)
        a.alterations[1] = exception.perkId
        const result = auditSlots(id, a, false, rules)
        expect(result.status).toBe('historical_review')
        expect(result.candidate).toBe(false)
        expect(result.findings.some((f) => f.code === 'historical_slot_unverified')).toBe(true)
        a.alterations.push(a.alterations[0])
        expect(auditSlots(id, a, false, rules).candidate).toBe(true)
      }
    }
    const other = attrs(weapon)
    other.alterations[2] = exceptions[0].perkId
    const result = auditSlots(weapon, other, false, rules)
    expect(result.candidate).toBe(true)
    expect(result.findings.some((f) => f.code === 'historical_slot_unverified')).toBe(false)
  })
})

describe('defender perks and legacy hybrids', () => {
  const old = 'alteration:aid_att_melee_critchance'
  const modern = 'alteration:aid_att_damage_t05'
  const defenderIds = Object.keys(defenders)
  const item = (source: (typeof SOURCES)[number], perks: Array<string>, field = 'alterations', extra: Record<string, unknown> = {}) =>
    normalize(source.id, source.schematic ? 'Schematic:sid_assault_auto_sr_ore_t05' : 'Weapon:wid_assault_auto_sr_ore_t05', { level: 50, [field]: perks, ...extra })

  it('all 24 defender IDs mark weapon/trap schematics modded in either perk field, even with legacy flags', () => {
    expect(defenderIds).toHaveLength(24)
    for (const source of SOURCES.filter((s) => s.schematic)) {
      for (const id of defenderIds) {
        for (const field of ['alterations', 'alterationDefinitions']) {
          for (const templateId of ['Schematic:sid_assault_auto_sr_ore_t05', 'Schematic:sid_wall_launcher_sr_t05']) {
            const result = normalize(source.id, templateId, { [field]: [old, id.toUpperCase()], legacy_item: true })
            expect(result.modded).toBe(true)
            expect(result.defenderPerk).toBe(true)
            expect(result.hybrid).toBe(false)
            expect(result.perks[1].name).toBe((defenders as Record<string, string>)[id])
            expect(result.perks[1].defender).toBe(true)
          }
        }
      }
    }
  })
  it('defender detection checks secondary array even if arrays disagree; unknown defender-like ID not confirmed', () => {
    const source = SOURCES[0]
    expect(item(source, [old], 'alterations', { alterationDefinitions: [defenderIds[0]] }).defenderPerk).toBe(true)
    expect(item(source, ['alteration:aid_att_def_not_in_dictionary']).defenderPerk).toBe(false)
  })
  it('legacy plus modern is hybrid across all four sources, unknown and defender-only do not imply modern', () => {
    for (const source of SOURCES) {
      for (const field of ['alterations', 'alterationDefinitions']) {
        expect(item(source, [old, modern], field).hybrid).toBe(true)
        for (const perks of [[old], [modern], [old, 'alteration:unknown'], [old, defenderIds[0]]]) expect(item(source, perks, field).hybrid).toBe(false)
      }
    }
    const profiles = SOURCES.map((s) => ({ status: 'success' as const, items: [item(s, [old, modern])] }))
    expect(counts(profiles).hybrid).toBe(4)
  })
  it('modded and hybrid flags coexist, with no relaxation of defender schematic detection', () => {
    const result = item(SOURCES[0], [old, modern, defenderIds[0]])
    expect(result.hybrid).toBe(true)
    expect(result.defenderPerk).toBe(true)
    expect(result.modded).toBe(true)
  })
})

describe('review regressions', () => {
  it('refund flags do not override verified current rules, or hide a mismatch', () => {
    const id = Object.keys(rules.items).find((k) => rules.items[k].coverage === 'resolved' && rules.items[k].slots.length === 6)!
    const a: Record<string, unknown> & { alterations: Array<string | null> } = { level: 50, refund_legacy_item: true, legacy_item: true, alterations: rules.items[id].slots.map((s) => s.allowed[0]) }
    expect(normalize('theater0', id, a).status).toBe('modern')
    a.alterations.push(a.alterations[0])
    expect(auditSlots(id, a, false, rules).candidate).toBe(true)
  })
  it('known slotless items can omit arrays, items with perk slots cannot', () => {
    expect(normalize('campaign', 'Schematic:sid_assault_semiauto_c_ore_t00', { level: 1, refund_legacy_item: true }).status).toBe('modern')
    const withSlots = Object.keys(rules.items).find((k) => rules.items[k].slots.length === 6)!
    expect(auditSlots(withSlots, { level: 50 }, false, rules).status).toBe('unknown')
  })
  it('observed Third Rail historical magazine perk has a narrow exception', () => {
    const id = 'weapon:wid_sniper_invasion_railgun_vr_crystal_t05'
    const a = { level: 50, alterations: rules.items[id].slots.map((s) => s.allowed[0]) as Array<string | null> }
    a.alterations[2] = 'alteration:aid_att_magazinesize_t02'
    expect(auditSlots(id, a, false, rules).status).toBe('historical_perk')
    a.alterations.push(a.alterations[0])
    expect(auditSlots(id, a, false, rules).candidate).toBe(true)
  })
  it('confirmed modded signatures classify across locations without widening to other loadouts', () => {
    for (const s of confirmedModded.signatures) {
      const schematic = schematicFor(s.itemTemplateId)!
      for (const source of SOURCES) {
        const item = normalize(source.id, source.schematic ? schematic : s.itemTemplateId, { level: 50, alterations: s.perks })
        expect(item.moddedConfirmed).toBe(true)
        expect(item.status).toBe('modded')
      }
      expect(normalize('theater0', s.itemTemplateId, { level: 50, alterations: [...s.perks, null] }).moddedConfirmed).toBe(false)
    }
  })
  it('recognised historical items are excluded from review counts', () => {
    for (const e of historical.exceptions) {
      const id = e.itemTemplateIds[0]
      const alterations = rules.items[id].slots.map((s) => s.allowed[0]) as Array<string | null>
      alterations[e.slot ?? 2] = e.perkId
      const item = normalize('theater0', id, { level: 50, alterations })
      expect(item.status).toBe('historical')
      expect(counts([{ status: 'success', items: [item] }]).review).toBe(0)
    }
  })
})
