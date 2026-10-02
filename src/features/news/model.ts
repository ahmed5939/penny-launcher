/**
 * Pure parsing for Fortnite's in-game news.
 *
 * Epic's `fortnite-game` content document is a grab-bag of season-specific
 * subpages, each of which Epic re-keys and re-shapes whenever it feels like
 * it. So nothing here trusts the input: every level is guarded, every missing
 * branch collapses to an empty list, and a shape we have never seen simply
 * yields no messages rather than throwing. All of it is side-effect free and
 * unit-tested — the network and IPC live in `kernel/core/game-news.ts`.
 */

export type NewsCategory = 'stw' | 'br' | 'notice'

/** One news item, flattened to just what the panel renders. */
export type NewsMessage = {
  category: NewsCategory
  title: string
  body: string
  /** Absolute CDN image URL, or null when the message carries none. */
  image: string | null
  /** Epic's layout hint (e.g. `1`, `2`), kept for optional ordering. */
  adspace: string | null
}

/** The three news surfaces, already extracted and normalised. */
export type GameNewsContent = {
  stw: Array<NewsMessage>
  br: Array<NewsMessage>
  notices: Array<NewsMessage>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * The image field has been, across seasons, a bare URL string or an object
 * holding the URL under a handful of different keys. Resolve whatever is
 * there to a single absolute URL, or null.
 */
function readImage(message: Record<string, unknown>): string | null {
  const direct = asString(message.image).trim()

  if (direct) {
    return direct
  }

  const nested = asRecord(message.image)
  const candidate =
    asString(nested?.url) || asString(nested?.src) || asString(nested?.image)

  return candidate.trim() || null
}

/**
 * Pull a `messages[]` array out of a subpage and normalise each entry.
 *
 * `subpage` is `content[key]`; the messages live at `subpage.<listKey>.messages`
 * (e.g. `news.messages`, `emergencynotices.emergencynotices`). Entries flagged
 * `hidden: true` are Epic's way of staging a message before it goes live, so
 * they are dropped. Messages with neither a title nor a body carry nothing
 * worth showing and are dropped too.
 */
export function extractMessages(
  subpage: unknown,
  listKey: string,
  category: NewsCategory,
): Array<NewsMessage> {
  const outer = asRecord(subpage)
  const container = asRecord(outer?.[listKey])
  const rawMessages = container?.messages

  if (!Array.isArray(rawMessages)) {
    return []
  }

  const messages: Array<NewsMessage> = []

  for (const entry of rawMessages) {
    const message = asRecord(entry)

    if (!message || message.hidden === true) {
      continue
    }

    const title = asString(message.title).trim()
    const body = asString(message.body).trim()

    if (!title && !body) {
      continue
    }

    messages.push({
      category,
      title,
      body,
      image: readImage(message),
      adspace:
        typeof message.adspace === 'string'
          ? message.adspace
          : typeof message.adspace === 'number'
            ? `${message.adspace}`
            : null,
    })
  }

  return messages
}

/** Save the World news — the panel's primary surface. */
export function extractStwNews(content: unknown): Array<NewsMessage> {
  const root = asRecord(content)

  return extractMessages(root?.savetheworldnews, 'news', 'stw')
}

/**
 * Battle Royale news. Epic ships the current version under `...v2` and leaves
 * the previous key in place for a while, so fall back to the legacy key when
 * the v2 subpage is absent or empty.
 */
export function extractBrNews(content: unknown): Array<NewsMessage> {
  const root = asRecord(content)
  const v2 = extractMessages(root?.battleroyalenewsv2, 'news', 'br')

  if (v2.length > 0) {
    return v2
  }

  return extractMessages(root?.battleroyalenews, 'news', 'br')
}

/**
 * Active service notices — the red emergency banner shown in-game during an
 * outage or event. Same v2-with-fallback story as BR news.
 */
export function extractEmergencyNotices(content: unknown): Array<NewsMessage> {
  const root = asRecord(content)
  const v2 = extractMessages(
    root?.emergencynoticev2,
    'emergencynotices',
    'notice',
  )

  if (v2.length > 0) {
    return v2
  }

  return extractMessages(
    root?.emergencynotice,
    'emergencynotices',
    'notice',
  )
}

/** Everything the panel needs, from the raw `fortnite-game` document. */
export function extractGameNews(content: unknown): GameNewsContent {
  return {
    stw: extractStwNews(content),
    br: extractBrNews(content),
    notices: extractEmergencyNotices(content),
  }
}

/** True when there is nothing at all worth rendering. */
export function isGameNewsEmpty(content: GameNewsContent): boolean {
  return (
    content.stw.length === 0 &&
    content.br.length === 0 &&
    content.notices.length === 0
  )
}
