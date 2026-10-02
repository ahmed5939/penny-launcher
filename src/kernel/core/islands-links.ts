import type { LinkInfo } from '../../features/islands/model'

import { parseLinks } from '../../features/islands/model'

import { RuntimeLog } from '../runtime-log'

/**
 * Titles, creators and key art for link codes, from the links service the
 * game client reads them from.
 *
 * One bulk call answers up to a hundred codes; `ignoreFailures` makes an
 * unknown code drop out of the answer instead of failing the batch. What it
 * says changes when a creator republishes, so answers are kept for an hour
 * in memory — a refresh of Discover then costs no lookups at all — and a
 * code it would not describe is not asked about again for the same hour.
 */

const linksUrl =
  'https://links-public-service-live.ol.epicgames.com/links/api/fn/mnemonic?ignoreFailures=true'

const maxAgeMs = 60 * 60 * 1000
const batchSize = 100
const cacheLimit = 3_000

type Cached = { info: LinkInfo | null; at: number }

export class LinksHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status} from the links service`)
  }
}

export class IslandLinks {
  private static cache = new Map<string, Cached>()

  /** What is already known and fresh, without a request. */
  static peek(code: string) {
    const cached = IslandLinks.cache.get(code)

    return cached && Date.now() - cached.at < maxAgeMs ? cached.info : null
  }

  /**
   * Info for every code the service could describe. A failed batch is
   * logged and skipped — the tiles fall back to their codes — unless every
   * batch fails, which throws so the caller can say so.
   */
  static async lookup(codes: ReadonlyArray<string>, accessToken: string) {
    const now = Date.now()
    const found = new Map<string, LinkInfo>()
    const wanted: Array<string> = []

    for (const code of new Set(codes)) {
      const cached = IslandLinks.cache.get(code)

      if (cached && now - cached.at < maxAgeMs) {
        if (cached.info) found.set(code, cached.info)
      } else {
        wanted.push(code)
      }
    }

    const batches: Array<Array<string>> = []

    for (let index = 0; index < wanted.length; index += batchSize) {
      batches.push(wanted.slice(index, index + batchSize))
    }

    const failures: Array<unknown> = []

    for (const batch of batches) {
      try {
        const links = await IslandLinks.fetchBatch(batch, accessToken)
        const at = Date.now()

        for (const code of batch) {
          const info = links.get(code) ?? null

          IslandLinks.remember(code, { info, at })

          if (info) found.set(code, info)
        }
      } catch (error) {
        failures.push(error)
        RuntimeLog.error('caught:core/islands-links.ts', error)
      }
    }

    if (batches.length > 0 && failures.length === batches.length) {
      throw failures[0]
    }

    return found
  }

  private static async fetchBatch(codes: ReadonlyArray<string>, accessToken: string) {
    const response = await fetch(linksUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        codes.map((mnemonic) => ({ mnemonic, type: '', filter: false, v: '' }))
      ),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw new LinksHttpError(response.status)
    }

    return parseLinks(await response.json())
  }

  private static remember(code: string, entry: Cached) {
    IslandLinks.cache.delete(code)
    IslandLinks.cache.set(code, entry)

    while (IslandLinks.cache.size > cacheLimit) {
      const oldest = IslandLinks.cache.keys().next().value

      if (oldest === undefined) break

      IslandLinks.cache.delete(oldest)
    }
  }
}
