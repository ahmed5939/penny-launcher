import type { SchematicCopy, SixthPerksScan, WeaponResult } from './types'

import { describe, expect, it } from 'vitest'

import { catalog, countsForCompletion, filterWeapons, matchesPerkFilter, matchWeapons, overallCompletion, ownership, parseItems, scanStatistics } from './model'

const dragon = catalog.weapons.find((w) => w.name === "Dragon's Roar")!
const variantIds = Object.keys(catalog.variants)
const dragonSid = variantIds.find((id) => catalog.variants[id].weaponId === dragon.id && id.endsWith('ore_t01'))!
const dragonEpicSid = variantIds.find((id) => catalog.variants[id].weaponId === dragon.id && catalog.variants[id].rarity === 'Epic')!

function copy(id: string, sid: string, perk: string | null, level = 1): SchematicCopy {
  const alterations: Array<string | null> = Array(6).fill(null)
  alterations[catalog.variants[sid].slotIndex] = perk
  return { id, templateId: sid, level, alterations }
}
type Status = SixthPerksScan['inventory']['status']
function scan(inventory: Array<SchematicCopy> = [], book: Array<SchematicCopy> = [], invStatus: Status = 'success', bookStatus: Status = 'success'): SixthPerksScan {
  return { accountId: 'a'.repeat(32), fetchedAt: '', inventory: { status: invStatus, items: inventory, error: null }, book: { status: bookStatus, items: book, error: null } }
}
function row(s: SixthPerksScan | null, id = dragon.id): WeaponResult {
  return matchWeapons(s).find((w) => w.id === id)!
}

describe('6th perks matching', () => {
  it('groups weapon families by missing Legendary options and separates unknown reads', () => {
    const full = row(scan(dragon.options.map((o, i) => copy('full' + i, dragonSid, o.id))))
    const almost = row(scan(dragon.options.slice(1).map((o, i) => copy('almost' + i, dragonSid, o.id))))
    const empty = row(scan())
    const unknown = row(scan([], [], 'error'))
    const epic = { ...empty, legendaryAvailable: false }
    const stats = scanStatistics([full, almost, empty, unknown, epic])
    expect(stats.eligible).toBe(4)
    expect(stats.unknown).toBe(1)
    expect(stats.excluded).toBe(1)
    expect(stats.groups.find((g) => g.missing === 0)!.count).toBe(1)
    expect(stats.groups.find((g) => g.missing === 1)!.count).toBe(1)
    expect(stats.groups.find((g) => g.missing === 5)!.count).toBe(1)
    expect(stats.groups.reduce((sum, g) => sum + g.count, 0) + stats.unknown).toBe(stats.eligible)
  })

  it('deduplicates Legendary rolls across locations and excludes Epic rolls from completion', () => {
    const w = row(scan([copy('one', dragonSid, dragon.options[0].id), copy('epic', dragonEpicSid, dragon.options[1].id)], [copy('duplicate', dragonSid, dragon.options[0].id)]))
    const p = overallCompletion([w])
    expect(p.owned).toBe(1)
    expect(p.total).toBe(5)
    expect(p.percent).toBe(20)
    expect(p.partial).toBe(false)
    expect(overallCompletion(matchWeapons(null)).partial).toBe(true)
  })

  it('perk filters distinguish missing, owned, upgrade candidates and book copies', () => {
    const w = row(scan([copy('epic', dragonEpicSid, dragon.options[0].id)], [copy('book', dragonSid, dragon.options[1].id)]))
    expect(matchesPerkFilter(w.options[0], w, 'perk-upgrade')).toBe(true)
    expect(matchesPerkFilter(w.options[0], w, 'perk-owned')).toBe(true)
    expect(matchesPerkFilter(w.options[0], w, 'perk-missing')).toBe(false)
    expect(matchesPerkFilter(w.options[1], w, 'perk-book')).toBe(true)
    expect(matchesPerkFilter(w.options[1], w, 'perk-upgrade')).toBe(false)
    expect(matchesPerkFilter(w.options[2], w, 'perk-missing')).toBe(true)
    const unknown = row(scan([], [], 'error'))
    expect(matchesPerkFilter(unknown.options[0], unknown, 'perk-missing')).toBe(false)
    expect(filterWeapons([w], '', 'perk-upgrade', 'all')).toHaveLength(1)
  })

  it('resolves every variant to one weapon and its gameplay slot', () => {
    expect(catalog.weapons).toHaveLength(273)
    expect(variantIds).toHaveLength(3250)
    for (const v of Object.values(catalog.variants)) {
      expect(catalog.weapons.some((w) => w.id === v.weaponId)).toBe(true)
      expect([0, 5]).toContain(v.slotIndex)
      expect(v.allowed.length).toBeGreaterThan(0)
    }
    expect(dragon.options.filter((o) => o.availability === 'current')).toHaveLength(5)
  })

  it('never counts a Collection Book-only roll as inventory', () => {
    const w = row(scan([], [copy('book-copy', dragonSid, dragon.options[0].id)]))
    expect(w.inventoryCount).toBe(0)
    expect(w.bookCount).toBe(1)
    expect(ownership(w.options[0], w)).toBe('In Collection Book (1 Legendary)')
    expect(filterWeapons([w], '', 'book-only', 'all')).toHaveLength(1)
  })

  it('matches both locations and different crafting tiers independently', () => {
    const sid = variantIds.find((id) => catalog.variants[id].weaponId === dragon.id && id.endsWith('crystal_t05'))!
    const w = row(scan([copy('inv', dragonSid, dragon.options[0].id)], [copy('cb', sid, dragon.options[0].id)]))
    expect(ownership(w.options[0], w)).toBe('In inventory (1 Legendary)')
    expect(w.options[0].inventory[0].active).toBe(false)
  })

  it('hides redundant Epic and book statuses behind a completed inventory roll without losing copies', () => {
    const w = row(scan([copy('legendary', dragonSid, dragon.options[0].id), copy('epic', dragonEpicSid, dragon.options[0].id)], [copy('book', dragonSid, dragon.options[0].id)]))
    expect(ownership(w.options[0], w)).toBe('In inventory (1 Legendary)')
    expect(w.options[0].inventory).toHaveLength(2)
    expect(w.options[0].book).toHaveLength(1)
    expect(countsForCompletion(w.options[0])).toBe(true)
  })

  it('keeps null earlier slots in place and case-folds template ids', () => {
    const alterations = [null, null, null, null, null, dragon.options[0].id.toUpperCase()]
    const items = parseItems({ x: { templateId: dragonSid.toUpperCase(), attributes: { level: 50, alterations, secret: 'do not return' } } })
    expect(items[0].alterations[0]).toBeNull()
    expect(items[0].alterations).toHaveLength(6)
    expect(row(scan(items)).options[0].inventory).toHaveLength(1)
    expect(JSON.stringify(items)).not.toContain('secret')
  })

  it('reads Blackout from gameplay slot zero, not the last stat perk', () => {
    const sid = variantIds.find((id) => id.includes('blackmetal') && catalog.weapons.find((w) => w.id === catalog.variants[id].weaponId)?.name === 'Blackout')!
    const variant = catalog.variants[sid]
    expect(variant.slotIndex).toBe(0)
    const w = row(scan([copy('black', sid, variant.allowed[0])]), variant.weaponId)
    expect(w.options.find((o) => o.matchIds.includes(variant.allowed[0]))!.inventory).toHaveLength(1)
  })

  it('keeps a failed profile unknown and out of the book-only and incomplete filters', () => {
    const w = row(scan([], [copy('cb', dragonSid, dragon.options[0].id)], 'error'))
    expect(ownership(w.options[1], w)).toMatch(/Inventory unknown/)
    expect(filterWeapons([w], '', 'book-only', 'all')).toHaveLength(0)
    expect(filterWeapons([w], '', 'incomplete', 'all')).toHaveLength(0)
  })

  it('never reports unresolved or unknown rolls as missing', () => {
    const w = row(scan([copy('old', dragonSid, 'alteration:aid_g_custom_old')]))
    expect(w.options.find((o) => o.id === 'observed:alteration:aid_g_custom_old')!.inventory).toHaveLength(1)
    const empty = row(scan([copy('empty', dragonSid, null)]))
    expect(empty.unresolved).toHaveLength(1)
    expect(ownership(empty.options[0], empty)).toMatch(/unresolved copies/)
  })

  it('keeps legacy original ids and observes them in earlier slots', () => {
    const option = dragon.options.find((o) => o.matchIds.some((id) => catalog.knownGameplayPerks[id]?.legacy))!
    const legacyId = option.matchIds.find((id) => catalog.knownGameplayPerks[id]?.legacy)!
    const item = copy('legacy', dragonSid, null)
    item.alterations[1] = legacyId
    const match = row(scan([item])).options.find((o) => o.id === option.id)!.inventory[0]
    expect(match.perkId).toBe(legacyId)
    expect(match.slotIndex).toBe(1)
  })

  it('omits the erroneous website stun entries in favour of the six-second stun perk', () => {
    const affected = ['Compression Burster', "Dragon's Claw", "Dragon's Fury", "Dragon's Might", 'Easter Egg Launcher', 'Heartbreaker', 'Maverick', 'Pulverizer', 'The Contender', 'Thunderbolt']
    expect(catalog.metadata.unresolvedWebsiteOptions).toBe(0)
    for (const name of affected) {
      const w = catalog.weapons.find((w) => w.name === name)!
      expect(w).toBeDefined()
      expect(w.options.filter((o) => o.id === 'alteration:aid_g_weapon_stun_v2')).toHaveLength(1)
      expect(w.options.some((o) => o.description === 'Increases impact by 25%. Stun duration increased by 1s.')).toBe(false)
    }
  })

  it('records Vindertech historical headshot rolls against the historical dictionary', () => {
    const options = catalog.weapons.flatMap((w) => w.options.filter((o) => o.availability === 'historical'))
    expect(options).toHaveLength(5)
    expect(options.every((o) => o.matchIds.includes('alteration:aid_g_ranged_headshotstreak_dmgbonus_v2'))).toBe(true)
  })

  it('matches an Epic hidden API roll without counting it toward completion', () => {
    const w = row(scan([copy('epic', dragonEpicSid, dragon.options[0].id, 50)]))
    const o = w.options[0]
    expect(o.inventory).toHaveLength(1)
    expect(o.inventory[0].rarity).toBe('Epic')
    expect(o.inventory[0].active).toBe(false)
    expect(countsForCompletion(o)).toBe(false)
    expect(ownership(o, w)).toMatch(/Epic — upgrade to Legendary to count/)
    expect(filterWeapons([w], '', 'incomplete', 'all')).toHaveLength(1)
  })

  it('labels an Epic Collection Book roll as being in the book', () => {
    const w = row(scan([], [copy('epic-book', dragonEpicSid, dragon.options[0].id, 50)]))
    expect(w.inventoryCount).toBe(0)
    expect(countsForCompletion(w.options[0])).toBe(false)
    expect(ownership(w.options[0], w)).toMatch(/^In Collection Book \(1 Epic/)
  })

  it('counts Epic and Legendary duplicates as one completed option', () => {
    const w = row(scan([copy('epic', dragonEpicSid, dragon.options[0].id), copy('legendary', dragonSid, dragon.options[0].id)]))
    expect(w.options[0].inventory).toHaveLength(2)
    expect(countsForCompletion(w.options[0])).toBe(true)
    expect(w.options.filter((o) => countsForCompletion(o))).toHaveLength(1)
  })

  it('does not invent a Legendary upgrade path for an Epic-only family', () => {
    const weapon = catalog.weapons.find((w) => !w.legendaryAvailable)!
    const sid = variantIds.find((id) => catalog.variants[id].weaponId === weapon.id)!
    const w = row(scan([copy('founder', sid, weapon.options[0].id)]), weapon.id)
    expect(countsForCompletion(w.options[0])).toBe(false)
    expect(ownership(w.options[0], w)).toMatch(/upgrade path unverified/)
  })

  it('treats a skipped Collection Book as unread, not unknown', () => {
    const w = row(scan([copy('inventory', dragonSid, dragon.options[0].id)], [copy('ignored-book', dragonSid, dragon.options[1].id)], 'success', 'skipped'))
    expect(w.bookUnknown).toBe(false)
    expect(w.bookCount).toBe(0)
    expect(overallCompletion([w]).owned).toBe(1)
    expect(overallCompletion([w]).partial).toBe(false)
    expect(matchesPerkFilter(w.options[1], w, 'perk-missing')).toBe(true)
    expect(scanStatistics([w]).unknown).toBe(0)
  })
})
