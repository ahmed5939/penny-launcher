import type { DiscoveryPayload, IslandPanel } from './model'
import type { IslandMetricsPayload } from './metrics'
import type { WatchlistPayload, WatchlistUpdate } from './watchlist'

import { useEffect } from 'react'
import { create } from 'zustand'

import { subscribeToRefreshEvent } from '../../components/page/account-resource'

/**
 * The Islands page's state, kept outside the page so leaving and coming back
 * shows the last read at once (the main process caches it for five minutes
 * anyway) instead of a loading screen.
 *
 * No account is involved, so there is nothing to key on: this is one store
 * for the app.
 */

type IslandsState = {
  /** The last reply, whatever its status. */
  discovery: DiscoveryPayload | null
  /** The last panels that loaded, kept on screen through a failed refresh. */
  panels: Array<IslandPanel>
  loadedAt: string | null
  loading: boolean
  metrics: Record<string, IslandMetricsPayload>
  metricsLoading: Record<string, boolean>
  watchlist: WatchlistPayload | null
}

export const useIslandsStore = create<IslandsState>()(() => ({
  discovery: null,
  panels: [],
  loadedAt: null,
  loading: false,
  metrics: {},
  metricsLoading: {},
  watchlist: null,
}))

export function refreshDiscovery(refresh: boolean) {
  useIslandsStore.setState({ loading: true })
  window.electronAPI.requestIslandsDiscovery(refresh)
}

export function loadMetrics(code: string, refresh = false) {
  const { metrics, metricsLoading } = useIslandsStore.getState()
  const cached = metrics[code]

  // Re-opening an island within five minutes shows what is already here.
  if (
    metricsLoading[code] ||
    (!refresh &&
      cached?.status === 'ok' &&
      Date.now() - Date.parse(cached.fetchedAt) < 5 * 60 * 1000)
  ) {
    return
  }

  useIslandsStore.setState({ metricsLoading: { ...metricsLoading, [code]: true } })
  window.electronAPI.requestIslandMetrics(code, refresh)
}

export function updateWatchlist(update: WatchlistUpdate) {
  window.electronAPI.updateIslandsWatchlist(update)
}

/**
 * Listen for replies while the page is open, and ask for the current data
 * on arrival. F5 / Ctrl+R reads Discover again.
 */
export function useIslandsBridge() {
  useEffect(() => {
    const discovery = window.electronAPI.responseIslandsDiscovery(async (payload) => {
      useIslandsStore.setState((state) => ({
        discovery: payload,
        // The saved read from last time: on screen at once, but still loading.
        loading: payload.stale === true,
        ...(payload.status === 'ok'
          ? { panels: payload.panels, loadedAt: payload.fetchedAt }
          : { panels: state.panels, loadedAt: state.loadedAt }),
      }))
    })
    const metrics = window.electronAPI.responseIslandMetrics(async (payload) => {
      useIslandsStore.setState((state) => ({
        metrics: { ...state.metrics, [payload.code]: payload },
        metricsLoading: { ...state.metricsLoading, [payload.code]: false },
      }))
    })
    const watchlist = window.electronAPI.responseIslandsWatchlist(async (payload) => {
      useIslandsStore.setState({ watchlist: payload })
    })
    const unsubscribeRefresh = subscribeToRefreshEvent(() => refreshDiscovery(true))

    refreshDiscovery(false)
    window.electronAPI.requestIslandsWatchlist()

    return () => {
      discovery.removeListener()
      metrics.removeListener()
      watchlist.removeListener()
      unsubscribeRefresh()
    }
  }, [])
}
