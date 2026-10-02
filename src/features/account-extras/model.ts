/**
 * Two small Epic account services the game itself barely shows: the outfit
 * an account wears as its avatar, and its social standing (social bans and
 * warnings). Everything here is pure — the main-process reader is
 * `kernel/core/account-extras.ts` — so the parsing can be tested against
 * the shapes Epic returns without a network.
 */

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

export type AccountAvatar = {
  /** `CID_029_Athena_Commando_F_Halloween` — the outfit, without its prefix. */
  cosmeticId: string | null
  imageUrl: string | null
  /** The outfit's name, when the cosmetics catalogue knew it. */
  name: string | null
}

export type AccountAvatarsPayload = {
  avatars: Record<string, AccountAvatar>
}

/** The avatar service answers up to this many ids in one call. */
export const avatarBatchSize = 100

export const emptyAvatar: AccountAvatar = {
  cosmeticId: null,
  imageUrl: null,
  name: null,
}

/** Epic account ids are 32 hex characters; anything else is not worth a request. */
export function isEpicAccountId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value)
}

export function chunk<T>(items: ReadonlyArray<T>, size: number) {
  const step = Math.max(1, Math.floor(size))
  const chunks: Array<Array<T>> = []

  for (let index = 0; index < items.length; index += step) {
    chunks.push(items.slice(index, index + step))
  }

  return chunks
}

/**
 * `ATHENACHARACTER:CID_029_Athena_Commando_F_Halloween` → the part after
 * the first colon. The prefix is upper-cased here where the locker spells it
 * `AthenaCharacter`, so nothing reads it; a bare id with no prefix is taken
 * as it is.
 */
export function parseAvatarId(avatarId: unknown) {
  if (typeof avatarId !== 'string') {
    return null
  }

  const trimmed = avatarId.trim()
  const separator = trimmed.indexOf(':')
  const id = (separator < 0 ? trimmed : trimmed.slice(separator + 1)).trim()

  return id || null
}

/**
 * fortnite-api.com files every BR cosmetic's art under its lower-cased id,
 * which is also where the catalogue's own `smallIcon` points — so this is
 * right without the 20 MB catalogue, as long as the outfit is a BR one. A
 * variant suffix (`cid_x:variant`) is not part of that path.
 */
export function fallbackAvatarImageUrl(cosmeticId: string) {
  const base = cosmeticId.split(':')[0].trim().toLowerCase()

  if (!/^[a-z0-9_.-]+$/.test(base)) {
    return null
  }

  return `https://fortnite-api.com/images/cosmetics/br/${base}/smallicon.png`
}

/**
 * `[{ accountId, namespace, avatarId }]` → account id (lower-cased) to
 * cosmetic id. Entries that are not objects, or carry no account id, are
 * skipped rather than failing the batch.
 */
export function parseAvatarList(data: unknown) {
  const found = new Map<string, string | null>()

  if (!Array.isArray(data)) {
    return found
  }

  for (const entry of data) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const { accountId, avatarId } = entry as Record<string, unknown>

    if (typeof accountId !== 'string' || !accountId) {
      continue
    }

    found.set(accountId.toLowerCase(), parseAvatarId(avatarId))
  }

  return found
}

/**
 * What to draw for one account. A catalogue match wins; a previous answer
 * for the same outfit keeps its name when the catalogue is not loaded this
 * time; otherwise the art comes from its fortnite-api path, unnamed.
 */
export function describeAvatar(
  cosmeticId: string | null,
  resolved?: { name: string | null; imageUrl: string | null } | null,
  previous?: AccountAvatar | null
): AccountAvatar {
  if (!cosmeticId) {
    return emptyAvatar
  }

  const sameAsBefore =
    previous?.cosmeticId?.toLowerCase() === cosmeticId.toLowerCase()

  return {
    cosmeticId,
    imageUrl:
      resolved?.imageUrl ??
      fallbackAvatarImageUrl(cosmeticId) ??
      (sameAsBefore ? previous?.imageUrl ?? null : null),
    name: resolved?.name ?? (sameAsBefore ? previous?.name ?? null : null),
  }
}

/** A persisted cache entry, or null when the file holds something else. */
export function readPersistedAvatar(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const entry = value as Record<string, unknown>
  const text = (key: string) =>
    typeof entry[key] === 'string' && entry[key] ? (entry[key] as string) : null

  if (typeof entry.fetchedAt !== 'number' || !Number.isFinite(entry.fetchedAt)) {
    return null
  }

  return {
    cosmeticId: text('cosmeticId'),
    imageUrl: text('imageUrl'),
    name: text('name'),
    fetchedAt: entry.fetchedAt,
  }
}

/** One or two letters for the fallback: "Penny Bot" → "PB", "penny" → "P". */
export function avatarInitials(name: string | null | undefined) {
  const words = (name ?? '')
    .trim()
    .split(/[\s_.-]+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))

  if (words.length === 0) {
    return '?'
  }

  const first = (word: string) => Array.from(word.replace(/^[^\p{L}\p{N}]+/u, ''))[0] ?? ''

  return (first(words[0]) + (words.length > 1 ? first(words[1]) : '')).toUpperCase()
}

// ---------------------------------------------------------------------------
// Social standing
// ---------------------------------------------------------------------------

export type StandingStatus = 'good' | 'warned' | 'banned' | 'unknown'

/**
 * One ban or warning.
 *
 * Epic's GraphQL schema for the same service names the fields: a ban is
 * `{ starts_at, ends_at, acked, duration_s }`, a warning only `{ acked }` —
 * no dates at all. The REST body carries the same items. Those names are
 * read first; the looser matching after them is a fallback for fields Epic
 * adds later, and `raw` keeps the whole record either way.
 */
export type StandingItem = {
  id: string | null
  /** As Epic words it — a code or a sentence. Not part of the known shape. */
  reason: string | null
  /** Which feature it covers (voice chat, text chat…), when stated. */
  type: string | null
  /** ISO time the ban began (`starts_at`). Warnings have none. */
  startsAt: string | null
  /**
   * ISO time it lapses: `ends_at`, else `starts_at + duration_s`. Null when
   * neither is given — a permanent ban, or a warning.
   */
  expiresAt: string | null
  /** `duration_s`, when given. */
  durationSeconds: number | null
  /** `acked`: the player has seen it in-game. Null when not stated. */
  acknowledged: boolean | null
  /** The record itself says it is over (`active: false`, `expired: true`…). */
  lifted: boolean
  raw: Record<string, unknown>
}

export type AccountStanding = {
  status: StandingStatus
  bans: Array<StandingItem>
  warnings: Array<StandingItem>
  /** ISO time of the check. */
  checkedAt: string
  errorMessage?: string
}

export type AccountStandingPayload = {
  accounts: Record<string, AccountStanding>
  /** True on the last reply of a check, which carries every linked account. */
  complete: boolean
}

/** Epoch seconds or milliseconds, numeric strings, or a date string → ISO. */
export function toIsoTime(value: unknown) {
  let time: number

  if (typeof value === 'number') {
    time = value
  } else if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()

    time = /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Date.parse(trimmed)
  } else {
    return null
  }

  if (!Number.isFinite(time) || time <= 0) {
    return null
  }

  // Ten digits is seconds until the year 2286.
  const ms = time < 1e11 ? time * 1000 : time
  const date = new Date(ms)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function textOf(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>

    for (const key of ['text', 'message', 'name', 'code', 'value', 'type']) {
      const text = textOf(record[key])

      if (text) {
        return text
      }
    }
  }

  return null
}

/** `banReasonCode` / `ban_reason_code` → `['ban', 'reason', 'code']`. */
function keyWords(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

type Field = { words: Array<string>; value: unknown }

/** Top-level keys first, then one level into nested objects (`details.reason`). */
function fieldsOf(record: Record<string, unknown>) {
  const fields: Array<Field> = Object.entries(record).map(([key, value]) => ({
    words: keyWords(key),
    value,
  }))

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, inner] of Object.entries(
        value as Record<string, unknown>
      )) {
        fields.push({ words: keyWords(key), value: inner })
      }
    }
  }

  return fields
}

/** The first field, by order of `tests`, whose name passes and whose value reads. */
function pick(
  fields: Array<Field>,
  tests: Array<(words: Array<string>) => boolean>,
  read: (value: unknown) => string | null
) {
  for (const test of tests) {
    for (const field of fields) {
      if (!test(field.words)) {
        continue
      }

      const result = read(field.value)

      if (result) {
        return result
      }
    }
  }

  return null
}

const has = (words: Array<string>, ...wanted: Array<string>) =>
  words.some((word) => wanted.includes(word))
const isOnly = (words: Array<string>, ...wanted: Array<string>) =>
  words.length === 1 && wanted.includes(words[0])
const endsInId = (words: Array<string>) => words[words.length - 1] === 'id'
/** Ids and times of the people involved, not of the record. */
const aboutSomeoneElse = (words: Array<string>) =>
  has(words, 'account', 'offender', 'reporter', 'actor', 'issuer', 'user', 'player', 'target')

const recordKinds = ['ban', 'banned', 'warn', 'warned', 'warning', 'sanction', 'case', 'action']
const expiryWords = ['expires', 'expiry', 'expiration', 'expire', 'expiring']
/** `banEndTime`, `validUntil`, `liftedAt` — when it stops, not when it began. */
const isEnding = (words: Array<string>) =>
  has(words, ...expiryWords, 'end', 'ends', 'ended', 'until', 'lifted', 'lift')

export function parseStandingItem(value: unknown): StandingItem {
  if (typeof value === 'string' || typeof value === 'number') {
    return {
      id: null,
      reason: textOf(value),
      type: null,
      startsAt: null,
      expiresAt: null,
      durationSeconds: null,
      acknowledged: null,
      lifted: false,
      raw: { value },
    }
  }

  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {}
  const fields = fieldsOf(raw)
  /** `acked`, `isExpired` and the like: the first boolean by one of these names. */
  const flag = (...names: Array<string>) => {
    for (const { value: item, words } of fields) {
      const name = words[0] === 'is' ? words.slice(1) : words

      if (typeof item === 'boolean' && isOnly(name, ...names)) {
        return item
      }
    }

    return null
  }

  const startsAt = pick(
    fields,
    [
      (words) => isOnly(words.filter((word) => word !== 'at'), 'starts'),
      (words) =>
        has(words, 'created', 'creation', 'create', 'issued') &&
        !aboutSomeoneElse(words),
      (words) =>
        has(words, ...recordKinds) &&
        has(words, 'at', 'time', 'date') &&
        !aboutSomeoneElse(words) &&
        !isEnding(words),
      (words) =>
        (has(words, 'starts', 'start', 'started', 'begin', 'begins', 'received', 'timestamp') ||
          isOnly(words, 'time', 'date')) &&
        !aboutSomeoneElse(words) &&
        !isEnding(words),
    ],
    toIsoTime
  )
  const endsAt = pick(
    fields,
    [
      (words) => isOnly(words.filter((word) => word !== 'at'), 'ends'),
      (words) => has(words, ...expiryWords),
      (words) => isEnding(words),
    ],
    toIsoTime
  )
  const duration = pick(
    fields,
    [
      (words) =>
        words[0] === 'duration' &&
        words.length === 2 &&
        ['s', 'sec', 'secs', 'seconds'].includes(words[1]),
    ],
    (item) =>
      typeof item === 'number' && Number.isFinite(item) && item > 0
        ? String(item)
        : null
  )
  const durationSeconds = duration === null ? null : Number(duration)
  const lifted =
    flag('active') === false ||
    flag('expired', 'lifted', 'revoked', 'removed', 'resolved') === true

  return {
    id: pick(
      fields,
      [
        (words) => endsInId(words) && words.length === 2 && has(words, ...recordKinds),
        (words) => isOnly(words, 'id'),
      ],
      textOf
    ),
    reason: pick(
      fields,
      [
        (words) => has(words, 'reason') && !endsInId(words),
        (words) => isOnly(words, 'message', 'description', 'text', 'details', 'detail'),
        (words) =>
          has(words, 'category', 'violation', 'offense', 'offence') &&
          !endsInId(words),
      ],
      textOf
    ),
    type: pick(
      fields,
      [
        (words) =>
          has(words, 'type', 'feature', 'features', 'scope', 'kind', 'restriction', 'channel') &&
          !has(words, 'reason') &&
          !endsInId(words) &&
          !aboutSomeoneElse(words),
      ],
      textOf
    ),
    startsAt,
    expiresAt:
      endsAt ??
      (startsAt && durationSeconds !== null
        ? new Date(Date.parse(startsAt) + durationSeconds * 1000).toISOString()
        : null),
    durationSeconds,
    acknowledged: flag('acked', 'acknowledged', 'ack', 'seen'),
    lifted,
    raw,
  }
}

/** Still in force at `now`: not marked over, and not past its expiry. */
export function isStandingItemActive(item: StandingItem, now = Date.now()) {
  if (item.lifted) {
    return false
  }

  if (!item.expiresAt) {
    return true
  }

  const expiry = Date.parse(item.expiresAt)

  return Number.isNaN(expiry) || expiry > now
}

/** `{ bans: [], warnings: [] }`, read so that a missing or odd list is an empty one. */
export function parseStanding(data: unknown) {
  const body =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const list = (value: unknown) =>
    Array.isArray(value) ? value.map(parseStandingItem) : []

  return { bans: list(body.bans), warnings: list(body.warnings) }
}

/**
 * A ban in force outranks a warning; an expired or lifted ban counts for
 * nothing. Warnings carry no dates, so any warning present means warned —
 * acknowledged or not.
 */
export function classifyStanding(
  bans: ReadonlyArray<StandingItem>,
  warnings: ReadonlyArray<StandingItem>,
  now = Date.now()
): Exclude<StandingStatus, 'unknown'> {
  if (bans.some((item) => isStandingItemActive(item, now))) {
    return 'banned'
  }

  if (warnings.length > 0) {
    return 'warned'
  }

  return 'good'
}

/** `604800` → "7 days"; whole units only, the largest that fits. */
export function formatBanDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return null
  }

  const units: Array<[number, string]> = [
    [86_400, 'day'],
    [3_600, 'hour'],
    [60, 'minute'],
  ]

  for (const [size, unit] of units) {
    if (seconds >= size) {
      const count = Math.round(seconds / size)

      return `${count} ${unit}${count === 1 ? '' : 's'}`
    }
  }

  return `${Math.round(seconds)} seconds`
}

/** `VOICE_CHAT_ABUSE` → "Voice chat abuse"; prose is left alone. */
export function humaniseStandingText(value: string | null) {
  if (!value) {
    return null
  }

  if (/\s/.test(value.trim())) {
    return value.trim()
  }

  const words = value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
    .join(' ')

  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Counts across the linked accounts, for an "all clear" line. */
export function summariseStanding(
  accounts: Record<string, AccountStanding | undefined>,
  accountIds: ReadonlyArray<string>
) {
  const summary = { banned: 0, good: 0, pending: 0, unknown: 0, warned: 0 }

  for (const accountId of accountIds) {
    const entry = accounts[accountId]

    if (!entry) {
      summary.pending += 1
    } else {
      summary[entry.status] += 1
    }
  }

  return {
    ...summary,
    total: accountIds.length,
    allGood: accountIds.length > 0 && summary.good === accountIds.length,
  }
}
