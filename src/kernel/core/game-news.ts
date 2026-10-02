import type { GameNewsContent } from '../../features/news/model'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'

import { getFortniteGameContent } from '../../services/endpoints/content'
import { extractGameNews } from '../../features/news/model'

/**
 * The content feed changes on Epic's schedule, not ours — a few times a day at
 * most. A short in-memory cache keeps the home screen from re-fetching the
 * whole document every time it mounts, while still picking up a new
 * message-of-the-day within the session.
 */
const cacheMaxAgeMs = 10 * 60 * 1000

export type GameNewsPayload = GameNewsContent & {
  /** Present only when the fetch failed; the groups come back empty. */
  errorMessage?: string
  /** Epoch ms the content was fetched (or last served from cache). */
  fetchedAt: number
}

/**
 * In-game news from Epic's public content CMS: Save the World news, Battle
 * Royale news and any active emergency notice. Global, read-only, anonymous —
 * mirrors `ServerStatus`/`Timeline`, not the per-account broadcast features.
 */
export class GameNews {
  private static cache: GameNewsPayload | null = null

  /** Dedupes concurrent requests onto a single in-flight fetch. */
  private static pending: Promise<GameNewsPayload> | null = null

  static async request(force = false) {
    const payload = await GameNews.load(force)

    MainWindow.instance?.webContents.send(
      ElectronAPIEventKeys.GameNewsResponse,
      payload,
    )
  }

  private static async load(force: boolean) {
    if (
      !force &&
      GameNews.cache &&
      Date.now() - GameNews.cache.fetchedAt < cacheMaxAgeMs
    ) {
      return GameNews.cache
    }

    if (GameNews.pending) {
      return GameNews.pending
    }

    GameNews.pending = GameNews.download().finally(() => {
      GameNews.pending = null
    })

    return GameNews.pending
  }

  private static async download(): Promise<GameNewsPayload> {
    try {
      const response = await getFortniteGameContent()
      const payload: GameNewsPayload = {
        ...extractGameNews(response.data),
        fetchedAt: Date.now(),
      }

      GameNews.cache = payload

      return payload

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      RuntimeLog.error('caught:core/game-news.ts', error)

      // A failed fetch does not poison a good cache — the panel keeps showing
      // the last news it had, just without refreshing.
      if (GameNews.cache) {
        return GameNews.cache
      }

      return {
        stw: [],
        br: [],
        notices: [],
        errorMessage:
          error?.message ?? 'Could not reach the Epic Games news service',
        fetchedAt: Date.now(),
      }
    }
  }
}
