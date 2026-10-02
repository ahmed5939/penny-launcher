import type {
  DiscoveryPayload,
  IslandHistory,
  LinkInfo,
} from '../../features/islands/model'
import type { IslandMetricsPayload } from '../../features/islands/metrics'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import {
  buildPanels,
  parseHistory,
  recordHistory,
  serialiseHistory,
  uniqueIslands,
  withTrends,
} from '../../features/islands/model'
import {
  emptyMetricSet,
  normaliseIsland,
  normaliseMetricSet,
  pickRetention,
} from '../../features/islands/metrics'

import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { linkedAccount } from './islands-account'
import { DiscoveryService } from './islands-discovery'
import { readIslandsFile, writeIslandsFile } from './islands-files'
import {
  ecosystemApiBaseUrl,
  IslandDirectory,
  isIslandCode,
} from './island-directory'

export { IslandWatchlist } from './islands-watchlist'

/**
 * The Islands page's data.
 *
 * Two sources, chosen for what each can say:
 *
 * - Fortnite's own Discover service — the lobby's panels with live player
 *   counts — and the links service for titles and art, read with a linked
 *   account's token the way the game client reads them
 *   (`islands-discovery.ts`). Any signed-in account will do; none is changed.
 * - Epic's public ecosystem API — hourly and daily figures for any creator
 *   island — read anonymously with plain `fetch`.
 */

const discoveryMaxAgeMs = 5 * 60 * 1000
const metricsMaxAgeMs = 5 * 60 * 1000
const metricsCacheLimit = 40

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

class HttpError extends Error {
  constructor(readonly status: number, url: string) {
    super(`HTTP ${status} from ${url}`)
  }
}

export async function getEcosystemJson(path: string) {
  const url = `${ecosystemApiBaseUrl}${path}`
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new HttpError(response.status, url)
  }

  return (await response.json()) as unknown
}

export class Islands {
  private static discovery: { payload: DiscoveryPayload; at: number } | null = null
  private static inFlight: Promise<DiscoveryPayload> | null = null
  private static history: IslandHistory | null = null

  private static metrics = new Map<string, { payload: IslandMetricsPayload; at: number }>()
  private static metricsInFlight = new Map<string, Promise<IslandMetricsPayload>>()

  /*
   * -------------------------------------------------------------------------
   * Discovery
   * -------------------------------------------------------------------------
   */

  static async requestDiscovery(refresh = false) {
    /*
     * A read takes several seconds (token, surface, pages, names), so the
     * first visit after a restart shows the last read from disk straight
     * away, marked stale, and the fresh one replaces it when it lands.
     */
    if (!refresh && !Islands.discovery) {
      const saved = await Islands.loadSaved()

      if (saved) {
        Islands.send(ElectronAPIEventKeys.IslandsDiscoveryResponse, {
          ...saved,
          stale: true,
        })
      }
    }

    Islands.send(
      ElectronAPIEventKeys.IslandsDiscoveryResponse,
      await Islands.discover(refresh)
    )
  }

  private static async loadSaved(): Promise<DiscoveryPayload | null> {
    const saved = (await readIslandsFile('islands-last.json')) as DiscoveryPayload | null

    return saved?.status === 'ok' &&
      typeof saved.fetchedAt === 'string' &&
      Array.isArray(saved.panels) &&
      saved.panels.length > 0
      ? saved
      : null
  }

  /** Cached for five minutes; one read at a time, which later callers share. */
  private static discover(refresh: boolean) {
    const cached = Islands.discovery

    if (!refresh && cached && Date.now() - cached.at < discoveryMaxAgeMs) {
      return Promise.resolve(cached.payload)
    }

    if (!Islands.inFlight) {
      Islands.inFlight = Islands.readDiscovery()
        .catch((error: unknown): DiscoveryPayload => {
          RuntimeLog.error('caught:core/islands.ts (discovery)', error)

          return {
            status: 'error',
            fetchedAt: new Date().toISOString(),
            panels: [],
            errorMessage: `Could not read Discover (${errorText(error)}). Try Refresh.`,
          }
        })
        .finally(() => {
          Islands.inFlight = null
        })
    }

    return Islands.inFlight
  }

  private static async readDiscovery(): Promise<DiscoveryPayload> {
    const startedAt = Date.now()
    const fetchedAt = new Date().toISOString()
    const linked = await linkedAccount()

    if (!linked) {
      return {
        status: 'no-account',
        fetchedAt,
        panels: [],
        errorMessage: 'Add an account to see Discover.',
      }
    }

    const branch = await DiscoveryService.liveBranch()

    if (!branch) {
      return {
        status: 'error',
        fetchedAt,
        panels: [],
        errorMessage: 'Could not find the current Fortnite version. Try Refresh.',
      }
    }

    const firstPages = await DiscoveryService.readSurface(linked, branch)
    const codesOf = (panels: typeof firstPages.panels) => [
      ...new Set(panels.flatMap((panel) => panel.results.map((result) => result.code))),
    ]
    const links = new Map<string, LinkInfo>()
    let linksProblem: string | undefined
    const describe = async (codes: Array<string>) => {
      try {
        for (const [code, info] of await DiscoveryService.lookupLinks(linked, codes)) {
          links.set(code, info)
        }
      } catch (error) {
        // Tiles still show, under their codes; say why the names are missing.
        RuntimeLog.error('caught:core/islands.ts (links)', error)
        linksProblem = `Island names and art did not load (${errorText(error)}). Try Refresh.`
      }
    }

    // Names for the first pages while the extra pages load, then any newcomers.
    const [surface] = await Promise.all([
      DiscoveryService.morePages(linked, branch, firstPages),
      describe(codesOf(firstPages.panels)),
    ])
    const codes = codesOf(surface.panels)
    const undescribed = codes.filter((code) => !links.has(code))

    if (undescribed.length > 0 && !linksProblem) {
      await describe(undescribed)
    }

    const now = Date.now()
    const panels = buildPanels(surface, links)

    RuntimeLog.info(
      'core/islands.ts',
      `discovery panels=${panels.length} codes=${codes.length} described=${links.size} ms=${now - startedAt}`
    )

    if (panels.length === 0) {
      return {
        status: 'error',
        fetchedAt,
        panels: [],
        errorMessage: 'Discover is empty right now. Try Refresh in a minute.',
      }
    }

    const islands = uniqueIslands(panels)

    // Discord presence names and pictures the island you are in from this.
    IslandDirectory.remember(
      islands.map((island) => ({
        code: island.code,
        title: island.title === island.code ? null : island.title,
        imageUrl: island.imageUrl,
      }))
    )

    const history = await Islands.loadHistory()
    const trended = withTrends(panels, history, now)

    Islands.history = recordHistory(history, islands, now)
    void writeIslandsFile(
      'islands-history.json',
      serialiseHistory(Islands.history)
    ).catch((error: unknown) => {
      RuntimeLog.error('caught:core/islands.ts (history)', error)
    })

    const payload: DiscoveryPayload = {
      status: 'ok',
      fetchedAt,
      panels: trended,
      ...(linksProblem ? { errorMessage: linksProblem } : {}),
    }

    Islands.discovery = { payload, at: now }
    void writeIslandsFile('islands-last.json', payload).catch((error: unknown) => {
      RuntimeLog.error('caught:core/islands.ts (last read)', error)
    })

    return payload
  }

  private static async loadHistory() {
    if (!Islands.history) {
      Islands.history = parseHistory(await readIslandsFile('islands-history.json'))
    }

    return Islands.history
  }

  /*
   * -------------------------------------------------------------------------
   * Ecosystem metrics
   * -------------------------------------------------------------------------
   */

  static async requestMetrics(code: string, refresh = false) {
    Islands.send(
      ElectronAPIEventKeys.IslandsMetricsResponse,
      await Islands.metricsFor(code, refresh)
    )
  }

  private static metricsFor(code: string, refresh: boolean) {
    if (typeof code !== 'string' || !isIslandCode(code)) {
      return Promise.resolve<IslandMetricsPayload>({
        code: String(code).slice(0, 80),
        status: 'error',
        fetchedAt: new Date().toISOString(),
        island: null,
        hour: emptyMetricSet(),
        day: emptyMetricSet(),
        retention: null,
        errorMessage: 'Epic only publishes figures for creator islands (codes like 1234-5678-9012).',
      })
    }

    const cached = Islands.metrics.get(code)

    if (!refresh && cached && Date.now() - cached.at < metricsMaxAgeMs) {
      return Promise.resolve(cached.payload)
    }

    const inFlight = Islands.metricsInFlight.get(code)

    if (inFlight) {
      return inFlight
    }

    const request = Islands.readMetrics(code).finally(() => {
      Islands.metricsInFlight.delete(code)
    })

    Islands.metricsInFlight.set(code, request)

    return request
  }

  /**
   * Three calls, each allowed to fail alone: an island Epic will not
   * describe may still have figures, and the other way round.
   */
  private static async readMetrics(code: string): Promise<IslandMetricsPayload> {
    const [island, hour, day] = await Promise.allSettled([
      getEcosystemJson(`/islands/${code}`),
      getEcosystemJson(`/islands/${code}/metrics/hour`),
      getEcosystemJson(`/islands/${code}/metrics/day`),
    ])
    const now = Date.now()
    const value = (result: PromiseSettledResult<unknown>) =>
      result.status === 'fulfilled' ? result.value : null
    const daySet = normaliseMetricSet(value(day))
    const metadata = normaliseIsland(value(island))
    const failures = [island, hour, day].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    const notFound = failures.every(
      (failure) => failure.reason instanceof HttpError && failure.reason.status === 404
    )

    failures.forEach((failure) =>
      RuntimeLog.error('caught:core/islands.ts (metrics)', failure.reason)
    )

    if (metadata?.title) {
      IslandDirectory.remember([{ code, title: metadata.title }])
    }

    const payload: IslandMetricsPayload = {
      code,
      status: failures.length === 3 ? 'error' : 'ok',
      fetchedAt: new Date(now).toISOString(),
      island: metadata,
      hour: normaliseMetricSet(value(hour)),
      day: daySet,
      retention: pickRetention(
        (value(day) as { retention?: unknown } | null)?.retention,
        daySet,
        now
      ),
    }

    if (failures.length === 3) {
      payload.errorMessage = notFound
        ? 'Epic has no public figures for this island — it may be private, unpublished or too new.'
        : `Could not reach Epic's ecosystem API (${errorText(failures[0].reason)}). Try again in a minute.`
    } else if (failures.length > 0) {
      payload.errorMessage = 'Some of this island’s figures did not load. Try again in a minute.'
    }

    if (payload.status === 'ok') {
      Islands.metrics.delete(code)
      Islands.metrics.set(code, { payload, at: now })

      while (Islands.metrics.size > metricsCacheLimit) {
        const oldest = Islands.metrics.keys().next().value

        if (oldest === undefined) {
          break
        }

        Islands.metrics.delete(oldest)
      }
    }

    return payload
  }

  private static send(channel: ElectronAPIEventKeys, payload: unknown) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}
