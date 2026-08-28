import { RuntimeLog } from '../runtime-log'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'

import { getPennyDBLeaderboard } from '../../services/endpoints/pennydb'

import {
  isLeaderboardMetric,
  parseLeaderboardResponse,
  type LeaderboardMetric,
  type LeaderboardPayload,
} from './leaderboard-parse'

export {
  isLeaderboardMetric,
  isLinkablePennyDBDisplayName,
  leaderboardMetrics,
  parseLeaderboardResponse,
  parseLeaderboardRow,
  type LeaderboardMetric,
  type LeaderboardPayload,
  type LeaderboardRow,
} from './leaderboard-parse'

const cacheMaxAgeMs = 3 * 60 * 60 * 1000

type CacheEntry = {
  fetchedAt: number
  payload: LeaderboardPayload
}

export class Leaderboard {
  private static cache = new Map<LeaderboardMetric, CacheEntry>()

  static async request(metric: unknown, force = false) {
    if (!isLeaderboardMetric(metric)) {
      Leaderboard.send({
        errorMessage: 'Unknown leaderboard metric',
        metric: 'power_level',
        rows: [],
      })
      return
    }

    const cached = Leaderboard.cache.get(metric)

    if (
      !force &&
      cached &&
      Date.now() - cached.fetchedAt < cacheMaxAgeMs
    ) {
      Leaderboard.send(cached.payload)
      return
    }

    try {
      const response = await getPennyDBLeaderboard(metric)
      const payload = parseLeaderboardResponse(response.data, metric)

      Leaderboard.cache.set(metric, {
        fetchedAt: Date.now(),
        payload,
      })
      Leaderboard.send(payload)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      RuntimeLog.error('caught:core/leaderboard.ts', error)
      Leaderboard.send({
        errorMessage:
          error?.message ?? 'Could not reach the PennyDB leaderboard',
        metric,
        rows: cached?.payload.rows ?? [],
      })
    }
  }

  private static send(payload: LeaderboardPayload) {
    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.LeaderboardResponse,
      payload
    )
  }
}
