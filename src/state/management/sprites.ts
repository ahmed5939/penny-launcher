import type {
  SpriteCollection,
  SpritesPayload,
} from '../../kernel/core/sprites'

import { create } from 'zustand'

export type SpritesState = {
  /** Which account the collection belongs to. */
  loadedFor: string | null
  requestedFor: string | null
  collection: SpriteCollection | null
  errorMessage: string | null
  isLoading: boolean

  reset: () => void
  setLoading: (accountId: string) => void
  setPayload: (payload: SpritesPayload) => void
}

export const useSpritesStore = create<SpritesState>()((set) => ({
  loadedFor: null,
  requestedFor: null,
  collection: null,
  errorMessage: null,
  isLoading: false,

  reset: () =>
    set({
      loadedFor: null,
      requestedFor: null,
      collection: null,
      errorMessage: null,
      isLoading: false,
    }),
  setLoading: (accountId) =>
    set((state) => ({
      requestedFor: accountId,
      loadedFor: state.loadedFor === accountId ? state.loadedFor : null,
      collection: state.loadedFor === accountId ? state.collection : null,
      errorMessage: null,
      isLoading: true,
    })),
  setPayload: (payload) =>
    set((state) =>
      state.requestedFor === payload.accountId
        ? {
            collection: payload.collection,
            errorMessage: payload.errorMessage ?? null,
            loadedFor: payload.accountId,
            isLoading: false,
          }
        : state
    ),
}))
