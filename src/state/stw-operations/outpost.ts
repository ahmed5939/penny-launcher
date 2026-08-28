import type {
  OutpostBaseData,
  OutpostInfoResult,
  OutpostZoneInfo,
} from '../../kernel/core/outpost-types'

import { create } from 'zustand'

export type OutpostState = {
  zones: Array<OutpostZoneInfo>
  /** Base scans per zone id — filled in on demand. */
  baseData: Record<string, OutpostBaseData>
  /** The zone currently being scanned or whose scan is pending. */
  loadingZone: string | null
  infoLoading: boolean
  errorMessage: string | null

  setInfoLoading: (value: boolean) => void
  setInfo: (result: OutpostInfoResult) => void
  setBaseData: (zoneId: string, data: OutpostBaseData) => void
  setLoadingZone: (zoneId: string | null) => void
  setError: (message: string | null) => void
}

export const useOutpostStore = create<OutpostState>()((set) => ({
  zones: [],
  baseData: {},
  loadingZone: null,
  infoLoading: false,
  errorMessage: null,

  setInfoLoading: (value) => set({ infoLoading: value }),
  setInfo: (result) =>
    set({
      zones: result.zones,
      errorMessage: result.error ?? null,
      infoLoading: false,
      /**
       * Zones re-fetch on every account change; stale base scans would
       * silently describe the previous account's base.
       */
      baseData: {},
    }),
  setBaseData: (zoneId, data) =>
    set((state) => ({
      baseData: { ...state.baseData, [zoneId]: data },
    })),
  setLoadingZone: (zoneId) => set({ loadingZone: zoneId }),
  setError: (message) => set({ errorMessage: message }),
}))
