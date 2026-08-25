import { immer } from 'zustand/middleware/immer'
import { create } from 'zustand'

export type VBucksInformationCurrency = {
  platform: string
  template: string
  quantity: number
}

export type VBucksInformationData = {
  accountId: string
  currency: Record<string, VBucksInformationCurrency>
}

export type VBucksInformationState = {
  /**
   * Account selection is not a property of this tool. It lives in
   * `state/accounts/scope` and every tool reads the same one.
   */
  isLoading: boolean
  data: Record<string, VBucksInformationData>
  tags: Array<string>

  updateData: (
    value: Record<string, VBucksInformationData>,
    reset?: boolean
  ) => void
  updateLoading: (state: boolean) => void
  updateTags: (tags: Array<string>) => void
}

export const useVBucksInformationStore = create<VBucksInformationState>()(
  immer((set) => ({
    isLoading: false,
    data: {},
    tags: [],

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
    updateTags: (tags) =>
      set({
        tags: [...new Set(tags)],
      }),
  }))
)
