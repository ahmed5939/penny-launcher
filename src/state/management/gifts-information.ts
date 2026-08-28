import type { GiftsInformationEntry } from '../../kernel/core/gifts-information'

import { immer } from 'zustand/middleware/immer'
import { create } from 'zustand'

export type GiftsInformationData = GiftsInformationEntry

export type GiftsInformationState = {
  /**
   * Account selection is not a property of this tool. It lives in
   * `state/accounts/scope` and every tool reads the same one.
   */
  isLoading: boolean
  data: Record<string, GiftsInformationData>

  updateData: (
    value: Record<string, GiftsInformationData>,
    reset?: boolean
  ) => void
  updateLoading: (state: boolean) => void
}

export const useGiftsInformationStore = create<GiftsInformationState>()(
  immer((set) => ({
    isLoading: false,
    data: {},

    updateData: (value, reset) => {
      if (reset === true) {
        set({ data: {} })
      } else {
        set((state) => {
          Object.values(value).forEach((item) => {
            state.data[item.accountId] = item
          })
        })
      }
    },
    updateLoading: (state) => set({ isLoading: state }),
  }))
)
