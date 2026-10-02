import type { ServerStatusPayload } from '../../features/server-status/model'

import { create } from 'zustand'

export type ServerStatusState = {
  checkedAt: number | null
  isLoading: boolean
  status: ServerStatusPayload | null
  /** Mounted Servers pages; while any is open the status is kept fresh. */
  viewers: number

  setLoading: (value: boolean) => void
  setResponse: (status: ServerStatusPayload, checkedAt: number) => void
  /** Registers a viewer and returns its release. */
  watch: () => () => void
}

export const useServerStatusStore = create<ServerStatusState>()((set) => ({
  checkedAt: null,
  isLoading: false,
  status: null,
  viewers: 0,

  setLoading: (value) => set({ isLoading: value }),
  setResponse: (status, checkedAt) =>
    set({ checkedAt, isLoading: false, status }),
  watch: () => {
    set((state) => ({ viewers: state.viewers + 1 }))

    return () => set((state) => ({ viewers: state.viewers - 1 }))
  },
}))
