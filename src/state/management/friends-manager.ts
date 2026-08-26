import type {
  FriendEntry,
  FriendsPayload,
  FriendsSearchResult,
} from '../../kernel/core/friends-manager'

import { create } from 'zustand'

export type FriendsManagerState = {
  entries: Array<FriendEntry>
  errorMessage: string | null
  /** Account id the loaded list belongs to. */
  loadedFor: string | null
  limitsReached: FriendsPayload['limitsReached']
  isLoading: boolean
  isOpen: boolean
  isSearching: boolean
  /** Account ids with an action in flight, so rows can disable per-row. */
  pending: Array<string>
  searchResults: Array<FriendsSearchResult>

  closePanel: () => void
  openPanel: () => void
  setPending: (accountId: string, value: boolean) => void
  setResponse: (config: {
    accountId: string
    entries: Array<FriendEntry>
    errorMessage?: string
    limitsReached?: FriendsPayload['limitsReached']
  }) => void
  setSearching: (value: boolean) => void
  setSearchResults: (results: Array<FriendsSearchResult>) => void
  togglePanel: () => void
  updateLoading: (value: boolean) => void
}

export const useFriendsManagerStore = create<FriendsManagerState>()(
  (set) => ({
    entries: [],
    errorMessage: null,
    loadedFor: null,
    limitsReached: undefined,
    isLoading: false,
    isOpen: false,
    isSearching: false,
    pending: [],
    searchResults: [],

    closePanel: () => set({ isOpen: false }),
    openPanel: () => set({ isOpen: true }),
    setPending: (accountId, value) =>
      set((state) => ({
        pending: value
          ? [...new Set([...state.pending, accountId])]
          : state.pending.filter((item) => item !== accountId),
      })),
    setResponse: ({ accountId, entries, errorMessage, limitsReached }) =>
      set({
        entries,
        errorMessage: errorMessage ?? null,
        isLoading: false,
        loadedFor: accountId,
        limitsReached,
      }),
    setSearching: (value) => set({ isSearching: value }),
    setSearchResults: (results) =>
      set({ isSearching: false, searchResults: results }),
    togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
    updateLoading: (value) => set({ isLoading: value }),
  })
)
