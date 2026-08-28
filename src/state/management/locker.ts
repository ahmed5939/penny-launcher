import type {
  LockerCardFilters,
  LockerCardNotification,
  LockerOwnedPayload,
  LockerPayload,
  LockerSlotState,
} from '../../kernel/core/locker'
import type { LockerSlotKey } from '../../config/fortnite/locker'

import { create } from 'zustand'

export type LockerCard = NonNullable<LockerCardNotification['card']>

export type LockerState = {
  /** Which account the board and the owned list belong to. */
  loadedFor: string | null
  slots: Record<string, LockerSlotState>
  errorMessage: string | null
  isLoading: boolean

  owned: Array<LockerOwnedPayload['cosmetics'][number]>
  ownedError: string | null
  ownedLoadedFor: string | null
  isLoadingOwned: boolean

  /** The slot whose picker is open, or null. */
  pickerSlot: LockerSlotKey | null
  /** The slot with an equip in flight, so only that tile spins. */
  equipping: LockerSlotKey | null

  filters: LockerCardFilters
  isGenerating: boolean
  progress: { done: number; total: number } | null
  card: LockerCard | null
  cardError: string | null

  closePicker: () => void
  openPicker: (slotKey: LockerSlotKey) => void
  reset: () => void
  setCard: (notification: LockerCardNotification) => void
  setEquipping: (slotKey: LockerSlotKey | null) => void
  setFilters: (filters: Partial<LockerCardFilters>) => void
  setGenerating: (value: boolean) => void
  setLoading: (value: boolean) => void
  setLoadingOwned: (value: boolean) => void
  setOwned: (payload: LockerOwnedPayload) => void
  setProgress: (progress: { done: number; total: number } | null) => void
  setResponse: (payload: LockerPayload) => void
}

const defaultFilters: LockerCardFilters = {
  groups: [],
  rarities: [],
  chapters: [],
  equippedOnly: false,
}

export const useLockerStore = create<LockerState>()((set) => ({
  loadedFor: null,
  slots: {},
  errorMessage: null,
  isLoading: false,

  owned: [],
  ownedError: null,
  ownedLoadedFor: null,
  isLoadingOwned: false,

  pickerSlot: null,
  equipping: null,

  filters: defaultFilters,
  isGenerating: false,
  progress: null,
  card: null,
  cardError: null,

  closePicker: () => set({ pickerSlot: null }),
  openPicker: (slotKey) => set({ pickerSlot: slotKey }),
  reset: () =>
    set({
      loadedFor: null,
      slots: {},
      errorMessage: null,
      isLoading: false,
      owned: [],
      ownedError: null,
      ownedLoadedFor: null,
      isLoadingOwned: false,
      pickerSlot: null,
      equipping: null,
      card: null,
      cardError: null,
      progress: null,
      isGenerating: false,
    }),
  setCard: (notification) =>
    set({
      card: notification.card ?? null,
      cardError: notification.errorMessage ?? null,
      isGenerating: false,
      progress: null,
    }),
  setEquipping: (slotKey) => set({ equipping: slotKey }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  setGenerating: (value) =>
    set({
      isGenerating: value,
      ...(value ? { cardError: null, progress: null } : {}),
    }),
  setLoading: (value) => set({ isLoading: value }),
  setLoadingOwned: (value) => set({ isLoadingOwned: value }),
  setOwned: (payload) =>
    set({
      owned: payload.cosmetics,
      ownedError: payload.errorMessage ?? null,
      ownedLoadedFor: payload.accountId,
      isLoadingOwned: false,
    }),
  setProgress: (progress) => set({ progress }),
  setResponse: (payload) =>
    set({
      slots: payload.slots,
      errorMessage: payload.errorMessage ?? null,
      loadedFor: payload.accountId,
      isLoading: false,
      equipping: null,
    }),
}))
