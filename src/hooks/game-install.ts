import { useCallback, useEffect } from 'react'
import { create } from 'zustand'

import type { GameInstallStatus } from '../types/game-install'

type GameInstallState = {
  loading: boolean
  status: GameInstallStatus | null
  setLoading: (value: boolean) => void
  setStatus: (value: GameInstallStatus | null) => void
}

const useGameInstallStore = create<GameInstallState>((set) => ({
  loading: false,
  status: null,
  setLoading: (loading) => set({ loading }),
  setStatus: (status) => set({ status }),
}))

let pendingRefresh: Promise<GameInstallStatus | null> | null = null

export function useGameInstall(options?: { autoLoad?: boolean }) {
  const autoLoad = options?.autoLoad ?? true
  const loading = useGameInstallStore((state) => state.loading)
  const status = useGameInstallStore((state) => state.status)
  const setLoading = useGameInstallStore((state) => state.setLoading)
  const setStatus = useGameInstallStore((state) => state.setStatus)

  const refresh = useCallback(
    async (forceLatest = false) => {
      if (pendingRefresh && !forceLatest) {
        return pendingRefresh
      }

      setLoading(true)

      pendingRefresh = window.electronAPI
        .getGameInstallStatus(forceLatest)
        .then((next) => {
          setStatus(next)
          return next
        })
        .finally(() => {
          pendingRefresh = null
          setLoading(false)
        })

      return pendingRefresh
    },
    [setLoading, setStatus]
  )

  useEffect(() => {
    if (!autoLoad || status !== null) {
      return
    }

    void refresh()
  }, [autoLoad, refresh, status])

  return {
    loading,
    status,
    refresh,
  }
}
