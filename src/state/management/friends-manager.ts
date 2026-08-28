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
  /**
   * True while the Friends hub page is mounted, so the list stays loaded
   * even if the docked panel is closed.
   */
  isHubActive: boolean
  isSearching: boolean
  /** Account ids we asked the party service to invite, awaiting a reply. */
  inviting: Array<string>
  /** Account ids with an action in flight, so rows can disable per-row. */
  pending: Array<string>
  searchResults: Array<FriendsSearchResult>

  closePanel: () => void
  openPanel: () => void
  setHubActive: (value: boolean) => void
  setInviting: (accountId: string, value: boolean) => void
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

function toggleId(list: Array<string>, accountId: string, value: boolean) {
  return value
    ? [...new Set([...list, accountId])]
    : list.filter((item) => item !== accountId)
}

export const useFriendsManagerStore = create<FriendsManagerState>()(
  (set) => ({
    entries: [],
    errorMessage: null,
    loadedFor: null,
    limitsReached: undefined,
    isLoading: false,
    isOpen: false,
    isHubActive: false,
    isSearching: false,
    inviting: [],
    pending: [],
    searchResults: [],

    closePanel: () => set({ isOpen: false }),
    openPanel: () => set({ isOpen: true }),
    setHubActive: (value) => set({ isHubActive: value }),
    setInviting: (accountId, value) =>
      set((state) => ({
        inviting: toggleId(state.inviting, accountId, value),
      })),
    setPending: (accountId, value) =>
      set((state) => ({
        pending: toggleId(state.pending, accountId, value),
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
