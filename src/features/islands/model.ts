/**
 * Discover, as the game client reads it.
 *
 * Three of Epic's own services make the page, the same ones Fortnite's
 * lobby calls:
 *
 * - the discovery service's *surface* — the panels and, for each tile, its
 *   link code and live player count (`globalCCU`);
 * - the links service — each code's title, creator and key art;
 * - Epic's public ecosystem API (see `metrics.ts`) — the history behind an
 *   island, which the surface does not carry.
 *
 * Everything here is the pure half: response shapes in, cards out, and the
 * hour-on-hour trend built from our own samples, since the surface only
 * ever states "now".
 *
 * Shared by the main process and the page, so nothing in this file may touch
 * Electron or Node.
 */

export type IslandCard = {
  /** `1234-5678-9012` for a creator island; `playlist_*` / `set_*` for Epic's own. */
  code: string
  title: string
  /** Card-sized key art (640×360 where Epic has it). */
  imageUrl: string | null
  /** Full-size key art, for the dialog. */
  heroImageUrl: string | null
  /** The creator's name as the links service states it ("Epic" for Epic's own). */
  creator: string | null
  /** Players in it now. `null` when the island hides its count (`globalCCU: -1`) — never 0. */
  ccu: number | null
  /** "12+" when the island's rating says an age; otherwise null. */
  ageRating: string | null
  /** The island's page on fortnite.com; only creator islands have one. */
  url: string | null
  /** Players now minus players about an hour ago, from our own samples. */
  delta1h: number | null
}

export type IslandPanel = {
  key: string
  label: string
  islands: Array<IslandCard>
}

/**
 * `no-account`: the discovery service only answers a signed-in player, and
 * no linked account could be signed in.
 */
export type DiscoveryStatus = 'ok' | 'no-account' | 'error'

export type DiscoveryPayload = {
  status: DiscoveryStatus
  /** ISO time of the read (or of the attempt, when it failed). */
  fetchedAt: string
  panels: Array<IslandPanel>
  errorMessage?: string
  /** The last read, from disk, sent ahead of a fresh one that is still loading. */
  stale?: boolean
}

export const fortniteWebOrigin = 'https://www.fortnite.com'

/**
 * The lobby's Discover tab. The documented `CreativeDiscoverySurface_Frontend`
 * still answers, but with a bare default layout (one A-spot panel, no
 * tiles); the game itself has queried the V2 surface since at least 42.30
 * (`LogFortCreativeDiscoverySurfaceManager: Querying surface: …FrontendV2`).
 */
export const discoverySurfaceName = 'CreativeDiscoverySurface_FrontendV2'

const islandCodePattern = /^\d{4}-\d{4}-\d{4}$/

/**
 * A creator island, as opposed to an Epic playlist or set. Only these have a
 * page of figures on the ecosystem API, so only these can be opened for
 * metrics or watched. Mirrors `isIslandCode` in
 * `kernel/core/island-directory.ts`, which the renderer cannot import.
 */
export function isCreatorIslandCode(value: string) {
  return islandCodePattern.test(value)
}

export function islandWebUrl(code: string) {
  return `${fortniteWebOrigin}/creative/island-codes/${code}`
}

/**
 * `++Fortnite+Release-38.10` out of a build version
 * (`++Fortnite+Release-38.10-CL-47722112-Windows`) or a user agent
 * (`Fortnite/++Fortnite+Release-38.10-CL-… Windows/10.0`). The discovery
 * services key everything on this branch, and only the live one answers.
 */
export function branchFromVersion(value: string | null | undefined) {
  const match = value ? /\+\+Fortnite\+Release-\d+(?:\.\d+)*/.exec(value) : null

  return match ? match[0] : null
}

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const record = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

/** Codes go into URLs and file keys; anything stranger than this is not one. */
const safeCode = (value: unknown) => {
  const code = text(value)

  return code && /^[A-Za-z0-9_-]{1,80}$/.test(code) ? code : null
}

const httpsUrl = (value: unknown) => {
  const raw = text(value)

  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw)

    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/*
 * ---------------------------------------------------------------------------
 * Discovery surface
 * ---------------------------------------------------------------------------
 */

/** `{ branchName, appId, token }` → the token, or null if it is not there. */
export function parseDiscoveryToken(raw: unknown) {
  return text(record(raw)?.token)
}

export type SurfaceResult = { code: string; ccu: number | null }

export type SurfacePanel = {
  name: string
  label: string
  results: Array<SurfaceResult>
  hasMore: boolean
}

export type Surface = {
  /** Echoed back when asking for a panel's next page. */
  testVariantName: string | null
  panels: Array<SurfacePanel>
}

/** "Featured_EpicPage" → "Featured EpicPage", for a panel Epic gave no display name. */
function prettyPanelName(name: string) {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** One page of tiles: `{ results, hasMore }`. Hidden tiles and junk are dropped. */
export function parseSurfacePage(raw: unknown) {
  const page = record(raw)
  const list = Array.isArray(page?.results) ? page.results : []
  const seen = new Set<string>()
  const results: Array<SurfaceResult> = []

  for (const entry of list) {
    const tile = record(entry)
    const code = safeCode(tile?.linkCode)

    // The client does not draw a tile Epic marks invisible; neither do we.
    if (!tile || !code || seen.has(code) || tile.isVisible === false) {
      continue
    }

    seen.add(code)
    results.push({
      code,
      ccu:
        typeof tile.globalCCU === 'number' &&
        Number.isFinite(tile.globalCCU) &&
        tile.globalCCU >= 0
          ? Math.round(tile.globalCCU)
          : null,
    })
  }

  return { results, hasMore: page?.hasMore === true }
}

/**
 * The surface response. Defensive throughout: these are the game's private
 * services and free to change shape; a panel that does not parse is dropped
 * rather than failing the page.
 */
export function parseSurface(raw: unknown): Surface {
  const surface = record(raw)
  const list = Array.isArray(surface?.panels) ? surface.panels : []
  const panels: Array<SurfacePanel> = []

  for (const entry of list) {
    const panel = record(entry)
    const name = text(panel?.panelName)

    if (!panel || !name) {
      continue
    }

    const { results, hasMore } = parseSurfacePage(panel.firstPage)

    panels.push({
      name,
      label: text(panel.panelDisplayName) ?? prettyPanelName(name),
      results,
      hasMore,
    })
  }

  return { testVariantName: text(surface?.testVariantName), panels }
}

/** A further page's tiles onto its panel, without repeating a code. */
export function appendPage(panel: SurfacePanel, raw: unknown): SurfacePanel {
  const page = parseSurfacePage(raw)
  const known = new Set(panel.results.map((result) => result.code))

  return {
    ...panel,
    results: [
      ...panel.results,
      ...page.results.filter((result) => !known.has(result.code)),
    ],
    hasMore: page.hasMore,
  }
}

/*
 * ---------------------------------------------------------------------------
 * Links service
 * ---------------------------------------------------------------------------
 */

export type LinkInfo = {
  code: string
  title: string | null
  imageUrl: string | null
  heroImageUrl: string | null
  creator: string | null
  ageRating: string | null
  /** "Creative:Island", "BR:Playlist", "ModeSet"… */
  linkType: string | null
  /** Unpublished or taken down: not worth a tile. */
  disabled: boolean
}

/**
 * Epic's rating boards, reduced to "12+" when a board states an age
 * ("AGE_12", "PEGI_AGE_12"). The generic board is preferred because it is
 * the one shown to players without a regional authority; a rating with no
 * number in it (ESRB's "TEEN") is left out rather than guessed.
 */
function ageRating(ratings: unknown) {
  const boards = record(record(ratings)?.boards)

  if (!boards) {
    return null
  }

  const names = Object.keys(boards).sort(
    (a, b) => Number(b === 'GENERIC') - Number(a === 'GENERIC')
  )

  for (const name of names) {
    const board = record(boards[name])
    const value = text(board?.initial_rating) ?? text(board?.rating)
    const age = value ? /(\d{1,2})/.exec(value)?.[1] : null

    if (age) {
      return `${Number(age)}+`
    }
  }

  return null
}

/** The bulk mnemonic response → info by code. Entries that do not parse are skipped. */
export function parseLinks(raw: unknown) {
  const links = new Map<string, LinkInfo>()

  for (const entry of Array.isArray(raw) ? raw : []) {
    const link = record(entry)
    const code = safeCode(link?.mnemonic)

    if (!link || !code) {
      continue
    }

    const metadata = record(link.metadata) ?? {}
    const images = record(metadata.image_urls) ?? {}

    links.set(code, {
      code,
      title: text(metadata.title),
      imageUrl:
        httpsUrl(images.url_m) ??
        httpsUrl(images.url_s) ??
        httpsUrl(metadata.image_url) ??
        httpsUrl(images.url),
      heroImageUrl:
        httpsUrl(images.url) ??
        httpsUrl(metadata.image_url) ??
        httpsUrl(images.url_m),
      creator: text(link.creatorName),
      ageRating: ageRating(metadata.ratings),
      linkType: text(link.linkType),
      disabled: link.disabled === true,
    })
  }

  return links
}

/*
 * ---------------------------------------------------------------------------
 * Cards
 * ---------------------------------------------------------------------------
 */

export function panelKey(panelName: string) {
  return (
    panelName
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'panel'
  )
}

/**
 * Surface + links → the page's panels. A tile the links service could not
 * describe still shows, under its code; a disabled link does not. Empty
 * panels are dropped.
 */
export function buildPanels(
  surface: Surface,
  links: ReadonlyMap<string, LinkInfo>
): Array<IslandPanel> {
  const keys = new Set<string>()
  const panels: Array<IslandPanel> = []

  for (const panel of surface.panels) {
    const islands: Array<IslandCard> = []

    for (const { code, ccu } of panel.results) {
      const link = links.get(code)

      if (link?.disabled) {
        continue
      }

      islands.push({
        code,
        title: link?.title ?? code,
        imageUrl: link?.imageUrl ?? null,
        heroImageUrl: link?.heroImageUrl ?? link?.imageUrl ?? null,
        creator: link?.creator ?? null,
        ccu,
        ageRating: link?.ageRating ?? null,
        url: isCreatorIslandCode(code) ? islandWebUrl(code) : null,
        delta1h: null,
      })
    }

    if (islands.length === 0) {
      continue
    }

    let key = panelKey(panel.name)

    for (let suffix = 2; keys.has(key); suffix += 1) {
      key = `${panelKey(panel.name)}-${suffix}`
    }

    keys.add(key)
    panels.push({ key, label: panel.label, islands })
  }

  return panels
}

/** Every island once, in panel order — the same island is often on two panels. */
export function uniqueIslands(panels: ReadonlyArray<IslandPanel>) {
  const byCode = new Map<string, IslandCard>()

  for (const panel of panels) {
    for (const island of panel.islands) {
      if (!byCode.has(island.code)) {
        byCode.set(island.code, island)
      }
    }
  }

  return [...byCode.values()]
}

export function discoverySummary(panels: ReadonlyArray<IslandPanel>) {
  const islands = uniqueIslands(panels)
  const counted = islands.filter((island) => island.ccu !== null)
  const busiest = counted.reduce<IslandCard | null>(
    (best, island) =>
      !best || (island.ccu ?? 0) > (best.ccu ?? 0) ? island : best,
    null
  )

  return {
    islands: islands.length,
    players: counted.reduce((total, island) => total + (island.ccu ?? 0), 0),
    hidden: islands.length - counted.length,
    busiest,
  }
}

/** Biggest hour-on-hour gains first. Empty until there is an hour of history. */
export function risingIslands(
  panels: ReadonlyArray<IslandPanel>,
  limit = 6
) {
  return uniqueIslands(panels)
    .filter((island) => (island.delta1h ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.delta1h ?? 0) - (a.delta1h ?? 0) || (b.ccu ?? 0) - (a.ccu ?? 0)
    )
    .slice(0, limit)
}

export function hasTrend(panels: ReadonlyArray<IslandPanel>) {
  return panels.some((panel) =>
    panel.islands.some((island) => island.delta1h !== null)
  )
}

/*
 * ---------------------------------------------------------------------------
 * History
 *
 * The surface only says how many are playing *now*. A trend needs a memory,
 * so every successful read leaves one sample per island in
 * `islands-history.json` and "an hour ago" is whichever sample sits nearest
 * to it.
 * ---------------------------------------------------------------------------
 */

export type HistorySample = { t: number; ccu: number }

export type IslandHistory = Record<string, Array<HistorySample>>

const minuteMs = 60 * 1000

export const historyLimits = {
  keepMs: 24 * 60 * minuteMs,
  /**
   * Discover is cached for five minutes but Refresh skips that; one sample
   * per ten minutes is plenty for an hourly trend and keeps the file to a
   * bounded size however often someone presses the button.
   */
  spacingMs: 10 * minuteMs,
  /** A few full refreshes' worth of islands. */
  maxIslands: 1_500,
} as const

/**
 * Players now minus the sample nearest to an hour ago. Only a sample 40–90
 * minutes old counts: anything nearer is noise, anything older is not "the
 * last hour", and saying nothing beats implying a trend we did not see.
 */
export function deltaOneHour(
  samples: ReadonlyArray<HistorySample> | undefined,
  current: number | null,
  now: number
) {
  if (current === null || !samples?.length) {
    return null
  }

  const target = now - 60 * minuteMs
  let best: HistorySample | null = null

  for (const sample of samples) {
    const age = now - sample.t

    if (age < 40 * minuteMs || age > 90 * minuteMs) {
      continue
    }

    if (!best || Math.abs(sample.t - target) < Math.abs(best.t - target)) {
      best = sample
    }
  }

  return best ? current - best.ccu : null
}

/** Fill `delta1h` from history. Leaves history untouched. */
export function withTrends(
  panels: ReadonlyArray<IslandPanel>,
  history: IslandHistory,
  now: number
): Array<IslandPanel> {
  return panels.map((panel) => ({
    ...panel,
    islands: panel.islands.map((island) => ({
      ...island,
      delta1h: deltaOneHour(history[island.code], island.ccu, now),
    })),
  }))
}

/**
 * Add this read's counts. Islands that hide their count add nothing, samples
 * past a day fall off, and past the island cap the islands seen longest ago
 * go first.
 */
export function recordHistory(
  history: IslandHistory,
  readings: ReadonlyArray<{ code: string; ccu: number | null }>,
  now: number
): IslandHistory {
  const oldest = now - historyLimits.keepMs
  const next: IslandHistory = {}

  for (const [code, samples] of Object.entries(history)) {
    const kept = samples.filter((sample) => sample.t >= oldest && sample.t <= now)

    if (kept.length > 0) {
      next[code] = kept
    }
  }

  for (const { code, ccu } of readings) {
    if (ccu === null || !Number.isFinite(ccu) || ccu < 0) {
      continue
    }

    const samples = next[code] ?? []
    const last = samples[samples.length - 1]

    if (last && now - last.t < historyLimits.spacingMs) {
      continue
    }

    next[code] = [...samples, { t: now, ccu: Math.round(ccu) }]
  }

  const codes = Object.keys(next)

  if (codes.length > historyLimits.maxIslands) {
    codes
      .sort(
        (a, b) =>
          next[a][next[a].length - 1].t - next[b][next[b].length - 1].t
      )
      .slice(0, codes.length - historyLimits.maxIslands)
      .forEach((code) => delete next[code])
  }

  return next
}

/** On disk as `[t, ccu]` pairs: the file is mostly numbers, so keys would double it. */
export function serialiseHistory(history: IslandHistory) {
  return {
    version: 1 as const,
    islands: Object.fromEntries(
      Object.entries(history).map(([code, samples]) => [
        code,
        samples.map((sample) => [sample.t, sample.ccu] as [number, number]),
      ])
    ),
  }
}

export function parseHistory(raw: unknown): IslandHistory {
  if (
    !raw ||
    typeof raw !== 'object' ||
    (raw as { version?: unknown }).version !== 1
  ) {
    return {}
  }

  const islands = (raw as { islands?: unknown }).islands

  if (!islands || typeof islands !== 'object') {
    return {}
  }

  const history: IslandHistory = {}

  for (const [code, pairs] of Object.entries(islands as Record<string, unknown>)) {
    if (!safeCode(code) || !Array.isArray(pairs)) {
      continue
    }

    const samples = pairs
      .filter(
        (pair): pair is [number, number] =>
          Array.isArray(pair) &&
          Number.isFinite(pair[0]) &&
          Number.isFinite(pair[1]) &&
          pair[1] >= 0
      )
      .map(([t, ccu]) => ({ t, ccu }))
      .sort((a, b) => a.t - b.t)

    if (samples.length > 0) {
      history[code] = samples
    }
  }

  return history
}

export function formatPlayers(value: number | null) {
  return value === null ? '—' : value.toLocaleString('en-GB')
}

export function formatDelta(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''

  return `${sign}${Math.abs(value).toLocaleString('en-GB')}`
}
