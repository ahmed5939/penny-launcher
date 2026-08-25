import type { XPBoostType } from '../../../../types/xpboosts'

import { create } from 'zustand'

export type XPBoostsFormState = {
  /**
   * Account selection is not a property of this tool. It lives in
   * `state/accounts/scope` and every tool reads the same one.
   */
  isSubmitting: boolean
  tags: Array<string>

  updateIsSubmitting: (isSubmitting: boolean) => void
  updateTags: (tags: Array<string>) => void
}

export type XPBoostsFormConsumeState = {
  isSubmittingPersonal: boolean
  isSubmittingTeammate: boolean

  updateIsSubmittingConsume: (type: XPBoostType, value: boolean) => void
}

export const useXPBoostsFormStore = create<XPBoostsFormState>()((set) => ({
  isSubmitting: false,
  tags: [],

  updateIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  updateTags: (tags) =>
    set({
      tags: [...new Set(tags)],
    }),
}))

export const useXPBoostsFormConsumeStore =
  create<XPBoostsFormConsumeState>()((set) => ({
    isSubmittingPersonal: false,
    isSubmittingTeammate: false,

    updateIsSubmittingConsume: (type, value) =>
      set({
        [type === 'personal'
          ? 'isSubmittingPersonal'
          : 'isSubmittingTeammate']: value,
      }),
  }))
