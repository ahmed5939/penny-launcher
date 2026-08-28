import type {
  ShopCatalogPayload,
  ShopEntry,
  ShopSection,
  ShopView,
} from '../../kernel/core/shop'

import { create } from 'zustand'

export type ShopState = {
  data: Record<string, ShopEntry>
  isLoading: boolean
  isOpening: boolean
  /** Offer id currently being bought, so only that button spins. */
  purchasingOfferId: string | null
  section: ShopSection
  selectedAccounts: Array<string>
  view: ShopView
  catalog: ShopCatalogPayload | null
  catalogLoading: boolean
  catalogSection: string

  updateAccounts: (accountIds: Array<string>) => void
  updateData: (data: Record<string, ShopEntry>, reset?: boolean) => void
  updateLoading: (value: boolean) => void
  updateOpening: (value: boolean) => void
  updatePurchasing: (offerId: string | null) => void
  updateSection: (section: ShopSection) => void
  updateView: (view: ShopView) => void
  updateCatalog: (catalog: ShopCatalogPayload) => void
  updateCatalogLoading: (value: boolean) => void
  updateCatalogSection: (section: string) => void
}

export const useShopStore = create<ShopState>()((set) => ({
  data: {},
  isLoading: false,
  isOpening: false,
  purchasingOfferId: null,
  section: 'llamas',
  selectedAccounts: [],
  view: 'account',
  catalog: null,
  catalogLoading: false,
  catalogSection: 'all',

  updateAccounts: (accountIds) =>
    set({
      selectedAccounts: [...new Set(accountIds)],
    }),
  updateData: (data, reset) =>
    set((state) => ({
      data: reset ? data : { ...state.data, ...data },
    })),
  updateLoading: (value) => set({ isLoading: value }),
  updateOpening: (value) => set({ isOpening: value }),
  updatePurchasing: (offerId) => set({ purchasingOfferId: offerId }),
  updateSection: (section) => set({ section }),
  updateView: (view) => set({ view }),
  updateCatalog: (catalog) => set({ catalog }),
  updateCatalogLoading: (value) => set({ catalogLoading: value }),
  updateCatalogSection: (section) => set({ catalogSection: section }),
}))
