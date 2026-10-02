import type { FreeGamesResponse, GameDetailsResult, OpenSignedInResult } from '../core/epic-store'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** The store's free games, this week and next. */
export function requestFreeGames(refresh = false): Promise<FreeGamesResponse> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FreeGamesRequest, refresh)
}

/** A game's player rating and critic score, by namespace. */
export function requestGameDetails(namespace: string): Promise<GameDetailsResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.GameDetailsRequest, namespace)
}

/** A store page in the browser, signed in as one linked account (by id). */
export function openStoreSignedIn(accountId: string, url: string): Promise<OpenSignedInResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.StoreOpenSignedIn, accountId, url)
}
