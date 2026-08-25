import type { ProfileEntry } from '../../kernel/core/account-health'

import { create } from 'zustand'

export type AccountHealthState = {
  data: Record<string, ProfileEntry>
  isLoading: boolean
  /**
   * Account selection is not a property of this tool. It lives in
   * `state/accounts/scope` and every tool reads the same one.
   */

  updateData: (data: Record<string, ProfileEntry>, reset?: boolean) => void
  updateLoading: (value: boolean) => void
}

export const useAccountHealthStore = create<AccountHealthState>()((set) => ({
  data: {},
  isLoading: false,

  updateData: (data, reset) =>
    set((state) => ({
      data: reset ? data : { ...state.data, ...data },
    })),
  updateLoading: (value) => set({ isLoading: value }),
}))
