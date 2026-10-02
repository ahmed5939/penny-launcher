import { create } from 'zustand'

export type NotificationRules = {
  friendRequests: boolean
  serverDown: boolean
  serverRecovered: boolean
}

/** Stored as a bare object, the shape it had before this store existed. */
const storageKey = 'penny-notification-rules'

const defaults: NotificationRules = {
  friendRequests: true,
  serverDown: true,
  serverRecovered: true,
}

function read(): NotificationRules {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') }
  } catch {
    return defaults
  }
}

/** Which desktop notifications the launcher sends. */
export const useNotificationRulesStore = create<{
  rules: NotificationRules
  setRule: (key: keyof NotificationRules, value: boolean) => void
}>()((set, get) => ({
  rules: read(),
  setRule: (key, value) => {
    const rules = { ...get().rules, [key]: value }

    localStorage.setItem(storageKey, JSON.stringify(rules))
    set({ rules })
  },
}))
