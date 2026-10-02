import type { LinkedAccount } from './islands-account'
import type { Surface } from '../../features/islands/model'

import { fortnitePCGameClient } from '../../config/fortnite/clients'
import {
  appendPage,
  branchFromVersion,
  discoverySurfaceName,
  parseDiscoveryToken,
  parseSurface,
} from '../../features/islands/model'
import {
  createAccessTokenUsingExchange,
  getExchangeCodeUsingAccessToken,
} from '../../services/endpoints/oauth'

import { RuntimeLog } from '../runtime-log'
import { readIslandsFile, writeIslandsFile } from './islands-files'
import { IslandLinks } from './islands-links'

/**
 * Discover, read the way the game client reads it.
 *
 * Two hops, both on Epic's game services and neither behind a browser check:
 *
 * 1. The **discovery access token** for the live build branch
 *    (`fngw-mcp-gc-livefn …/discovery/accessToken/{branch}`), cached per
 *    branch for the session — it only changes with a patch.
 * 2. The **surface** (`fn-service-discovery-live-public …/surface/
 *    CreativeDiscoverySurface_FrontendV2`), posted with the account's token and
 *    that discovery token: the lobby's Discover panels, each tile a link code
 *    and its live player count.
 *
 * Titles and art come afterwards from the links service (`islands-links.ts`).
 *
 * Which client's token the services accept is not documented. The account's
 * own token is tried first; if Epic refuses it (401/403) a
 * `fortnitePCGameClient` token is minted through an exchange code — the hop
 * `mintEOSToken` in `locker.ts` makes — and used from then on. Each switch is
 * logged, as are panel names, counts and error statuses; tokens never are.
 */

const tokenUrl = (branch: string) =>
  `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/discovery/accessToken/${encodeURIComponent(branch)}`

const surfaceBase = `https://fn-service-discovery-live-public.ogs.live.on.epicgames.com/api/v2/discovery/surface/${discoverySurfaceName}`

/** The app has no region setting; NA-East stands in (unverified whether it changes the panels). */
const matchmakingRegion = 'NAE'

/** Further pages are a nicety: a handful, never a crawl. */
const extraPageBudget = 12

const tokenSafetyMarginMs = 5 * 60 * 1000

/** A refusal or failure from one named service, with its HTTP status. */
export class DiscoveryServiceError extends Error {
  constructor(
    readonly status: number,
    readonly service: string
  ) {
    super(`HTTP ${status} from the ${service}`)
  }
}

type ClientKind = 'account' | 'game-client'

/** 401/403 from any of the services — each error class here carries `status`. */
const isRefusal = (error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status

  return status === 401 || status === 403
}

const httpStatus = (error: unknown) =>
  (error as { response?: { status?: number } } | null)?.response?.status

export class DiscoveryService {
  private static discoveryTokens = new Map<string, string>()
  private static gameClientTokens = new Map<string, { token: string; expiresAt: number }>()
  private static client: ClientKind = 'account'
  private static loggedClient: ClientKind | null = null

  /**
   * The live branch, e.g. `++Fortnite+Release-38.10`: the launcher's live
   * build (no account needed), else the installed game's manifest, else the
   * user agent in settings.
   */
  static async liveBranch() {
    const sources: Array<[string, () => Promise<string | null | undefined>]> = [
      ['live build', async () => {
        const { GameInstallManager } = await import('../startup/game-install')

        return GameInstallManager.getLatestVersion()
      }],
      ['installed manifest', async () => {
        const { Manifest } = await import('./manifest')

        return (await Manifest.getData())?.AppVersionString
      }],
      ['settings user agent', async () => {
        const { SettingsManager } = await import('../startup/settings')

        return (await SettingsManager.getData()).userAgent
      }],
    ]

    for (const [label, read] of sources) {
      const branch = branchFromVersion(await read().catch(() => null))

      if (branch) {
        RuntimeLog.info('core/islands-discovery.ts', `branch=${branch} from ${label}`)

        return branch
      }
    }

    return null
  }

  /** The surface's first pages. Throws `DiscoveryServiceError` on a refusal. */
  static async readSurface(linked: LinkedAccount, branch: string): Promise<Surface> {
    const startedAt = Date.now()
    let tokenMs = 0
    const raw = await DiscoveryService.withAuth(linked, async (bearer) => {
      const { token, cached } = await DiscoveryService.discoveryToken(branch, bearer)

      tokenMs = Date.now() - startedAt

      try {
        return await DiscoveryService.post(surfaceUrl(branch), bearer, token, DiscoveryService.context(linked))
      } catch (error) {
        // A token kept from earlier (this session or on disk) may have been rotated; fetch it once more.
        if (!cached || !isRefusal(error)) throw error

        const fresh = await DiscoveryService.discoveryToken(branch, bearer, { fresh: true })

        return DiscoveryService.post(surfaceUrl(branch), bearer, fresh.token, DiscoveryService.context(linked))
      }
    })
    const surface = parseSurface(raw)

    RuntimeLog.info(
      'core/islands-discovery.ts',
      `surface token-ms=${tokenMs} surface-ms=${Date.now() - startedAt - tokenMs} ` +
        `variant=${surface.testVariantName ?? 'none'} panels=${surface.panels.length} ` +
        `results=${surface.panels.reduce((n, panel) => n + panel.results.length, 0)} ` +
        `first=[${surface.panels.slice(0, 12).map((panel) => `${panel.name}:${panel.results.length}${panel.hasMore ? '+' : ''}`).join(', ')}]`
    )

    return surface
  }

  /** Titles and art for every code on the surface, with the same token the surface took. */
  static lookupLinks(linked: LinkedAccount, codes: ReadonlyArray<string>) {
    return DiscoveryService.withAuth(linked, (bearer) =>
      IslandLinks.lookup(codes, bearer)
    )
  }

  private static context(linked: LinkedAccount) {
    const playerId = linked.account.accountId

    return {
      playerId,
      partyMemberIds: [playerId],
      locale: 'en',
      matchmakingRegion,
      platform: 'Windows',
      isCabined: false,
      ratingAuthority: '',
      rating: '',
      numLocalPlayers: 1,
    }
  }

  /**
   * One extra page for the first few panels that have more. Each is
   * optional: a refused or failed page is logged and the panel keeps its
   * first page.
   */
  static async morePages(linked: LinkedAccount, branch: string, surface: Surface) {
    const token = DiscoveryService.discoveryTokens.get(branch)

    if (!token || !surface.testVariantName) {
      return surface
    }

    /*
     * The V2 surface sends some panels as bare references with no first
     * page (the game then loads page 0 of each, e.g.
     * `Homebar_Reference_NewFeeder`), so an empty panel asks for page 0
     * and a full one with more behind it for page 1.
     */
    const wanted = surface.panels
      .map((panel, index) => ({
        panel,
        index,
        pageIndex: panel.results.length === 0 ? 0 : 1,
      }))
      .filter(({ panel }) => panel.hasMore || panel.results.length === 0)
      .slice(0, extraPageBudget)
    const panels = [...surface.panels]
    const bearer = await DiscoveryService.currentBearer(linked)
    let added = 0

    await Promise.all(
      wanted.map(async ({ panel, index, pageIndex }) => {
        try {
          const raw = await DiscoveryService.post(`${surfaceBase}/page?${streamQuery(branch)}`, bearer, token, {
            ...DiscoveryService.context(linked),
            testVariantName: surface.testVariantName,
            panelName: panel.name,
            pageIndex,
          })
          const next = appendPage(panel, raw)

          added += next.results.length - panel.results.length
          panels[index] = next
        } catch (error) {
          RuntimeLog.error(
            'caught:core/islands-discovery.ts (page)',
            new Error(`${panel.name}: ${error instanceof Error ? error.message : String(error)}`)
          )
        }
      })
    )

    if (wanted.length > 0) {
      RuntimeLog.info('core/islands-discovery.ts', `pages asked=${wanted.length} added=${added}`)
    }

    return { ...surface, panels }
  }

  /**
   * The discovery token for a branch. It only changes with a patch, so it
   * is kept on disk as well as in memory: after a restart the first read
   * skips this request. `cached` says the token was not fetched just now,
   * so a refusal is worth one retry with `fresh`.
   */
  private static async discoveryToken(
    branch: string,
    bearer: string,
    { fresh = false } = {}
  ): Promise<{ token: string; cached: boolean }> {
    if (fresh) {
      DiscoveryService.discoveryTokens.delete(branch)
    } else {
      const inMemory = DiscoveryService.discoveryTokens.get(branch)

      if (inMemory) {
        return { token: inMemory, cached: true }
      }

      const saved = await readIslandsFile('islands-discovery-token.json')
      const savedEntry =
        saved && typeof saved === 'object'
          ? (saved as { branch?: unknown; token?: unknown })
          : null

      if (savedEntry?.branch === branch && typeof savedEntry.token === 'string' && savedEntry.token) {
        DiscoveryService.discoveryTokens.set(branch, savedEntry.token)

        return { token: savedEntry.token, cached: true }
      }
    }

    const response = await fetch(tokenUrl(branch), {
      headers: { accept: 'application/json', authorization: `bearer ${bearer}` },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw new DiscoveryServiceError(response.status, 'discovery token service')
    }

    const token = parseDiscoveryToken(await response.json())

    if (!token) {
      throw new Error('The discovery token service answered without a token')
    }

    DiscoveryService.discoveryTokens.set(branch, token)
    void writeIslandsFile('islands-discovery-token.json', { branch, token }).catch((error: unknown) => {
      RuntimeLog.error('caught:core/islands-discovery.ts (token file)', error)
    })

    return { token, cached: false }
  }

  private static async post(url: string, bearer: string, discoveryToken: string, body: unknown) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `bearer ${bearer}`,
        'content-type': 'application/json',
        'x-epic-access-token': discoveryToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      throw new DiscoveryServiceError(response.status, 'discovery service')
    }

    return (await response.json()) as unknown
  }

  /**
   * Run with whichever token the services accept: the account's own, or —
   * once that has been refused — a `fortnitePCGameClient` one, retried once
   * with a freshly minted token if the cached one is refused too.
   */
  private static async withAuth<Result>(
    linked: LinkedAccount,
    run: (bearer: string) => Promise<Result>
  ): Promise<Result> {
    if (DiscoveryService.client === 'account') {
      try {
        const result = await run(linked.accessToken)

        DiscoveryService.noteClient('account')

        return result
      } catch (error) {
        if (!isRefusal(error)) throw error

        RuntimeLog.info(
          'core/islands-discovery.ts',
          `account token refused (${(error as Error).message}); trying a fortnitePCGameClient token`
        )
      }
    }

    try {
      const result = await run(await DiscoveryService.gameClientToken(linked))

      DiscoveryService.client = 'game-client'
      DiscoveryService.noteClient('game-client')

      return result
    } catch (error) {
      if (!isRefusal(error)) throw error

      const result = await run(await DiscoveryService.gameClientToken(linked, { fresh: true }))

      DiscoveryService.client = 'game-client'
      DiscoveryService.noteClient('game-client')

      return result
    }
  }

  /** Whichever token the surface was last read with. */
  private static async currentBearer(linked: LinkedAccount) {
    return DiscoveryService.client === 'account'
      ? linked.accessToken
      : DiscoveryService.gameClientToken(linked)
  }

  private static noteClient(client: ClientKind) {
    if (DiscoveryService.loggedClient !== client) {
      DiscoveryService.loggedClient = client
      RuntimeLog.info(
        'core/islands-discovery.ts',
        `discovery accepted the ${client === 'account' ? "account's own" : 'fortnitePCGameClient'} token`
      )
    }
  }

  /** The account's token walked through an exchange code into a game-client one. */
  private static async gameClientToken(linked: LinkedAccount, { fresh = false } = {}) {
    const id = linked.account.accountId
    const cached = DiscoveryService.gameClientTokens.get(id)

    if (!fresh && cached && cached.expiresAt > Date.now()) {
      return cached.token
    }

    try {
      const exchange = await getExchangeCodeUsingAccessToken(linked.accessToken)
      const game = await createAccessTokenUsingExchange(
        { exchange_code: exchange.data.code, token_type: 'eg1' },
        { headers: { Authorization: `basic ${fortnitePCGameClient.auth}` } }
      )

      if (!game.data.access_token) {
        throw new Error('Epic answered without a token')
      }

      DiscoveryService.gameClientTokens.set(id, {
        token: game.data.access_token,
        expiresAt:
          Date.now() +
          Math.max(0, (game.data.expires_in ?? 7200) * 1000 - tokenSafetyMarginMs),
      })

      return game.data.access_token
    } catch (error) {
      const status = httpStatus(error)

      throw status ? new DiscoveryServiceError(status, 'sign-in service') : error
    }
  }
}

function streamQuery(branch: string) {
  return `appId=Fortnite&stream=${encodeURIComponent(branch)}`
}

function surfaceUrl(branch: string) {
  return `${surfaceBase}?${streamQuery(branch)}`
}
