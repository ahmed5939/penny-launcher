import type { SchematicCopy, SixthPerksScan } from './types'

import { describe, expect, it } from 'vitest'

import data from './planner-data.json'
import { catalog, matchWeapons } from './model'
import { completionPlan, fixedStarts } from './planner'

type Path = { weaponId: string; slotIndex: number; target: string; legendaryFlux: number; epicFlux: number }
const paths = data.paths as Record<string, Path>
const sid = Object.keys(paths).find((s) => s.includes('assault_dragon_vr_ore_t01'))!
const variant = paths[sid]
const weapon = catalog.weapons.find((w) => w.id === variant.weaponId)!

function copyOf(id: string, templateId: string, perk: string, slotIndex = variant.slotIndex): SchematicCopy {
  const alterations: Array<string | null> = Array(6).fill(null)
  alterations[slotIndex] = perk
  return { id, templateId, level: 1, alterations }
}
function scanOf(items: Array<SchematicCopy>, book: Array<SchematicCopy> = [], bookStatus: SixthPerksScan['book']['status'] = 'success'): SixthPerksScan {
  return { accountId: 'a'.repeat(32), fetchedAt: '', inventory: { status: 'success', items, error: null }, book: { status: bookStatus, items: book, error: null } }
}
function plan(items: Array<SchematicCopy> = [], book: Array<SchematicCopy> = [], weaponId = weapon.id) {
  const scan = scanOf(items, book)
  return completionPlan(matchWeapons(scan).filter((w) => w.id === weaponId), scan)
}

describe('6th perks completion planner', () => {
  it('prefers an exact Epic roll, which costs no Core RE-PERK', () => {
    const p = plan([copyOf('epic', sid, weapon.options[0].id)])
    expect(p.steps[0].copyId).toBe('epic')
    expect(p.steps[0].core).toBe(0)
    expect(p.legendaryFlux).toBe(100)
    expect(p.readyCount).toBe(1)
  })

  it('protects a sole completed copy and allocates a duplicate only once', () => {
    const keep = copyOf('keep', variant.target, weapon.options[0].id)
    const spare = copyOf('spare', variant.target, weapon.options[0].id)
    expect(plan([keep]).readyCount).toBe(0)
    const p = plan([keep, spare])
    expect(p.readyCount).toBe(1)
    expect(p.core).toBe(1)
    expect(p.steps.filter((s) => s.copyId === 'spare')).toHaveLength(1)
    expect(p.steps.some((s) => s.copyId === 'keep')).toBe(false)
  })

  it('never allocates Collection Book copies as spares', () => {
    const book = [copyOf('book', variant.target, weapon.options[0].id), copyOf('book2', variant.target, weapon.options[0].id)]
    expect(plan([], book).readyCount).toBe(0)
  })

  it('costs both rarity upgrades for an exact Rare roll', () => {
    const rare = Object.keys(paths).find((s) => paths[s].epicFlux > 0)!
    const path = paths[rare]
    const family = catalog.weapons.find((w) => w.id === path.weaponId)!
    const scan = scanOf([copyOf('rare', rare, family.options[0].id, path.slotIndex)], [], 'skipped')
    const p = completionPlan(matchWeapons(scan).filter((w) => w.id === family.id), scan)
    expect(p.epicFlux).toBe(100)
    expect(p.legendaryFlux).toBe(100)
    expect(p.core).toBe(0)
  })

  it('lowers the conditional ceiling for missing historical rolls', () => {
    const historical = catalog.weapons.find((w) => w.options.some((o) => o.availability === 'historical'))!
    const scan = scanOf([], [], 'skipped')
    const p = completionPlan(matchWeapons(scan).filter((w) => w.id === historical.id), scan)
    expect(p.blocked).toHaveLength(1)
    expect(p.catalogCeilingPercent).toBeLessThan(100)
    expect(p.steps.some((s) => s.perk === p.blocked[0].perk)).toBe(false)
    expect(Object.keys(fixedStarts)).toHaveLength(66)
  })
})
