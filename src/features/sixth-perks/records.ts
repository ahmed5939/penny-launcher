import type { ItemRecord, ItemRecordMap } from '../../kernel/core/item-database'

import { useMemo } from 'react'

import { catalog } from './model'

/**
 * The live item database, plus the catalog's own art for any weapon the
 * database has no picture for, so a card never falls back to a blank plate.
 */
export function useCatalogRecords(records: ItemRecordMap) {
  return useMemo(() => {
    const merged: ItemRecordMap = { ...records }
    for (const weapon of catalog.weapons) {
      const key = weapon.templateId.toLowerCase()
      if (merged[key]?.image || !weapon.image) continue
      merged[key] = {
        ...merged[key],
        name: weapon.name,
        rarity: weapon.legendaryAvailable ? 'Legendary' : 'Epic',
        image: weapon.image,
      } as ItemRecord
    }
    return merged
  }, [records])
}
