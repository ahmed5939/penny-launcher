import data from './planner-data.json'
import { catalog, countsForCompletion, overallCompletion } from './model'
import type { SchematicCopy, SixthPerksScan, Variant, WeaponResult } from './types'

type Path = Variant & { target: string; legendaryFlux: number; epicFlux: number }
const paths = data.paths as Record<string, Path>
export const fixedStarts = data.fixed as Record<string, {defaultPerkId: string; coreReperkCost: number}>
export type PlanStep = {weaponId: string; weapon: string; perk: string; action: string; copyId: string | null; core: number; legendaryFlux: number; epicFlux: number; conditional: boolean}
export function completionPlan(rows: WeaponResult[], scan: SixthPerksScan | null) {
  const progress = overallCompletion(rows)
  const steps: PlanStep[] = [], blocked: PlanStep[] = []
  let fixedMissing = 0
  for (const weapon of rows) {
    if (!weapon.legendaryAvailable) continue
    const missing = weapon.options.filter(o => ['current', 'historical'].includes(o.availability) && !countsForCompletion(o))
    const fixed = fixedStarts[weapon.id]
    if (fixed && missing.some(o => o.availability === 'current' && o.id !== fixed.defaultPerkId)) fixedMissing++
    // Book entries can establish completion but cannot be spent without unslotting.
    // Protect one inventory copy of every completed effect, including observed rolls.
    const protectedIds = new Set<string>()
    for (const option of weapon.options) {
      const keeper = option.inventory.find(c => c.countsForCompletion)
      if (keeper) protectedIds.add(keeper.id)
    }
    const candidates: {copy: SchematicCopy; variant: Variant; path?: Path}[] = []
    if (scan?.inventory.status === 'success') for (const copy of scan.inventory.items) {
      const variant = catalog.variants[copy.templateId], path = paths[copy.templateId]
      if ((variant?.weaponId ?? path?.weaponId) !== weapon.id || protectedIds.has(copy.id)) continue
      if (variant?.rarity === 'Legendary') candidates.push({copy, variant})
      else if (path) candidates.push({copy, variant: path, path})
    }
    candidates.sort((a, b) => ((a.path?.legendaryFlux ?? 0) + (a.path?.epicFlux ?? 0)) - ((b.path?.legendaryFlux ?? 0) + (b.path?.epicFlux ?? 0)) || a.copy.id.localeCompare(b.copy.id))
    const used = new Set<string>()
    const remaining = []
    // Exact lower-rarity rolls are always preferable to spending a Core RE-PERK.
    for (const option of missing) {
      const exact = candidates.find(c => c.path && !used.has(c.copy.id) && option.matchIds.some(id => c.copy.alterations[c.variant.slotIndex] === id))
      if (exact) {
        used.add(exact.copy.id)
        steps.push({weaponId: weapon.id, weapon: weapon.name, perk: option.description, action: 'Increase rarity, preserving this perk', copyId: exact.copy.id, core: 0, legendaryFlux: exact.path!.legendaryFlux, epicFlux: exact.path!.epicFlux, conditional: false})
      } else remaining.push(option)
    }
    for (const option of remaining) {
      if (option.availability === 'historical') {
        blocked.push({weaponId: weapon.id, weapon: weapon.name, perk: option.description, action: option.book.some(c => c.rarity === 'Epic') ? 'Epic Collection Book roll: unslotting and preservation need verification' : 'Historical perk: no verified acquisition path', copyId: null, core: 0, legendaryFlux: 0, epicFlux: 0, conditional: true})
        continue
      }
      const spare = candidates.find(c => !used.has(c.copy.id) && c.variant.allowed.includes(option.id) && c.copy.alterations[c.variant.slotIndex] !== null && Boolean(c.copy.alterations[c.variant.slotIndex]))
      if (spare) used.add(spare.copy.id)
      steps.push({weaponId: weapon.id, weapon: weapon.name, perk: option.description, action: spare ? (spare.path ? 'Increase spare copy rarity, then change perk' : 'Change perk on spare Legendary copy') : 'Acquire an extra Legendary schematic with this perk, or change its perk', copyId: spare?.copy.id ?? null, core: spare ? 1 : fixed && option.id !== fixed.defaultPerkId ? 1 : 0, legendaryFlux: spare?.path?.legendaryFlux ?? 0, epicFlux: spare?.path?.epicFlux ?? 0, conditional: !spare})
    }
  }
  steps.sort((a, b) => Number(a.conditional) - Number(b.conditional) || a.core - b.core || (a.legendaryFlux + a.epicFlux) - (b.legendaryFlux + b.epicFlux) || a.weapon.localeCompare(b.weapon))
  const ready = steps.filter(s => !s.conditional), later = steps.filter(s => s.conditional)
  const total = (items: PlanStep[], key: 'core' | 'legendaryFlux' | 'epicFlux') => items.reduce((sum, s) => sum + s[key], 0)
  return {steps, blocked, fixedTotal: Object.keys(fixedStarts).length, fixedMissing, readyCount: ready.length, extraSchematics: later.length,
    core: total(ready, 'core'), legendaryFlux: total(ready, 'legendaryFlux'), epicFlux: total(ready, 'epicFlux'),
    additionalCoreLower: total(later, 'core'), additionalCoreUpper: later.length,
    afterReadyPercent: progress.total ? (progress.owned + ready.length) / progress.total * 100 : 0,
    catalogCeilingPercent: progress.total ? (progress.total - blocked.length) / progress.total * 100 : 0,
    partial: progress.partial}
}
