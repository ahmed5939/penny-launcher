import type { ExpeditionsEntry } from '../../kernel/core/expeditions'

import { create } from 'zustand'

export type ExpeditionsState = {
  data: Record<string, ExpeditionsEntry>
  isCollecting: boolean
  isLoading: boolean
  pending: Array<string>
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
  updatePending: (itemId: string, value: boolean) => void
}

export const useExpeditionsStore = create<ExpeditionsState>()((set) => ({
  data: {},
  isCollecting: false,
  isLoading: false,
  pending: [],

  updateCollecting: (value) => set({ isCollecting: value }),
  updateData: (data, reset) =>
    set((state) => ({
      data: reset ? data : { ...state.data, ...data },
    })),
  updateLoading: (value) => set({ isLoading: value }),
  updatePending: (itemId, value) =>
    set((state) => ({
      pending: value
        ? [...new Set([...state.pending, itemId])]
        : state.pending.filter((id) => id !== itemId),
    })),
}))
