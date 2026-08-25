import { create } from 'zustand'

export type DailyQuestsState = {
  /**
   * Account selection is not a property of this tool. It lives in
   * `state/accounts/scope` and every tool reads the same one.
   */
  tags: Array<string>

  updateTags: (tags: Array<string>) => void
}

export const useDailyQuestsStore = create<DailyQuestsState>()((set) => ({
  tags: [],

  updateTags: (tags) =>
    set({
      tags: [...new Set(tags)],
    }),
}))
