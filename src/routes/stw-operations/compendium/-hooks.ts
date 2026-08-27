import type { ItemRecord } from '../../../kernel/core/item-database'

import { useDeferredValue, useMemo, useState } from 'react'

import { useItemDatabaseStore } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

export type CompendiumFamily =
  | 'hero'
  | 'melee'
  | 'ranged'
  | 'trap'
  | 'defender'
  | 'survivor'

export type CompendiumEntry = {
  /** Highest-tier template id — the one shown and inspected. */
  templateId: string
  name: string
  subType: string | null
  rarity: string | null
  tier: number
  /** How many tiers of this item exist. */
  tiers: number
}

const rarityRank: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythic: 5,
}

const familyPrefix: Record<CompendiumFamily, string> = {
  hero: 'hero:',
  melee: 'schematic:',
  ranged: 'schematic:',
  trap: 'schematic:',
  defender: 'defender:',
  survivor: 'worker:',
}

/** Schematics are split by what they actually are, as the game splits them. */
const familyCategory: Partial<Record<CompendiumFamily, string>> = {
  melee: 'Melee',
  ranged: 'Ranged',
  trap: 'Trap',
}

export const compendiumFamilyLabels: Record<CompendiumFamily, string> = {
  hero: 'Heroes',
  melee: 'Melee',
  ranged: 'Ranged',
  trap: 'Traps',
  defender: 'Defenders',
  survivor: 'Survivors',
}

function matchesFamily(
  templateId: string,
  record: ItemRecord,
  family: CompendiumFamily
) {
  if (!templateId.startsWith(familyPrefix[family])) {
    return false
  }

  const category = familyCategory[family]

  return category === undefined || record.category === category
}

export function useCompendiumData() {
  useRequestItemDatabase()

  const [family, setFamily] = useState<CompendiumFamily>('hero')
  const [search, setSearch] = useState('')

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)
  const alterationPools = useItemDatabaseStore(
    (state) => state.alterationPools
  )
  const isLoading = useItemDatabaseStore((state) => state.isLoading)
  const total = useItemDatabaseStore((state) => state.total)

  /** Typing in a 4,000-tile grid is the one place this genuinely janks. */
  const deferredSearch = useDeferredValue(search)

  /**
   * The database carries every tier of every item as its own entry —
   * "Retractable Floor Spikes" appears 36 times. The compendium is a
   * catalogue of *items*, so they collapse to one tile at the highest tier,
   * which is also the one whose art and perks people mean.
   */
  const entries = useMemo(() => {
    const grouped = new Map<string, CompendiumEntry>()

    Object.entries(records).forEach(([templateId, record]) => {
      if (!matchesFamily(templateId, record, family)) {
        return
      }

      const key = `${record.name}::${record.subType ?? ''}`
      const current = grouped.get(key)

      if (!current) {
        grouped.set(key, {
          templateId,
          name: record.name,
          subType: record.subType,
          rarity: record.rarity,
          tier: record.tier,
          tiers: Math.max(1, record.tier),
        })

        return
      }

      current.tiers = Math.max(current.tiers, record.tier)

      const rarityIsHigher =
        (rarityRank[record.rarity ?? ''] ?? -1) >
        (rarityRank[current.rarity ?? ''] ?? -1)

      if (
        rarityIsHigher ||
        (record.rarity === current.rarity && record.tier > current.tier)
      ) {
        current.templateId = templateId
        current.rarity = record.rarity
        current.tier = record.tier
      }
    })

    return [...grouped.values()].sort(
      (entryA, entryB) =>
        entryA.name.localeCompare(entryB.name) || entryA.tier - entryB.tier
    )
  }, [family, records])

  const filtered = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase()

    if (needle.length <= 0) {
      return entries
    }

    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        (entry.subType ?? '').toLowerCase().includes(needle) ||
        entry.templateId.toLowerCase().includes(needle)
    )
  }, [deferredSearch, entries])

  return {
    alterationPools,
    entries: filtered,
    family,
    isLoading,
    ratings,
    records,
    search,
    total,

    setFamily,
    setSearch,
  }
}
