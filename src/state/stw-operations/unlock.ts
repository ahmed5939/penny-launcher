import { create } from 'zustand'

export type UnlockState = {
  /**
   * Account selection is not a property of this tool. It lives in
   * `state/accounts/scope` and every tool reads the same one.
   */
  tags: Array<string>

  updateTags: (tags: Array<string>) => void
}

export const useUnlockStore = create<UnlockState>()((set) => ({
  tags: [],

  updateTags: (tags) =>
    set({
      tags: [...new Set(tags)],
    }),
}))
