import type { AutoPinQuestDataList } from '../../types/urns'

import { immer } from 'zustand/middleware/immer'
import { create } from 'zustand'

export type UrnDataState = {
  data: AutoPinQuestDataList

  addAccount: (
    accountId: string,
    config?: {
      templateId: string
      value: boolean
    }
  ) => void
  removeAccount: (accountId: string) => void
  updateAccount: (
    accountId: string,
    config: {
      templateId: string
      value: boolean
    }
  ) => void
}

export const useAutoPinUrnDataStore = create<UrnDataState>()(
  immer((set, get) => ({
    data: {},

    addAccount: (accountId, config) => {
      if (config !== undefined) {
        set((state) => {
          const current = state.data[accountId] ?? []
          state.data[accountId] = config.value
            ? [...new Set([...current, config.templateId])]
            : current.filter((id) => id !== config.templateId)
        })
      } else {
        set((state) => ({
          data: {
            ...state.data,
            [accountId]: [],
          },
        }))
      }
    },
    removeAccount: (accountId) => {
      const newData = Object.entries(get().data)
        .filter(([currentAccountId]) => currentAccountId !== accountId)
        .reduce((accumulator, [currentAccountId, value]) => {
          accumulator[currentAccountId] = value

          return accumulator
        }, {} as AutoPinQuestDataList)

      set({ data: newData })
    },
    updateAccount: (accountId, config) => {
      set((state) => {
        if (state.data[accountId] !== undefined) {
          const current = state.data[accountId]
          state.data[accountId] = config.value
            ? [...new Set([...current, config.templateId])]
            : current.filter((id) => id !== config.templateId)
        }
      })
    },
  }))
)
