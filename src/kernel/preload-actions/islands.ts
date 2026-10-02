import type { DiscoveryPayload } from '../../features/islands/model'
import type { IslandMetricsPayload } from '../../features/islands/metrics'
import type {
  WatchlistPayload,
  WatchlistUpdate,
} from '../../features/islands/watchlist'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { createElectronNotification } from '../../lib/electron-notifications'

/**
 * Discover's panels, read from Fortnite's own discovery service with any
 * linked account. Cached for five minutes in the main process; `refresh`
 * reads again.
 */
export function requestIslandsDiscovery(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.IslandsDiscoveryRequest, refresh)
}

export const responseIslandsDiscovery = createElectronNotification<
  [DiscoveryPayload]
>({ key: ElectronAPIEventKeys.IslandsDiscoveryResponse })

/** One island's figures from Epic's ecosystem API. */
export function requestIslandMetrics(code: string, refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.IslandsMetricsRequest, code, refresh)
}

export const responseIslandMetrics = createElectronNotification<
  [IslandMetricsPayload]
>({ key: ElectronAPIEventKeys.IslandsMetricsResponse })

export function requestIslandsWatchlist() {
  ipcRenderer.send(ElectronAPIEventKeys.IslandsWatchlistRequest)
}

/** Also pushed after every background check. */
export const responseIslandsWatchlist = createElectronNotification<
  [WatchlistPayload]
>({ key: ElectronAPIEventKeys.IslandsWatchlistResponse })

export function updateIslandsWatchlist(update: WatchlistUpdate) {
  ipcRenderer.send(ElectronAPIEventKeys.IslandsWatchlistUpdate, update)
}
