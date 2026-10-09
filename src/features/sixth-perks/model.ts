import data from './catalog.json'
import type { Catalog, Location, MatchCopy, OptionResult, ProfileRead, SchematicCopy, SixthPerksScan, WeaponResult } from './types'

export { parseItems } from './parse'

export const catalog = data as Catalog
export function matchWeapons(scan: SixthPerksScan | null): WeaponResult[] {
  const unread: ProfileRead = {status: 'error', items: [], error: null}
  const inventory = scan?.inventory ?? unread, book = scan?.book ?? unread
  const byWeapon = new Map<string, { copy: SchematicCopy; location: Location }[]>()
  for (const [location, read] of [['inventory', inventory], ['book', book]] as const) {
    if (read.status !== 'success') continue
    for (const copy of read.items) {
      const variant = catalog.variants[copy.templateId.toLowerCase()]
      if (variant) byWeapon.set(variant.weaponId, [...(byWeapon.get(variant.weaponId) ?? []), {copy, location}])
    }
  }
  return catalog.weapons.map(weapon => {
    const copies = byWeapon.get(weapon.id) ?? []
    const options: OptionResult[] = weapon.options.map(option => ({...option, inventory: [], book: []}))
    const unresolved: WeaponResult['unresolved'] = []
    for (const {copy, location} of copies) {
      const variant = catalog.variants[copy.templateId]
      let matched = false
      for (const option of options) {
        // Modern pools use the item's designated gameplay slot. Legacy asset IDs
        // can survive in earlier slots; label the actual ID/position on every copy.
        const slotIndex = copy.alterations.findIndex((pid, index) => pid !== null && option.matchIds.includes(pid)
          && (index === variant.slotIndex || catalog.knownGameplayPerks[pid]?.legacy))
        if (slotIndex < 0) continue
        const perkId = copy.alterations[slotIndex]!
        // A current row is valid only for this exact variant (aliases are legacy observations).
        if (option.availability === 'current' && !variant.allowed.includes(perkId) && !catalog.knownGameplayPerks[perkId]?.legacy) continue
        const match: MatchCopy = {...copy, location, perkId, slotIndex, rarity: variant.rarity, countsForCompletion: variant.rarity === 'Legendary', active: variant.rarity === 'Epic' ? false : copy.level === null ? null : copy.level >= variant.unlockLevel}
        option[location].push(match); matched = true
      }
      // Retain other observed gameplay effects; do not pretend they were obtainable.
      for (const [slotIndex, pid] of copy.alterations.entries()) {
        if (!pid || !pid.startsWith('alteration:aid_g_') || options.some(o => o[location].some(m => m.id === copy.id && m.perkId === pid))) continue
        let option = options.find(o => o.id === 'observed:' + pid)
        if (!option) { option = {id: 'observed:' + pid, description: catalog.knownGameplayPerks[pid]?.description ?? pid,
          matchIds: [pid], availability: 'observed', evidence: 'Observed on this account; historical availability unverified', inventory: [], book: []}; options.push(option) }
        option[location].push({...copy, location, perkId: pid, slotIndex, active: null, rarity: variant.rarity, countsForCompletion: variant.rarity === 'Legendary'}); matched = true
      }
      if (!matched) unresolved.push({copy, location})
    }
    return {...weapon, options, unresolved, inventoryCount: copies.filter(c => c.location === 'inventory').length,
      bookCount: copies.filter(c => c.location === 'book').length, inventoryUnknown: inventory.status !== 'success', bookUnknown: book.status === 'error'}
  })
}
export function ownership(option: OptionResult, weapon: WeaponResult): string {
  const inventoryLegendary = option.inventory.filter(c => c.countsForCompletion).length
  // A completed inventory roll needs no upgrade recommendation or backup location.
  // Keep all copies in the matching result for filters, planning and the details dialog.
  if (inventoryLegendary) return `In inventory (${inventoryLegendary} Legendary)`
  const owned = []
  for (const [label, copies] of [['In inventory', option.inventory], ['In Collection Book', option.book]] as const) {
    const legendary = copies.filter(c => c.countsForCompletion).length, epic = copies.filter(c => c.rarity === 'Epic').length
    if (legendary) owned.push(`${label} (${legendary} Legendary)`)
    if (epic) owned.push(`${label} (${epic} Epic — ${weapon.legendaryAvailable ? 'upgrade to Legendary to count' : 'does not count; Legendary upgrade path unverified'})`)
  }
  if (weapon.inventoryUnknown && !option.inventory.length) owned.push('Inventory unknown')
  if (weapon.bookUnknown && !option.book.length) owned.push('Collection Book unknown')
  if (owned.length) return owned.join(' · ')
  if (weapon.unresolved.length) return 'Not confirmed — unresolved copies'
  if (!option.matchIds.length) return 'Original perk ID unresolved'
  return 'Missing'
}
export function countsForCompletion(option: OptionResult): boolean {
  return [...option.inventory, ...option.book].some(c => c.countsForCompletion)
}
export function completionProgress(weapon: WeaponResult): { owned: number; total: number } {
  const options = weapon.legendaryAvailable ? weapon.options.filter(o => o.availability === 'current' || o.availability === 'historical') : []
  return {owned: options.filter(countsForCompletion).length, total: options.length}
}
export function overallCompletion(rows: WeaponResult[]) {
  const result = rows.reduce((sum, weapon) => {
    const progress = completionProgress(weapon)
    return {owned: sum.owned + progress.owned, total: sum.total + progress.total}
  }, {owned: 0, total: 0})
  return {...result, percent: result.total ? result.owned / result.total * 100 : 0,
    partial: rows.some(w => w.inventoryUnknown || w.bookUnknown || w.unresolved.length > 0)}
}
export function scanStatistics(rows: WeaponResult[]) {
  const buckets = new Map<number, number>()
  let eligible = 0, unknown = 0, excluded = 0
  for (const weapon of rows) {
    const {owned, total} = completionProgress(weapon)
    if (!total) {excluded++; continue}
    eligible++
    // Include empty buckets so the same catalog produces a stable summary.
    for (let missing = 0; missing <= total; missing++) if (!buckets.has(missing)) buckets.set(missing, 0)
    const missing = total - owned
    if (missing > 0 && (weapon.inventoryUnknown || weapon.bookUnknown || weapon.unresolved.length > 0)) {unknown++; continue}
    buckets.set(missing, (buckets.get(missing) ?? 0) + 1)
  }
  return {eligible, unknown, excluded, groups: [...buckets].sort(([a], [b]) => a - b).map(([missing, count]) => ({missing, count}))}
}
/** Filters operate on individual rolls, rather than whether a weapon family exists. */
export function matchesPerkFilter(option: OptionResult, weapon: WeaponResult, filter: string): boolean {
  const copies = [...option.inventory, ...option.book]
  if (filter === 'perk-owned') return copies.length > 0
  if (filter === 'perk-book') return option.book.length > 0
  if (filter === 'perk-upgrade') return weapon.legendaryAvailable && !countsForCompletion(option) && copies.some(c => c.rarity === 'Epic')
  if (filter === 'perk-missing') return !copies.length && !weapon.inventoryUnknown && !weapon.bookUnknown && !weapon.unresolved.length && option.matchIds.length > 0 && option.availability !== 'website-listed'
  return true
}
export function filterWeapons(rows: WeaponResult[], search: string, status: string, category: string): WeaponResult[] {
  const query = search.trim().toLowerCase()
  return rows.filter(w => (category === 'all' || w.category === category) && (!query || `${w.name} ${w.id} ${w.options.map(o => o.description).join(' ')}`.toLowerCase().includes(query)) && (
    status === 'all' || status.startsWith('perk-') && w.options.some(o => matchesPerkFilter(o, w, status)) || status === 'owned' && w.inventoryCount + w.bookCount > 0 || status === 'inventory' && w.inventoryCount > 0 ||
    status === 'book-only' && !w.inventoryUnknown && w.inventoryCount === 0 && w.bookCount > 0 ||
    status === 'incomplete' && !w.inventoryUnknown && !w.bookUnknown && !w.unresolved.length && completionProgress(w).owned < completionProgress(w).total
  ))
}
