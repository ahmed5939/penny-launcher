import type { Backdrop, HomeArt } from '../../config/backdrops'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type BackdropState = {
  /** Home's hero art: `theme` follows the colour theme. */
  homeArt: HomeArt | 'theme'
  /** Art a page picked for itself (the live season), over its route's. */
  override: Backdrop | null
  setHomeArt: (homeArt: HomeArt | 'theme') => void
  setOverride: (override: Backdrop | null) => void
}

export const useBackdropStore = create<BackdropState>()(
  persist(
    (set) => ({
      homeArt: 'theme',
      override: null,
      setHomeArt: (homeArt) => set({ homeArt }),
      setOverride: (override) => set({ override }),
    }),
    {
      name: 'penny-backdrop',
      partialize: ({ homeArt }) => ({ homeArt }),
    },
  ),
)
