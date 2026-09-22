import weapons from './weapon-display.json'
import perks from './weapon-perks.json'
import type { ItemRecordMap } from '../../kernel/core/item-database'
type Display = { name: string; image: string | null; largeImage: string | null; description: string | null; rarity: string | null; tier: number; displayTier: string | null }
type Perk = { description: string; rarity: string | null; system: string }
export function worldItemDisplay(id: string, records: ItemRecordMap): Display | null {
  return records[id.toLowerCase()] ?? (weapons as Record<string, Display>)[id.toLowerCase()] ?? null
}
export function worldPerkDisplay(id: string | null, records: ItemRecordMap): Perk {
  if (!id) return { description: 'Empty perk slot', rarity: null, system: 'empty' }
  const known = (perks as Record<string, Perk>)[id.toLowerCase()]
  const record = records[id.toLowerCase()]
  return { description: (known?.description ?? record?.description ?? record?.name ?? `Unrecognized perk: ${id}`).replace(/<[^>]+>/g, ''), rarity: known?.rarity ?? record?.rarity ?? null, system: known?.system ?? 'unknown' }
}
export const rollColors: Record<string, string> = { Common: '#bfbaba', Uncommon: '#04c577', Rare: '#51a1db', Epic: '#d076f6', Legendary: '#ed7e39', Mythic: '#ffd93d' }
