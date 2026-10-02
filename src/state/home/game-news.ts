import type { GameNewsPayload } from '../../kernel/core/game-news'
import type { NewsMessage } from '../../features/news/model'

import { useShallow } from 'zustand/react/shallow'
import { useEffect } from 'react'
import { create } from 'zustand'

export type GameNewsState = {
  stw: Array<NewsMessage>
  br: Array<NewsMessage>
  notices: Array<NewsMessage>
  errorMessage: string | null
  isLoading: boolean
  lastCheckedAt: number | null

  setLoading: (value: boolean) => void
  setResponse: (payload: GameNewsPayload) => void
}

export const useGameNewsStore = create<GameNewsState>()((set) => ({
  stw: [],
  br: [],
  notices: [],
  errorMessage: null,
  isLoading: false,
  lastCheckedAt: null,

  setLoading: (value) => set({ isLoading: value }),
  setResponse: (payload) =>
    set({
      stw: payload.stw ?? [],
      br: payload.br ?? [],
      notices: payload.notices ?? [],
      errorMessage: payload.errorMessage ?? null,
      isLoading: false,
      lastCheckedAt: Date.now(),
    }),
}))

/**
 * Subscribes to the main process and asks for news once on mount — the same
 * shape as `useServerStatusData`, minus the auto-refresh (the content feed
 * moves far more slowly than a server outage, and the manager caches it, so a
 * fetch-on-open plus the manual Refresh button is enough).
 */
export function useGameNews() {
  const state = useGameNewsStore(
    useShallow((s) => ({
      stw: s.stw,
      br: s.br,
      notices: s.notices,
      errorMessage: s.errorMessage,
      isLoading: s.isLoading,
      lastCheckedAt: s.lastCheckedAt,
    })),
  )
  const { setLoading, setResponse } = useGameNewsStore(
    useShallow((s) => ({
      setLoading: s.setLoading,
      setResponse: s.setResponse,
    })),
  )

  useEffect(() => {
    const listener = window.electronAPI.responseGameNews(async (response) => {
      setResponse(response)
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  // Load on open. Nobody should have to press a button to see the news.
  useEffect(() => {
    handleRefresh()
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    window.electronAPI.requestGameNews()
  }

  const isEmpty =
    state.stw.length === 0 &&
    state.br.length === 0 &&
    state.notices.length === 0

  return {
    ...state,
    isEmpty,
    handleRefresh,
  }
}
