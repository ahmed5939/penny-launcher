import type { ItemRecord } from '../../../kernel/core/item-database'

import { useDeferredValue, useMemo, useState } from 'react'

import { useItemDatabaseStore } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

export type CodexFamily =
  | 'hero'
  | 'melee'
  | 'ranged'
  | 'trap'
  | 'defender'
  | 'survivor'

export type CodexSort = 'rarity' | 'name'

export const codexSortOptions: Array<{ label: string; value: CodexSort }> = [
  { label: 'Rarity, high to low', value: 'rarity' },
  { label: 'Name, A to Z', value: 'name' },
]

/**
 * Names are compared the way a player reads them: `"Arrlene" Izza` files
 * under A, not ahead of everything because it opens with a quote, and
 * numbers in a name sort by value rather than digit by digit.
 */
const nameCollator = new Intl.Collator('en', {
  ignorePunctuation: true,
  numeric: true,
  sensitivity: 'base',
})

export type CodexEntry = {
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

const familyPrefix: Record<CodexFamily, string> = {
  hero: 'hero:',
  melee: 'schematic:',
  ranged: 'schematic:',
  trap: 'schematic:',
  defender: 'defender:',
  survivor: 'worker:',
}

/** Schematics are split by what they actually are, as the game splits them. */
const familyCategory: Partial<Record<CodexFamily, string>> = {
  melee: 'Melee',
  ranged: 'Ranged',
  trap: 'Trap',
}

export const codexFamilyLabels: Record<CodexFamily, string> = {
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
  family: CodexFamily
) {
  if (!templateId.startsWith(familyPrefix[family])) {
    return false
  }

  const category = familyCategory[family]

  return category === undefined || record.category === category
}

export function useCodexData() {
  useRequestItemDatabase()

  const [family, setFamily] = useState<CodexFamily>('hero')
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('all')
  const [sort, setSort] = useState<CodexSort>('rarity')

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
   * "Retractable Floor Spikes" appears 36 times. The codex is a
   * catalogue of *items*, so they collapse to one tile at the highest tier,
   * which is also the one whose art and perks people mean.
   */
  const entries = useMemo(() => {
    const grouped = new Map<string, CodexEntry>()

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

    return [...grouped.values()]
  }, [family, records])

  /** Rarest first by default, as the game's own collection screens order it. */
  const sorted = useMemo(
    () =>
      [...entries].sort(
        (entryA, entryB) =>
          (sort === 'rarity'
            ? (rarityRank[entryB.rarity ?? ''] ?? -1) -
              (rarityRank[entryA.rarity ?? ''] ?? -1)
            : 0) ||
          nameCollator.compare(entryA.name, entryB.name) ||
          entryB.tier - entryA.tier
      ),
    [entries, sort]
  )

  /** The rarities this family actually has, rarest first, for the picker. */
  const rarities = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.rarity).filter((value): value is string => Boolean(value)))].sort(
        (a, b) => (rarityRank[b] ?? -1) - (rarityRank[a] ?? -1)
      ),
    [entries]
  )

  const filtered = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase()
    const byRarity =
      rarity === 'all' ? sorted : sorted.filter((entry) => entry.rarity === rarity)

    if (needle.length <= 0) {
      return byRarity
    }

    return byRarity.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        (entry.subType ?? '').toLowerCase().includes(needle) ||
        entry.templateId.toLowerCase().includes(needle)
    )
  }, [deferredSearch, rarity, sorted])

  return {
    alterationPools,
    entries: filtered,
    family,
    familyTotal: entries.length,
    isLoading,
    rarities,
    rarity,
    ratings,
    records,
    search,
    sort,
    total,

    setFamily,
    setRarity,
    setSearch,
    setSort,
  }
}
