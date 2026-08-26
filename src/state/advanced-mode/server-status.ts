import type { ServerStatusEntry, ServerStatusPayload } from '../../kernel/core/server-status'

import { create } from 'zustand'

export type ServerStatusState = {
  entries: Array<ServerStatusEntry>
  diagnostics: ServerStatusPayload['diagnostics']
  errorMessage: string | null
  isLoading: boolean
  lastCheckedAt: number | null

  setLoading: (value: boolean) => void
  setResponse: (config: {
    entries: Array<ServerStatusEntry>
    diagnostics?: ServerStatusPayload['diagnostics']
    errorMessage?: string
    checkedAt: number
  }) => void
}

export const useServerStatusStore = create<ServerStatusState>()((set) => ({
  entries: [],
  diagnostics: undefined,
  errorMessage: null,
  isLoading: false,
  lastCheckedAt: null,

  setLoading: (value) => set({ isLoading: value }),
  setResponse: ({ entries, diagnostics, errorMessage, checkedAt }) =>
    set({
      entries,
      diagnostics,
      errorMessage: errorMessage ?? null,
      isLoading: false,
      lastCheckedAt: checkedAt,
    }),
}))
