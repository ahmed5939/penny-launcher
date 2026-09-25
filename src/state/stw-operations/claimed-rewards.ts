import type { RewardsNotification } from '../../types/notifications'

import { isRecentAutomationEvent } from '../../lib/automation/history'

import { create } from 'zustand'

export type ClaimedRewardsState = {
  data: Array<RewardsNotification>

  updateData: (value: Array<RewardsNotification>, snapshot?: boolean) => void
}

export const useClaimedRewardsStore = create<ClaimedRewardsState>()(
  (set) => ({
    data: [] as Array<RewardsNotification>,

    updateData: (data, snapshot = false) =>
      set((state) => ({
        data: [...new Map((snapshot ? [...data, ...state.data] : [...state.data, ...data]).map((entry) => [entry.id, entry])).values()]
          .filter((entry) => isRecentAutomationEvent(entry.createdAt))
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
      })),
  })
)
