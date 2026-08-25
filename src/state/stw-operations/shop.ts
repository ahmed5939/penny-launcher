import type { ShopEntry, ShopSection } from '../../kernel/core/shop'

import { create } from 'zustand'

export type ShopState = {
  data: Record<string, ShopEntry>
  isLoading: boolean
  isOpening: boolean
  /** Offer id currently being bought, so only that button spins. */
  purchasingOfferId: string | null
  section: ShopSection
  selectedAccounts: Array<string>

  updateAccounts: (accountIds: Array<string>) => void
  updateData: (data: Record<string, ShopEntry>, reset?: boolean) => void
  updateLoading: (value: boolean) => void
  updateOpening: (value: boolean) => void
  updatePurchasing: (offerId: string | null) => void
  updateSection: (section: ShopSection) => void
}

export const useShopStore = create<ShopState>()((set) => ({
  data: {},
  isLoading: false,
  isOpening: false,
  purchasingOfferId: null,
  section: 'llamas',
  selectedAccounts: [],

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
}))
