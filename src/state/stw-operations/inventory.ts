import type { InventoryEntry } from '../../kernel/core/inventory'
import type {
  ItemKind,
  Rarity,
} from '../../config/constants/fortnite/items'

import { create } from 'zustand'

export type InventoryFilters = {
  kinds: Array<ItemKind>
  /** Nothing above this rarity is offered for recycling. */
  maxRarity: Rarity
  /** 0 means "any tier". */
  maxTier: number
  search: string
}

/** The vault opens showing everything; the filters narrow it from there. */
export const defaultInventoryFilters: InventoryFilters = {
  kinds: ['schematic', 'hero', 'defender', 'survivor'],
  maxRarity: 'mythic',
  maxTier: 0,
  search: '',
}

/**
 * `browse` inspects items, `recycle` selects them. Two modes rather than one
 * click that means different things depending on whether an item happens to
 * be favourited — every item is visible in both.
 */
export type InventoryMode = 'browse' | 'recycle'

export type InventoryState = {
  data: Record<string, InventoryEntry>
  filters: InventoryFilters
  isLoading: boolean
  isRecycling: boolean
  mode: InventoryMode
  /** Account id → item GUIDs the user ticked. */
  selection: Record<string, Array<string>>
  selectedAccounts: Array<string>

  clearSelection: () => void
  updateMode: (mode: InventoryMode) => void
  updateAccounts: (accountIds: Array<string>) => void
  updateData: (
    data: Record<string, InventoryEntry>,
    reset?: boolean
  ) => void
  updateFilters: (filters: Partial<InventoryFilters>) => void
  updateLoading: (value: boolean) => void
  updateRecycling: (value: boolean) => void
  updateSelection: (accountId: string, itemIds: Array<string>) => void
}

export const useInventoryStore = create<InventoryState>()((set) => ({
  data: {},
  filters: defaultInventoryFilters,
  isLoading: false,
  isRecycling: false,
  mode: 'browse',
  selection: {},
  selectedAccounts: [],

  clearSelection: () => set({ selection: {} }),
  updateMode: (mode) => set({ mode }),
  updateAccounts: (accountIds) =>
    set({
      selectedAccounts: [...new Set(accountIds)],
    }),
  updateData: (data, reset) =>
    set((state) => ({
      data: reset ? data : { ...state.data, ...data },
      /** A refetch invalidates every GUID the user had ticked. */
      selection: reset ? {} : state.selection,
    })),
  updateFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
  updateLoading: (value) => set({ isLoading: value }),
  updateRecycling: (value) => set({ isRecycling: value }),
  updateSelection: (accountId, itemIds) =>
    set((state) => ({
      selection: { ...state.selection, [accountId]: [...new Set(itemIds)] },
    })),
}))
