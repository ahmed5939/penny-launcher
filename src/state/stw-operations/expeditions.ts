import type { ExpeditionsEntry } from '../../kernel/core/expeditions'

import { create } from 'zustand'

export type ExpeditionsState = {
  data: Record<string, ExpeditionsEntry>
  isCollecting: boolean
  isLoading: boolean
  /**
   * Account selection is not a property of this tool. It lives in
   * `state/accounts/scope` and every tool reads the same one.
   */

  updateCollecting: (value: boolean) => void
  updateData: (
    data: Record<string, ExpeditionsEntry>,
    reset?: boolean
  ) => void
  updateLoading: (value: boolean) => void
}

export const useExpeditionsStore = create<ExpeditionsState>()((set) => ({
  data: {},
  isCollecting: false,
  isLoading: false,

  updateCollecting: (value) => set({ isCollecting: value }),
  updateData: (data, reset) =>
    set((state) => ({
      data: reset ? data : { ...state.data, ...data },
    })),
  updateLoading: (value) => set({ isLoading: value }),
}))
