import type { ServerStatusEntry } from '../../kernel/core/server-status'

import { create } from 'zustand'

export type ServerStatusState = {
  entries: Array<ServerStatusEntry>
  errorMessage: string | null
  isLoading: boolean
  lastCheckedAt: number | null

  setLoading: (value: boolean) => void
  setResponse: (config: {
    entries: Array<ServerStatusEntry>
    errorMessage?: string
    checkedAt: number
  }) => void
}

export const useServerStatusStore = create<ServerStatusState>()((set) => ({
  entries: [],
  errorMessage: null,
  isLoading: false,
  lastCheckedAt: null,

  setLoading: (value) => set({ isLoading: value }),
  setResponse: ({ entries, errorMessage, checkedAt }) =>
    set({
      entries,
      errorMessage: errorMessage ?? null,
      isLoading: false,
      lastCheckedAt: checkedAt,
    }),
}))
