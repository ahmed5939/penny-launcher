import type { AccountData } from '../../types/accounts'

import { immer } from 'zustand/middleware/immer'
import { create } from 'zustand'

export enum RedeemCodesStatus {
  ERROR = 'error',
  LOADING = 'loading',
  NOT_FOUND = 'not-found',
  OWNED = 'owned',
  SUCCESS = 'success',
  USED = 'used',
}

export type RedeemCodesCodeData = {
  status: RedeemCodesStatus
  value: string
}

export type RedeemCodesData = {
  account: AccountData
  codes: Record<string, RedeemCodesCodeData>
}

export type RedeemCodesState = {
  /**
   * Account selection is not a property of this tool. It lives in
   * `state/accounts/scope` and every tool reads the same one.
   */
  codes: string
  isLoading: boolean
  notifications: Record<string, RedeemCodesData>
  tags: Array<string>

  updateCodes: (value: string) => void
  updateLoading: (state: boolean) => void
  updateTags: (tags: Array<string>) => void

  setInitialResponse: (value: Record<string, RedeemCodesData>) => void
  updateResponse: (
    accountId: string,
    code: {
      status: RedeemCodesStatus
      value: string
    }
  ) => void
}

export const useRedeemCodesStore = create<RedeemCodesState>()(
  immer((set) => ({
    codes: '',
    isLoading: false,
    notifications: {},
    tags: [],

    updateCodes: (value) => set({ codes: value }),
    updateLoading: (state) => set({ isLoading: state }),
    updateTags: (tags) =>
      set({
        tags: [...new Set(tags)],
      }),

    setInitialResponse: (value) => set({ notifications: value }),
    updateResponse: (accountId, code) => {
      set((state) => {
        state.notifications[accountId].codes[code.value].status =
          code.status
      })
    },
  }))
)
