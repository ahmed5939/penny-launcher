import type {
  SpriteCollection,
  SpriteData,
  SpriteVariantKey,
} from './sprite-collection'

import spriteData from '../../data/sprites.json'

import { parseRelicId, prettifyFamily, variantLabel } from './sprite-collection'

/**
 * The sprite collection over time.
 *
 * Epic keeps no history of a relic inventory — a read says what the account
 * holds now and nothing about yesterday. So every successful read is kept as
 * a snapshot, the next read is compared against it, and the difference is
 * the change log: what was secured, recovered, lost, mastered or equipped
 * between two reads. The same file remembers which relics the catalogue has
 * listed before, which is how a new season's sprites are spotted.
 *
 * Pure on purpose, like `sprite-collection.ts`; `SpriteHistory` in
 * `sprite-history.ts` owns the file and the timer.
 */

export type SpriteRelicState = {
  status: 'owned' | 'lost'
  xp: number | null
  mastered: boolean
}

/** One read of one account. Relics never secured are left out. */
export type SpriteSnapshot = {
  dust: number | null
  equippedRelicId: string | null
  relics: Record<string, SpriteRelicState>
}

/**
 * `secured` is a first-time catch; `recovered` is a lost sprite summoned or
 * caught again. They are separate because "you got a new one" and "you got
 * one back" are different news.
 */
export type SpriteEventKind =
  | 'secured'
  | 'recovered'
  | 'lost'
  | 'mastered'
  | 'equipped'

export type SpriteEvent = {
  id: string
  /** Every event from one read shares this, so a view can group them. */
  batchId: string
  accountId: string
  /** ISO time of the read that noticed the change. */
  at: string
  kind: SpriteEventKind
  relicId: string
  /** `equipped` only: the relic it replaced, when one was equipped. */
  previousRelicId: string | null
  /** Sprite Dust gained (or spent) across the same read; null when unknown. */
  dustDelta: number | null
}

export type SpriteWatchSettings = {
  enabled: boolean
  intervalMinutes: number
}

export type SpriteCatalogueRecord = {
  knownRelicIds: Array<string>
  /** ISO time a relic first appeared; null for the ones there before tracking began. */
  firstSeen: Record<string, string | null>
}

export type SpriteAccountRecord = {
  updatedAt: string
  snapshot: SpriteSnapshot
}

export type SpriteHistoryFile = {
  version: 1
  watch: SpriteWatchSettings
  catalogue: SpriteCatalogueRecord
  accounts: Record<string, SpriteAccountRecord>
  /** Newest first, capped at `historyEventLimit`. */
  events: Array<SpriteEvent>
}

export type CatalogueStatus = {
  /** The catalogue schema version Penny read this session. */
  version: number
  /** Relics first listed within the last fortnight. */
  newRelicIds: Array<string>
  /** Catalogue relics `data/sprites.json` has no name or art for yet. */
  unresolvedRelicIds: Array<string>
  /** Set when Epic moved the catalogue to another version. */
  versionNote: string | null
}

/** Display facts about a relic, from the bundled data file. */
export type SpriteRelicInfo = {
  relicId: string
  family: string
  variant: SpriteVariantKey
  familyName: string
  variantLabel: string
  /** "Gold Water"; just "Water" for the base treatment. */
  name: string
  rarity: string
  iconFile: string | null
  resolved: boolean
}

export type SpriteAccountSummary = {
  updatedAt: string
  equippedRelicId: string | null
  /** The equipped relic, resolved for the account switcher badge. */
  equipped: Pick<SpriteRelicInfo, 'name' | 'iconFile' | 'rarity'> | null
  dust: number | null
  ownedCount: number
}

/** What the renderer gets: no tokens, no raw inventory. */
export type SpriteHistoryPayload = {
  events: Array<SpriteEvent>
  accounts: Record<string, SpriteAccountSummary>
  watch: SpriteWatchSettings
  catalogue: CatalogueStatus
}

export const historyEventLimit = 500

export const watchIntervalDefault = 30

/**
 * A sweep reads every linked account one after another, so anything more
 * often than this is a steady trickle of requests to Epic for news that
 * rarely changes faster than a match takes.
 */
export const watchIntervalMin = 15

export const watchIntervalMax = 24 * 60

export const newRelicWindowMs = 14 * 24 * 60 * 60 * 1000

const data = spriteData as SpriteData

const eventKinds: Array<SpriteEventKind> = [
  'secured',
  'recovered',
  'mastered',
  'lost',
  'equipped',
]

const verbs: Record<SpriteEventKind, string> = {
  secured: 'secured',
  recovered: 'recovered',
  lost: 'lost',
  mastered: 'mastered',
  equipped: 'equipped',
}

export function emptySpriteHistory(): SpriteHistoryFile {
  return {
    version: 1,
    watch: { enabled: false, intervalMinutes: watchIntervalDefault },
    catalogue: { knownRelicIds: [], firstSeen: {} },
    accounts: {},
    events: [],
  }
}

export function clampWatchInterval(value: unknown) {
  const minutes =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : watchIntervalDefault

  return Math.min(watchIntervalMax, Math.max(watchIntervalMin, minutes))
}

/**
 * One key per creature-and-treatment, however the id was spelt. Snapshots
 * store the id they were read with, but the spine prefers the catalogue's
 * spelling and falls back to a made-up one when the catalogue is down — so
 * comparing raw ids would report every sprite as newly secured the first
 * time the catalogue failed.
 */
export function relicKey(relicId: string) {
  const { family, variant } = parseRelicId(relicId)

  return `${family}::${variant}`
}

export function describeRelic(
  relicId: string,
  source: SpriteData = data
): SpriteRelicInfo {
  const { family, variant } = parseRelicId(relicId)
  const known = source.families[family]
  const familyName = known?.name ?? prettifyFamily(family)
  const label = variantLabel(variant)

  return {
    relicId,
    family,
    variant,
    familyName,
    variantLabel: label,
    name: variant === 'base' ? familyName : `${label} ${familyName}`,
    rarity: known?.rarity ?? 'common',
    iconFile: known?.icons[variant] ?? known?.icons.base ?? null,
    resolved: Boolean(known),
  }
}

export function snapshotFromCollection(
  collection: SpriteCollection
): SpriteSnapshot {
  const relics: Record<string, SpriteRelicState> = {}

  collection.families.forEach((family) => {
    family.variants.forEach((entry) => {
      if (entry.status === 'missing') {
        return
      }

      relics[entry.relicId] = {
        status: entry.status,
        xp: entry.xp,
        mastered: entry.mastered,
      }
    })
  })

  return {
    dust: collection.spriteDust,
    equippedRelicId: collection.equippedRelicId,
    relics,
  }
}

export type SpriteChange = Pick<
  SpriteEvent,
  'kind' | 'relicId' | 'previousRelicId'
>

function byKey(snapshot: SpriteSnapshot) {
  const map = new Map<string, { relicId: string; state: SpriteRelicState }>()

  Object.entries(snapshot.relics).forEach(([relicId, state]) => {
    map.set(relicKey(relicId), { relicId, state })
  })

  return map
}

/**
 * What changed between two reads.
 *
 * A relic that disappears from the inventory altogether is deliberately not
 * reported: that is what a partial or reset inventory looks like, and a
 * false "lost" alert is worse than a missed one. Only an owned relic that
 * reads as lost is a loss.
 */
export function diffSnapshots(
  previous: SpriteSnapshot,
  next: SpriteSnapshot
): { changes: Array<SpriteChange>; dustDelta: number | null } {
  const before = byKey(previous)
  const changes: Array<SpriteChange> = []

  byKey(next).forEach(({ relicId, state }, key) => {
    const prior = before.get(key)?.state

    if (state.status === 'owned' && prior?.status !== 'owned') {
      changes.push({
        kind: prior?.status === 'lost' ? 'recovered' : 'secured',
        relicId,
        previousRelicId: null,
      })
    } else if (state.status === 'lost' && prior?.status === 'owned') {
      changes.push({ kind: 'lost', relicId, previousRelicId: null })
    }

    if (state.mastered && !prior?.mastered) {
      changes.push({ kind: 'mastered', relicId, previousRelicId: null })
    }
  })

  const equippedBefore = previous.equippedRelicId
    ? relicKey(previous.equippedRelicId)
    : null

  if (
    next.equippedRelicId &&
    relicKey(next.equippedRelicId) !== equippedBefore
  ) {
    changes.push({
      kind: 'equipped',
      relicId: next.equippedRelicId,
      previousRelicId: previous.equippedRelicId,
    })
  }

  changes.sort(
    (a, b) =>
      eventKinds.indexOf(a.kind) - eventKinds.indexOf(b.kind) ||
      a.relicId.localeCompare(b.relicId)
  )

  return {
    changes,
    dustDelta:
      previous.dust !== null && next.dust !== null
        ? next.dust - previous.dust
        : null,
  }
}

/**
 * A relic missing from a read keeps its last known state.
 *
 * Relics do not leave an inventory — a lost one stays behind as a count of
 * one — so a read without one is a partial answer. Storing it as-is would
 * forget the relic, and the next full read would announce it as newly
 * secured: one flaky response and the history fills with false news.
 */
export function carryForward(
  previous: SpriteSnapshot,
  next: SpriteSnapshot
): SpriteSnapshot {
  const present = new Set(Object.keys(next.relics).map(relicKey))
  const vanished = Object.entries(previous.relics).filter(
    ([relicId]) => !present.has(relicKey(relicId))
  )

  if (vanished.length === 0) {
    return next
  }

  return {
    ...next,
    relics: { ...Object.fromEntries(vanished), ...next.relics },
  }
}

/**
 * Store a read and log what changed since the last one.
 *
 * The first snapshot of an account is a silent baseline: with nothing to
 * compare against, every owned sprite would otherwise arrive as a wall of
 * "secured" alerts on the day the feature is switched on.
 */
export function recordSnapshot(
  file: SpriteHistoryFile,
  accountId: string,
  read: SpriteSnapshot,
  now = new Date()
): { file: SpriteHistoryFile; events: Array<SpriteEvent> } {
  const at = now.toISOString()
  const previous = file.accounts[accountId]?.snapshot ?? null
  const snapshot = previous ? carryForward(previous, read) : read
  const accounts = {
    ...file.accounts,
    [accountId]: { updatedAt: at, snapshot },
  }

  if (!previous) {
    return { file: { ...file, accounts }, events: [] }
  }

  const { changes, dustDelta } = diffSnapshots(previous, snapshot)
  const batchId = `${accountId}:${at}`
  const events = changes.map(
    (change, index): SpriteEvent => ({
      id: `${batchId}:${index}`,
      batchId,
      accountId,
      at,
      ...change,
      dustDelta,
    })
  )

  return {
    file: {
      ...file,
      accounts,
      events: [...events, ...file.events].slice(0, historyEventLimit),
    },
    events,
  }
}

/**
 * Fold a catalogue read into what is known.
 *
 * The first read ever is the baseline — those relics were there before
 * Penny was watching, so they get no date and no "New" badge. After that,
 * an id the catalogue has never listed is stamped with the time it turned
 * up. Returns the same record when nothing is new, so the caller can skip
 * the write.
 */
export function observeCatalogue(
  record: SpriteCatalogueRecord,
  relicIds: Array<string>,
  now = new Date()
): SpriteCatalogueRecord {
  const ids = [
    ...new Set(relicIds.filter((id) => !id.startsWith('Currency_'))),
  ]

  if (ids.length === 0) {
    return record
  }

  const baseline = record.knownRelicIds.length === 0
  const knownKeys = new Set(record.knownRelicIds.map(relicKey))
  const fresh = ids.filter((id) => !knownKeys.has(relicKey(id)))

  if (fresh.length === 0) {
    return record
  }

  const stamp = baseline ? null : now.toISOString()

  return {
    knownRelicIds: [...record.knownRelicIds, ...fresh].sort(),
    firstSeen: {
      ...record.firstSeen,
      ...Object.fromEntries(fresh.map((id) => [id, stamp])),
    },
  }
}

export function catalogueStatus(
  record: SpriteCatalogueRecord,
  {
    now = new Date(),
    source = data,
    version,
    versionNote = null,
  }: {
    now?: Date
    source?: SpriteData
    version: number
    versionNote?: string | null
  }
): CatalogueStatus {
  const cutoff = now.getTime() - newRelicWindowMs

  return {
    version,
    newRelicIds: Object.entries(record.firstSeen)
      .filter(([, seen]) => seen !== null && Date.parse(seen) >= cutoff)
      .map(([relicId]) => relicId)
      .sort(),
    unresolvedRelicIds: record.knownRelicIds
      .filter((relicId) => !source.families[parseRelicId(relicId).family])
      .sort(),
    versionNote,
  }
}

/**
 * The toast line for one account's batch: the most interesting change by
 * name, and a count of the rest. Equipping is left out — it is something
 * the player just did, not news — so a batch of only that returns null.
 */
export function summariseBatch(
  events: Array<SpriteEvent>,
  displayName: string,
  source: SpriteData = data
): string | null {
  const notable = events
    .filter((event) => event.kind !== 'equipped')
    .sort((a, b) => eventKinds.indexOf(a.kind) - eventKinds.indexOf(b.kind))

  if (notable.length === 0) {
    return null
  }

  const [lead, ...rest] = notable
  const name = describeRelic(lead.relicId, source).name
  const tail =
    rest.length === 0
      ? ''
      : rest.every((event) => event.kind === lead.kind)
        ? ` and ${rest.length} more`
        : ` and ${rest.length} more ${rest.length === 1 ? 'change' : 'changes'}`

  return `${displayName} ${verbs[lead.kind]} ${name}${tail}.`
}

export function summariseAccounts(
  file: SpriteHistoryFile,
  source: SpriteData = data
): Record<string, SpriteAccountSummary> {
  return Object.fromEntries(
    Object.entries(file.accounts).map(([accountId, record]) => {
      const { equippedRelicId, dust, relics } = record.snapshot
      const equipped = equippedRelicId
        ? describeRelic(equippedRelicId, source)
        : null

      return [
        accountId,
        {
          updatedAt: record.updatedAt,
          equippedRelicId,
          equipped: equipped
            ? {
                name: equipped.name,
                iconFile: equipped.iconFile,
                rarity: equipped.rarity,
              }
            : null,
          dust,
          ownedCount: Object.values(relics).filter(
            (state) => state.status === 'owned'
          ).length,
        },
      ]
    })
  )
}

/**
 * The renderer's view of the file: the change log and a per-account
 * summary, with the raw snapshots left behind in the main process.
 */
export function buildHistoryPayload(
  file: SpriteHistoryFile,
  catalogue: CatalogueStatus,
  source: SpriteData = data
): SpriteHistoryPayload {
  return {
    events: file.events,
    accounts: summariseAccounts(file, source),
    watch: file.watch,
    catalogue,
  }
}

/*
 * Reading the file back. It is ours, but it outlives app versions and can
 * be hand-edited or half-written, so every field is checked and anything
 * malformed is dropped rather than trusted.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readSnapshot(value: unknown): SpriteSnapshot | null {
  if (!isRecord(value) || !isRecord(value.relics)) {
    return null
  }

  const relics: Record<string, SpriteRelicState> = {}

  Object.entries(value.relics).forEach(([relicId, state]) => {
    if (
      isRecord(state) &&
      (state.status === 'owned' || state.status === 'lost')
    ) {
      relics[relicId] = {
        status: state.status,
        xp: numberOrNull(state.xp),
        mastered: state.mastered === true,
      }
    }
  })

  return {
    dust: numberOrNull(value.dust),
    equippedRelicId: stringOrNull(value.equippedRelicId),
    relics,
  }
}

function readEvent(value: unknown): SpriteEvent | null {
  if (!isRecord(value)) {
    return null
  }

  const { accountId, at, batchId, id, kind, relicId } = value

  if (
    typeof id !== 'string' ||
    typeof batchId !== 'string' ||
    typeof accountId !== 'string' ||
    typeof at !== 'string' ||
    typeof relicId !== 'string' ||
    !eventKinds.includes(kind as SpriteEventKind)
  ) {
    return null
  }

  return {
    id,
    batchId,
    accountId,
    at,
    kind: kind as SpriteEventKind,
    relicId,
    previousRelicId: stringOrNull(value.previousRelicId),
    dustDelta: numberOrNull(value.dustDelta),
  }
}

export function normaliseSpriteHistory(raw: unknown): SpriteHistoryFile {
  const file = emptySpriteHistory()

  if (!isRecord(raw) || raw.version !== 1) {
    return file
  }

  if (isRecord(raw.watch)) {
    file.watch = {
      enabled: raw.watch.enabled === true,
      intervalMinutes: clampWatchInterval(raw.watch.intervalMinutes),
    }
  }

  if (isRecord(raw.catalogue)) {
    const known = Array.isArray(raw.catalogue.knownRelicIds)
      ? raw.catalogue.knownRelicIds.filter(
          (id): id is string => typeof id === 'string'
        )
      : []
    const firstSeen = isRecord(raw.catalogue.firstSeen)
      ? raw.catalogue.firstSeen
      : {}

    file.catalogue = {
      knownRelicIds: known,
      firstSeen: Object.fromEntries(
        known.map((id) => [id, stringOrNull(firstSeen[id])])
      ),
    }
  }

  if (isRecord(raw.accounts)) {
    Object.entries(raw.accounts).forEach(([accountId, record]) => {
      const snapshot = isRecord(record) ? readSnapshot(record.snapshot) : null

      if (snapshot && isRecord(record) && typeof record.updatedAt === 'string') {
        file.accounts[accountId] = { updatedAt: record.updatedAt, snapshot }
      }
    })
  }

  if (Array.isArray(raw.events)) {
    file.events = raw.events
      .map(readEvent)
      .filter((event): event is SpriteEvent => event !== null)
      .slice(0, historyEventLimit)
  }

  return file
}
