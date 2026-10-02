/**
 * An Epic account's competitive history, as the Fortnite events service
 * reports it to the account itself: the events it is eligible for or has
 * played, the windows each runs, and the account's own placement and points
 * in them.
 *
 * The events service answers with a calendar every account can see, plus the
 * reading account's own `tokens` (division grants, access passes) and, from a
 * second call per event, its own results. Which events matter to a given
 * account is worked out here from those two signals — eligibility from the
 * tokens, a played result from the history — so the global calendar is not
 * dumped on screen.
 *
 * The ids encode what the UI wants to show (`epicgames_S33_FNCS_Major1_EU`):
 * season, mode and region. `eventTitle` pulls those out, with a plain
 * humanised fallback for shapes it does not recognise.
 *
 * Everything here is parsing and joining, kept pure so it can be tested
 * against recorded replies.
 */

/** The parts read out of an event's id, for display. */
export type EventTitle = {
  /** The event's name: "FNCS", "Arena", "Dreamhack", or a humanised id. */
  label: string
  /** "Chapter 2 Season 5" / "Season 15", or null when none is encoded. */
  season: string | null
  /** "Europe" / "NA East", or null. */
  region: string | null
  /** "Solo" / "Duos" / "Trios" / "Squads", or null. */
  mode: string | null
}

/** One scheduled window of an event, as the calendar lists it. */
export type ParsedWindow = {
  eventWindowId: string
  eventTemplateId: string | null
  /** Round within the event, as Epic numbers it (0-based). */
  round: number | null
  beginTime: string | null
  endTime: string | null
  /** Tokens the account must hold *all* of to enter. */
  requireAllTokens: Array<string>
  /** Tokens the account must hold *one* of to enter; empty means no gate. */
  requireAnyTokens: Array<string>
}

/** One event on the calendar. */
export type ParsedEvent = {
  eventId: string
  displayDataId: string | null
  beginTime: string | null
  endTime: string | null
  regions: Array<string>
  windows: Array<ParsedWindow>
}

export type EventsData = {
  events: Array<ParsedEvent>
  /** eventTemplateId → playlistId, a fallback hint for an event's mode. */
  playlists: Record<string, string>
  /** The reading account's own tokens — what it is eligible for. */
  tokens: Array<string>
}

/** The account's result in one window, from the history call. */
export type WindowResult = {
  eventWindowId: string
  /** Placement — lower is better. Null when the account was not ranked. */
  rank: number | null
  /** Points earned toward the event. */
  points: number | null
  /** Where the account landed, 0 (top) to 1. */
  percentile: number | null
  /** Matches played in the window. */
  matches: number | null
}

/** An event's window joined to the account's result in it, for the UI. */
export type EventWindow = {
  eventWindowId: string
  round: number | null
  beginTime: string | null
  endTime: string | null
  result: WindowResult | null
}

/** One event summarised for the account: its name, and how the account did. */
export type EventSummary = {
  eventId: string
  displayDataId: string | null
  title: EventTitle
  beginTime: string | null
  endTime: string | null
  regions: Array<string>
  /** Windows, newest first, each with the account's result when there is one. */
  windows: Array<EventWindow>
  /** The account has at least one recorded result in this event. */
  played: boolean
  /** The account holds the tokens at least one window asks for. */
  eligible: boolean
  /** Best (lowest) placement across played windows; null when none. */
  bestRank: number | null
  /** Most points earned in a single window; null when none. */
  bestPoints: number | null
  /** How many windows the account actually played. */
  matchesPlayed: number
}

export type AccountTournaments = {
  status: 'ok' | 'unknown'
  /** The account's events, most recent first. Empty means no competitive history. */
  events: Array<EventSummary>
  /** The region the calendar was read for, when Epic required one; else null. */
  region: string | null
  checkedAt: string
  errorMessage?: string
}

export type AccountTournamentsPayload = {
  accounts: Record<string, AccountTournaments>
  /** The last reply of a check, carrying every linked account. */
  complete: boolean
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** A finite number, or null — Epic sends scores as numbers and as strings. */
function num(value: unknown) {
  const parsed = typeof value === 'string' ? Number(value) : value

  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

function stringList(value: unknown): Array<string> {
  return Array.isArray(value) ? value.flatMap((entry) => text(entry) ?? []) : []
}

/** Region codes as the ids and the service name them. */
const regionNames: Record<string, string> = {
  EU: 'Europe',
  NAE: 'NA East',
  NAW: 'NA West',
  NAC: 'NA Central',
  NA: 'North America',
  BR: 'Brazil',
  ASIA: 'Asia',
  OCE: 'Oceania',
  ME: 'Middle East',
}

/** Mode tokens, singular and plural, to one display word. */
const modeNames: Record<string, string> = {
  solo: 'Solo',
  solos: 'Solo',
  duo: 'Duos',
  duos: 'Duos',
  trio: 'Trios',
  trios: 'Trios',
  squad: 'Squads',
  squads: 'Squads',
}

/** Id segments that name the vendor, not the event — dropped from the title. */
const vendorTokens = new Set(['epicgames', 'fortnite', 'fortnitegame', 'game'])

function seasonLabel(token: string): string | null {
  const chapterSeason = /^ch(\d+)s(\d+)$/i.exec(token)

  if (chapterSeason) {
    return `Chapter ${chapterSeason[1]} Season ${chapterSeason[2]}`
  }

  const season = /^s(\d+)$/i.exec(token) ?? /^season(\d+)$/i.exec(token)

  if (season) {
    return `Season ${season[1]}`
  }

  const chapter = /^ch(?:apter)?(\d+)$/i.exec(token)

  if (chapter) {
    return `Chapter ${chapter[1]}`
  }

  return null
}

/** A single id segment made readable: "DivCups" → "Div Cups", acronyms kept. */
function humanizeToken(token: string) {
  const spaced = token
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .trim()

  return spaced
    .split(/\s+/)
    .map((word) =>
      // Leave acronyms (FNCS, NAE) alone; title-case ordinary words.
      /^[A-Z0-9]+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ')
}

type TokenScan = {
  season: string | null
  region: string | null
  mode: string | null
  nameTokens: Array<string>
}

/** Classify an id's `_`-separated segments into season, region, mode and name. */
function scanTokens(source: string): TokenScan {
  let season: string | null = null
  let region: string | null = null
  let mode: string | null = null
  const nameTokens: Array<string> = []

  for (const token of source.split(/[_\s]+/).filter(Boolean)) {
    if (vendorTokens.has(token.toLowerCase())) {
      continue
    }

    const asSeason = seasonLabel(token)

    if (asSeason && !season) {
      season = asSeason

      continue
    }

    const upper = token.toUpperCase()

    if (regionNames[upper] && !region) {
      region = regionNames[upper]

      continue
    }

    const asMode = modeNames[token.toLowerCase()]

    if (asMode && !mode) {
      mode = asMode

      continue
    }

    nameTokens.push(token)
  }

  return { season, region, mode, nameTokens }
}

/**
 * The parts to show for an event, read out of its id. The `displayDataId` is
 * the clean, season-and-mode id Epic made for exactly this, so it names the
 * event; the raw `eventId` fills a season, region or mode the clean id leaves
 * out (the region often lives only there), and `playlistId` fills a mode
 * neither id spells out.
 */
export function eventTitle(
  displayDataId: string | null | undefined,
  eventId: string | null | undefined,
  playlistId?: string | null
): EventTitle {
  const primary = text(displayDataId) ?? text(eventId)

  if (!primary) {
    return { label: 'Competitive event', season: null, region: null, mode: null }
  }

  const main = scanTokens(primary)
  const fallback = text(eventId)
  const extra = fallback && fallback !== primary ? scanTokens(fallback) : null

  let mode = main.mode ?? extra?.mode ?? null

  // A playlist (Playlist_ShowdownAlt_Trios) names the mode when no id did.
  if (!mode && playlistId) {
    for (const token of playlistId.split(/[_\s]+/)) {
      const asMode = modeNames[token.toLowerCase()]

      if (asMode) {
        mode = asMode

        break
      }
    }
  }

  const label = main.nameTokens.map(humanizeToken).filter(Boolean).join(' ').trim()

  return {
    label: label || 'Competitive event',
    season: main.season ?? extra?.season ?? null,
    region: main.region ?? extra?.region ?? null,
    mode,
  }
}

/** A one-line version of a title for compact captions. */
export function eventTitleLine(title: EventTitle) {
  return [title.label, title.season, title.mode, title.region]
    .filter(Boolean)
    .join(' · ')
}

function parseWindow(value: unknown): ParsedWindow | null {
  const window = record(value)
  const eventWindowId = text(window?.eventWindowId)

  if (!eventWindowId) {
    return null
  }

  return {
    eventWindowId,
    eventTemplateId: text(window?.eventTemplateId),
    round: num(window?.round),
    beginTime: text(window?.beginTime),
    endTime: text(window?.endTime),
    requireAllTokens: stringList(window?.requireAllTokens),
    requireAnyTokens: stringList(window?.requireAnyTokens),
  }
}

/**
 * The events service's `data` reply — the calendar, the scoring templates'
 * playlists, and the account's own tokens. A reply that did not come through
 * is an empty calendar, not a throw.
 */
export function parseEventsData(body: unknown): EventsData {
  const root = record(body)
  const events = Array.isArray(root?.events) ? root.events : []
  const templates = Array.isArray(root?.templates) ? root.templates : []
  const player = record(root?.player)

  const playlists: Record<string, string> = {}

  for (const entry of templates) {
    const template = record(entry)
    const id = text(template?.eventTemplateId)
    const playlist = text(template?.playlistId)

    if (id && playlist && !playlists[id]) {
      playlists[id] = playlist
    }
  }

  const parsed: Array<ParsedEvent> = []

  for (const entry of events) {
    const event = record(entry)
    const eventId = text(event?.eventId)

    if (!eventId) {
      continue
    }

    const windows = (Array.isArray(event?.eventWindows) ? event.eventWindows : [])
      .map(parseWindow)
      .filter((window): window is ParsedWindow => window !== null)

    parsed.push({
      eventId,
      displayDataId: text(event?.displayDataId),
      beginTime: text(event?.beginTime),
      endTime: text(event?.endTime),
      regions: stringList(event?.regions),
      windows,
    })
  }

  return {
    events: parsed,
    playlists,
    tokens: stringList(player?.tokens),
  }
}

/**
 * The account's results from an event's `history` reply. Epic has answered
 * this as a bare array and as `{ ... , eventWindowHistory: [] }`; both are
 * read. A result with no window id is dropped.
 */
export function parseEventHistory(body: unknown): Array<WindowResult> {
  const root = record(body)
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(root?.eventWindowHistory)
      ? root.eventWindowHistory
      : Array.isArray(root?.history)
        ? root.history
        : []

  const byWindow = new Map<string, WindowResult>()

  for (const entry of rows) {
    const row = record(entry)
    const eventWindowId = text(row?.eventWindowId)

    if (!eventWindowId) {
      continue
    }

    const sessions = Array.isArray(row?.sessionHistory) ? row.sessionHistory : []

    // Keep the kinder of any repeated window: best rank, most points.
    const next: WindowResult = {
      eventWindowId,
      rank: num(row?.rank) ?? num(row?.liveSessionAttributes),
      points: num(row?.pointsEarned) ?? num(row?.score),
      percentile: num(row?.percentile),
      matches: sessions.length > 0 ? sessions.length : num(row?.matchesPlayed),
    }
    const prior = byWindow.get(eventWindowId)

    byWindow.set(eventWindowId, prior ? mergeResult(prior, next) : next)
  }

  return [...byWindow.values()]
}

function lower(a: number | null, b: number | null) {
  if (a === null) return b
  if (b === null) return a

  return Math.min(a, b)
}

function higher(a: number | null, b: number | null) {
  if (a === null) return b
  if (b === null) return a

  return Math.max(a, b)
}

function mergeResult(a: WindowResult, b: WindowResult): WindowResult {
  return {
    eventWindowId: a.eventWindowId,
    rank: lower(a.rank, b.rank),
    points: higher(a.points, b.points),
    percentile: lower(a.percentile, b.percentile),
    matches: higher(a.matches, b.matches),
  }
}

/** Whether the account's tokens clear a window's gate. */
export function isWindowEligible(window: ParsedWindow, tokens: Set<string>) {
  const hasAll = window.requireAllTokens.every((token) => tokens.has(token))
  const hasAny =
    window.requireAnyTokens.length === 0 ||
    window.requireAnyTokens.some((token) => tokens.has(token))

  return hasAll && hasAny
}

function parseTime(value: string | null) {
  if (!value) {
    return null
  }

  const time = Date.parse(value)

  return Number.isFinite(time) ? time : null
}

/** Newest first, by begin time; events with no time sink to the bottom. */
function byNewest(a: { beginTime: string | null }, b: { beginTime: string | null }) {
  return (parseTime(b.beginTime) ?? -Infinity) - (parseTime(a.beginTime) ?? -Infinity)
}

/**
 * The events to spend a history call on: those that have already begun (only
 * those can hold a result), the account's eligible ones first, then newest,
 * capped so a full calendar stays a handful of calls.
 */
export function recentEventsForHistory(
  data: EventsData,
  { now = Date.now(), cap = 5 }: { now?: number; cap?: number } = {}
): Array<string> {
  const tokens = new Set(data.tokens)
  const eligible = (event: ParsedEvent) =>
    event.windows.some((window) => isWindowEligible(window, tokens))

  return data.events
    .filter((event) => {
      const begin = parseTime(event.beginTime)

      return begin === null || begin <= now
    })
    .sort(
      (a, b) => Number(eligible(b)) - Number(eligible(a)) || byNewest(a, b)
    )
    .slice(0, Math.max(0, cap))
    .map((event) => event.eventId)
}

/**
 * The calendar joined to the account's results: each event with its best
 * placement and points, whether it was played, and whether the account is
 * eligible for it. Most recent first.
 */
export function summarizeEvents(
  data: EventsData,
  historyByEventId: Record<string, Array<WindowResult>>
): Array<EventSummary> {
  const tokens = new Set(data.tokens)

  return data.events
    .map((event): EventSummary => {
      const results = new Map(
        (historyByEventId[event.eventId] ?? []).map((result) => [
          result.eventWindowId,
          result,
        ])
      )
      const playlistId =
        event.windows
          .map((window) =>
            window.eventTemplateId ? data.playlists[window.eventTemplateId] : null
          )
          .find(Boolean) ?? null

      const windows: Array<EventWindow> = event.windows
        .map((window) => ({
          eventWindowId: window.eventWindowId,
          round: window.round,
          beginTime: window.beginTime,
          endTime: window.endTime,
          result: results.get(window.eventWindowId) ?? null,
        }))
        .sort(byNewest)

      const played = windows.filter((window) => window.result !== null)

      return {
        eventId: event.eventId,
        displayDataId: event.displayDataId,
        title: eventTitle(event.displayDataId, event.eventId, playlistId),
        beginTime: event.beginTime,
        endTime: event.endTime,
        regions: event.regions,
        windows,
        played: played.length > 0,
        eligible: event.windows.some((window) => isWindowEligible(window, tokens)),
        bestRank: played.reduce<number | null>(
          (best, window) => lower(best, window.result?.rank ?? null),
          null
        ),
        bestPoints: played.reduce<number | null>(
          (best, window) => higher(best, window.result?.points ?? null),
          null
        ),
        matchesPlayed: played.reduce(
          (sum, window) => sum + (window.result?.matches ?? 0),
          0
        ),
      }
    })
    .sort(byNewest)
}

/** Events worth showing the account: ones it played or can enter. */
export function notableEvents(events: Array<EventSummary>) {
  return events.filter((event) => event.played || event.eligible)
}

/** "#12" / "1st" — a placement, ordinal for the podium, plain otherwise. */
export function formatPlacement(rank: number | null) {
  if (rank === null || rank <= 0) {
    return '—'
  }

  if (rank <= 3) {
    const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd'

    return `${rank}${suffix}`
  }

  return `#${rank.toLocaleString()}`
}

/** "1,240 pts", or a dash when the account earned none that could be read. */
export function formatPoints(points: number | null) {
  if (points === null) {
    return '—'
  }

  return `${Math.round(points).toLocaleString()} pts`
}

/** "Could not read competitive history (HTTP 403)." for the panel's error state. */
export function tournamentsErrorMessage(
  status: number | null | undefined,
  fallback: string
) {
  const boilerplate =
    !fallback ||
    fallback === 'Unknown error' ||
    /^Request failed with status code/.test(fallback)
  const reason = status ? `HTTP ${status}` : fallback
  const suffix = status && !boilerplate ? ` — ${fallback}` : ''

  return `Could not read competitive history (${reason})${suffix}. Try again later.`
}
