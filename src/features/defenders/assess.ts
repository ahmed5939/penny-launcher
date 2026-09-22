import type { InventoryItem } from '../../kernel/core/inventory'
import type { DefenderAssessment, DefenderCatalog, DefenderClass } from './types'

const classes: DefenderClass[] = ['Assault', 'Pistol', 'Sniper', 'Shotgun', 'Melee']
export function assessDefender(item: InventoryItem, catalog: DefenderCatalog): DefenderAssessment {
  const className = classes.find(c => item.templateId.toLowerCase().includes(`did_defender${c.toLowerCase()}_`)) ?? null
  const perks: Array<DefenderAssessment['perks'][number] & { subtype?: string }> = item.alterations.map(id => {
    const p = catalog.defenderPerks[id.toLowerCase()]
    return { id, description: p?.description ?? `Unrecognised perk: ${id}`, kind: p?.kind ?? 'unknown' as const, subtype: p?.subtype }
  })
  const weapon = perks.filter(p => p.kind === 'weapon')
  const subtypes = new Map<string, number>()
  weapon.forEach(p => { if (p.subtype) subtypes.set(p.subtype, (subtypes.get(p.subtype) ?? 0) + 1) })
  const maximum = Math.max(0, ...subtypes.values())
  const effectiveWeaponPerks = weapon.filter(p => !p.subtype).length + maximum
  const bestSubtypes = [...subtypes].filter(([, n]) => n === maximum).map(([s]) => s)
  const unknownPerks = perks.filter(p => p.kind === 'unknown').length
  const highRarity = ['epic', 'legendary'].includes(item.rarity)
  const band = !className || unknownPerks ? 0 : highRarity && effectiveWeaponPerks >= 3 ? 4 : effectiveWeaponPerks >= 3 ? 3 : effectiveWeaponPerks === 2 ? 2 : effectiveWeaponPerks === 1 ? 1 : 0
  const label = !className || unknownPerks ? 'Needs review' : ['Survival / utility', 'One weapon perk', 'Useful weapon roll', 'Three weapon perks', 'Strong weapon roll'][band]
  const reasons = [`${effectiveWeaponPerks} weapon perk${effectiveWeaponPerks === 1 ? '' : 's'} can support one matching weapon.`]
  if (highRarity && effectiveWeaponPerks >= 3) reasons.push('Epic or Legendary with three compatible weapon perks: a strong roll to keep and compare.')
  if (subtypes.size > 1) reasons.push('Different melee subtype bonuses cannot all apply to one weapon. This ranking counts only the best matching subtype.')
  if (perks.some(p => p.kind === 'survival')) reasons.push('Health, shield and regeneration support survival, but do not count as weapon perks.')
  if (perks.some(p => p.kind === 'redundant')) reasons.push('Ammo saving and durability receive no value under the current defender rules.')
  if (unknownPerks) reasons.push('Unknown perks are left unscored instead of guessing their usefulness.')
  return { item, className, weaponPerks: weapon.length, effectiveWeaponPerks, survivalPerks: perks.filter(p => p.kind === 'survival').length, unknownPerks, subtypes: bestSubtypes, label, band, reasons, perks }
}

/** Roll quality first, with level only a tie-breaker. No universal DPS score. */
export function compareDefenders(a: DefenderAssessment, b: DefenderAssessment) {
  const rarity = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }
  return b.band - a.band || b.effectiveWeaponPerks - a.effectiveWeaponPerks || rarity[b.item.rarity] - rarity[a.item.rarity] || b.item.level - a.item.level || a.item.itemId.localeCompare(b.item.itemId)
}
