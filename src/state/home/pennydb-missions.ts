import type { PennyDBMissionsByZone } from '../../services/endpoints/pennydb'
import type { PennyDBMissionsPayload } from '../../kernel/core/pennydb-missions'

import { create } from 'zustand'

export type PennyDBMissionsState = {
  errorMessage: string | null
  isLoading: boolean
  lastUpdatedAt: number | null
  missions: PennyDBMissionsByZone

  setLoading: (value: boolean) => void
  setResponse: (payload: PennyDBMissionsPayload) => void
}

export const usePennyDBMissionsStore = create<PennyDBMissionsState>()(
  (set) => ({
    errorMessage: null,
    isLoading: false,
    lastUpdatedAt: null,
    missions: {},

    setLoading: (value) => set({ isLoading: value }),
    setResponse: (payload) =>
      set({
        errorMessage: payload.errorMessage ?? null,
        isLoading: false,
        lastUpdatedAt: payload.fetchedAt,
        missions: payload.missions,
      }),
  })
)
