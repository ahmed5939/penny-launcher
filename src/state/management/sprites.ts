import type {
  SpriteCollection,
  SpritesPayload,
} from '../../kernel/core/sprites'

import { create } from 'zustand'

export type SpritesState = {
  /** Which account the collection belongs to. */
  loadedFor: string | null
  collection: SpriteCollection | null
  errorMessage: string | null
  isLoading: boolean

  reset: () => void
  setLoading: (value: boolean) => void
  setPayload: (payload: SpritesPayload) => void
}

export const useSpritesStore = create<SpritesState>()((set) => ({
  loadedFor: null,
  collection: null,
  errorMessage: null,
  isLoading: false,

  reset: () =>
    set({
      loadedFor: null,
      collection: null,
      errorMessage: null,
      isLoading: false,
    }),
  setLoading: (value) => set({ isLoading: value }),
  setPayload: (payload) =>
    set({
      collection: payload.collection,
      errorMessage: payload.errorMessage ?? null,
      loadedFor: payload.accountId,
      isLoading: false,
    }),
}))
