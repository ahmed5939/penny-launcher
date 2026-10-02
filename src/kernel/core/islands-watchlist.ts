import type {
  Watchlist,
  WatchlistPayload,
  WatchlistUpdate,
} from '../../features/islands/watchlist'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { normaliseMetricSet, latestValue } from '../../features/islands/metrics'
import {
  applyWatchlistUpdate,
  busyNotification,
  emptyWatchlist,
  evaluateWatch,
  normaliseWatchlist,
} from '../../features/islands/watchlist'

import { NativeNotifications } from '../startup/notifications'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { ecosystemApiBaseUrl, IslandDirectory } from './island-directory'
import { readIslandsFile, writeIslandsFile } from './islands-files'

/**
 * Watched islands, checked in the background.
 *
 * Every ten minutes — the resolution of the ecosystem API's `metrics/minute`
 * buckets, so checking more often would only re-read the same number — each
 * watched island's latest ten-minute peak is read and compared with its
 * threshold (`evaluateWatch`). Crossing it raises a Windows toast, which is
 * the point: the app is usually minimised to tray when it matters.
 *
 * Costs nothing with an empty list: no timer is scheduled until an island is
 * added, and it is cleared when the last one is removed.
 */

const checkEveryMs = 10 * 60 * 1000

/** One request per island per check, a few at a time. */
const checkConcurrency = 4

export class IslandWatchlist {
  private static list: Watchlist | null = null
  private static loading: Promise<Watchlist> | null = null
  private static timer: NodeJS.Timeout | null = null
  private static checking: Promise<void> | null = null

  /** Called once, a little after launch. Reads the file and arms the timer if it has entries. */
  static async start() {
    const list = await IslandWatchlist.load()

    if (list.islands.length > 0) {
      IslandWatchlist.schedule()
      await IslandWatchlist.check()
    }
  }

  static async request() {
    await IslandWatchlist.load()
    IslandWatchlist.push()
  }

  static async update(update: WatchlistUpdate) {
    const list = await IslandWatchlist.load()
    const result = applyWatchlistUpdate(list, update, Date.now())
    let problem = result.error

    if (result.changed) {
      IslandWatchlist.list = result.list
      problem = (await IslandWatchlist.save()) ?? problem
      IslandWatchlist.schedule()
    }

    IslandWatchlist.push(problem)

    // A new island shows its count now, not ten minutes from now.
    if (result.changed && update.action === 'add') {
      await IslandWatchlist.check([update.code])
    }
  }

  private static load() {
    if (IslandWatchlist.list) {
      return Promise.resolve(IslandWatchlist.list)
    }

    IslandWatchlist.loading ??= readIslandsFile('islands-watchlist.json')
      .then((raw) => {
        IslandWatchlist.list = raw ? normaliseWatchlist(raw) : emptyWatchlist()

        return IslandWatchlist.list
      })
      .finally(() => {
        IslandWatchlist.loading = null
      })

    return IslandWatchlist.loading
  }

  /** Returns what to tell the user when the file could not be written. */
  private static async save() {
    try {
      await writeIslandsFile('islands-watchlist.json', IslandWatchlist.list ?? emptyWatchlist())

      return undefined
    } catch (error) {
      RuntimeLog.error('caught:core/islands-watchlist.ts (save)', error)

      return 'Could not save the watchlist. Changes last until Penny closes.'
    }
  }

  private static schedule() {
    const empty = (IslandWatchlist.list?.islands.length ?? 0) === 0

    if (empty) {
      if (IslandWatchlist.timer) {
        clearInterval(IslandWatchlist.timer)
        IslandWatchlist.timer = null
      }

      return
    }

    if (!IslandWatchlist.timer) {
      IslandWatchlist.timer = setInterval(() => {
        void IslandWatchlist.check()
      }, checkEveryMs)
      IslandWatchlist.timer.unref?.()
    }
  }

  /** All islands, or just `codes`. Overlapping checks share one run. */
  private static check(codes?: ReadonlyArray<string>) {
    if (IslandWatchlist.checking && !codes) {
      return IslandWatchlist.checking
    }

    const run = IslandWatchlist.runCheck(codes).catch((error: unknown) => {
      RuntimeLog.error('caught:core/islands-watchlist.ts (check)', error)
    })

    if (!codes) {
      IslandWatchlist.checking = run.finally(() => {
        IslandWatchlist.checking = null
      })

      return IslandWatchlist.checking
    }

    return run
  }

  private static async runCheck(codes?: ReadonlyArray<string>) {
    const targets = (IslandWatchlist.list?.islands ?? [])
      .map((island) => island.code)
      .filter((code) => !codes || codes.includes(code))
    const peaks = new Map<string, number | null>()
    const queue = [...targets]

    await Promise.all(
      Array.from({ length: Math.min(checkConcurrency, queue.length) }, async () => {
        for (let code = queue.shift(); code; code = queue.shift()) {
          peaks.set(code, await IslandWatchlist.readPeak(code))
        }
      })
    )

    // The list may have changed while the requests were out; apply to what is there now.
    const list = IslandWatchlist.list

    if (!list || peaks.size === 0) {
      return
    }

    const checkedAt = new Date().toISOString()
    const toasts: Array<{ title: string; body: string }> = []

    IslandWatchlist.list = {
      ...list,
      islands: list.islands.map((island) => {
        if (!peaks.has(island.code)) {
          return island
        }

        const peak = peaks.get(island.code) ?? null
        const verdict = evaluateWatch(island, peak)

        if (verdict.fire && peak !== null) {
          toasts.push(busyNotification(island, peak))
        }

        return {
          ...island,
          lastPeakCcu: peak ?? island.lastPeakCcu,
          lastCheckedAt: peak === null ? island.lastCheckedAt : checkedAt,
          above: verdict.above,
        }
      }),
    }

    toasts.forEach((toast) => NativeNotifications.send(toast))
    IslandWatchlist.push(await IslandWatchlist.save())
  }

  /**
   * The newest ten-minute peak. `null` when the island has no figures yet or
   * the API is unreachable — the previous count stays on screen.
   */
  private static async readPeak(code: string) {
    try {
      const response = await fetch(
        `${ecosystemApiBaseUrl}/islands/${code}/metrics/minute`,
        { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }
      )

      if (!response.ok) {
        throw new Error(`Ecosystem API answered ${response.status} for ${code}`)
      }

      return latestValue(normaliseMetricSet(await response.json()).peakCCU)?.value ?? null
    } catch (error) {
      RuntimeLog.error('caught:core/islands-watchlist.ts (peak)', error)

      return null
    }
  }

  private static push(errorMessage?: string) {
    const window = MainWindow.instance

    if (!window || window.isDestroyed()) {
      return
    }

    const payload: WatchlistPayload = {
      islands: (IslandWatchlist.list?.islands ?? []).map((island) => ({
        ...island,
        imageUrl: IslandDirectory.peek(island.code)?.imageUrl ?? null,
      })),
    }

    if (errorMessage) {
      payload.errorMessage = errorMessage
    }

    window.webContents.send(ElectronAPIEventKeys.IslandsWatchlistResponse, payload)
  }
}
