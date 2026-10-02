import type { IpcRendererEvent } from 'electron'
import type { SpritesAllPayload, SpritesPayload } from '../core/sprites'
import type { SpriteHistoryPayload } from '../core/sprite-history-model'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Every BR sprite, owned or not. `refresh` skips the catalogue cache. */
export function requestSprites(account: AccountData, refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.SpritesRequest, account, refresh)
}

export function responseSprites(
  callback: (response: SpritesPayload) => Promise<void>
) {
  return listen(ElectronAPIEventKeys.SpritesResponse, callback)
}

/**
 * Every linked account's collection, read in the main process one after
 * another. Takes no account: the main process reads them all with their own
 * tokens, and none of those ever reach the renderer.
 */
export function requestSpritesAll(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.SpritesAllRequest, refresh)
}

export function responseSpritesAll(
  callback: (response: SpritesAllPayload) => Promise<void>
) {
  return listen(ElectronAPIEventKeys.SpritesAllResponse, callback)
}

/** The change log and each account's last-known sprite state. */
export function requestSpritesHistory() {
  ipcRenderer.send(ElectronAPIEventKeys.SpritesHistoryRequest)
}

/** Answers `requestSpritesHistory`, and fires again on every change. */
export function responseSpritesHistory(
  callback: (response: SpriteHistoryPayload) => Promise<void>
) {
  return listen(ElectronAPIEventKeys.SpritesHistoryResponse, callback)
}

/** Switch the background watch; the new settings arrive as a history push. */
export function setSpritesWatch(enabled: boolean, intervalMinutes?: number) {
  ipcRenderer.send(ElectronAPIEventKeys.SpritesWatchSet, enabled, intervalMinutes)
}

function listen<Payload>(
  channel: ElectronAPIEventKeys,
  callback: (response: Payload) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, response: Payload) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(channel, customCallback)

  return {
    removeListener: () =>
      rendererInstance.removeListener(channel, customCallback),
  }
}
