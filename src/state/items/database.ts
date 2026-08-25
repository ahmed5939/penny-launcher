import type {
  AlterationSlotPool,
  ItemRecord,
  ItemRecordMap,
} from '../../kernel/core/item-database'
import type { RatingTables } from '../../config/constants/fortnite/power'

import { create } from 'zustand'

export type ItemDatabaseState = {
  alterationPools: Record<string, Array<AlterationSlotPool>>
  errorMessage: string | null
  fetchedAt: string | null
  isLoading: boolean
  ratings: RatingTables
  records: ItemRecordMap
  total: number

  update: (payload: {
    alterationPools?: Record<string, Array<AlterationSlotPool>>
    errorMessage?: string
    fetchedAt: string | null
    ratings?: RatingTables
    records: ItemRecordMap
    total: number
  }) => void
  updateLoading: (value: boolean) => void
}

export const useItemDatabaseStore = create<ItemDatabaseState>()((set) => ({
  alterationPools: {},
  errorMessage: null,
  fetchedAt: null,
  isLoading: false,
  ratings: {},
  records: {},
  total: 0,

  update: (payload) =>
    set({
      alterationPools: payload.alterationPools ?? {},
      errorMessage: payload.errorMessage ?? null,
      fetchedAt: payload.fetchedAt,
      isLoading: false,
      ratings: payload.ratings ?? {},
      records: payload.records,
      total: payload.total,
    }),
  updateLoading: (value) => set({ isLoading: value }),
}))

/**
 * Reads one item straight from the store.
 *
 * Deliberately not a hook: the item grids call this thousands of times per
 * render, and a subscription per row would re-render the whole page every
 * time the database landed. Components that need to react to the download
 * finishing subscribe to `records` once, at the top.
 */
export function getItemRecord(
  records: ItemRecordMap,
  templateId: string
): ItemRecord | null {
  return records[templateId.toLowerCase()] ?? null
}
