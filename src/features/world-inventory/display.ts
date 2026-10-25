import weapons from './weapon-display.json'
import perks from './weapon-perks.json'
import type { ItemRecordMap } from '../../kernel/core/item-database'
type Display = { name: string; image: string | null; largeImage: string | null; description: string | null; rarity: string | null; tier: number; displayTier: string | null }
type Perk = { description: string; rarity: string | null; system: string }
export function worldItemDisplay(id: string, records: ItemRecordMap): Display | null {
  return records[id.toLowerCase()] ?? (weapons as Record<string, Display>)[id.toLowerCase()] ?? null
}
const perkTiers = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
/** The game's own tier suffix: `_t03` is Rare; a legacy `_alt2` is the tier after its base, so Rare too. */
function rarityFromId(id: string) {
  const tier = /_t0?([1-5])$/i.exec(id)
  const alt = /_alt([1-4])$/i.exec(id)
  return tier ? perkTiers[Number(tier[1]) - 1] : alt ? perkTiers[Number(alt[1])] : null
}
export function worldPerkDisplay(id: string | null, records: ItemRecordMap): Perk {
  if (!id) return { description: 'Empty perk slot', rarity: null, system: 'empty' }
  const known = (perks as Record<string, Perk>)[id.toLowerCase()]
  const record = records[id.toLowerCase()]
  return { description: (known?.description ?? record?.description ?? record?.name ?? `Unrecognized perk: ${id}`).replace(/<[^>]+>/g, ''), rarity: known?.rarity ?? record?.rarity ?? rarityFromId(id), system: known?.system ?? 'unknown' }
}
