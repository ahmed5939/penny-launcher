import type { ExpeditionSlot } from '../../../kernel/core/expeditions'
import type { TimelineSeason } from '../../../kernel/core/timeline'
import type { RewardEvent } from '../../../features/automation-rewards/model'

/**
 * Pure helpers behind the home dashboard. Kept apart from the hooks so the
 * arithmetic that decides what a tile says can be tested without Electron.
 */

const day = 86_400_000
const week = 7 * day

/** Save the World dailies, the item shop and free llamas roll at 00:00 UTC. */
export function msUntilDailyReset(now: number) {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return next.getTime() - now
}

/** "2d 4h", "5h 12m", "12m", "under a minute". */
export function formatCountdown(ms: number) {
  if (ms <= 0) return 'now'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${rest}m`
  return `${rest}m`
}

/**
 * The item database files dailies under `DailyQuests`. Without the database
 * (still downloading) the template id is the only clue, and every daily's
 * id starts `Quest:Daily_`.
 */
export function isDailyQuest(templateId: string, category: string | null | undefined) {
  if (category) return category === 'DailyQuests'
  return /^quest:daily_/i.test(templateId)
}

export type ExpeditionSummary = {
  available: number
  inFlight: number
  ready: number
  /** The running expedition that returns first, if any. */
  nextReturn: ExpeditionSlot | null
}

export function summariseExpeditions(slots: ReadonlyArray<ExpeditionSlot>): ExpeditionSummary {
  let nextReturn: ExpeditionSlot | null = null
  const summary = { available: 0, inFlight: 0, ready: 0 }

  for (const slot of slots) {
    if (slot.state === 'ready') summary.ready += 1
    else if (slot.state === 'available') summary.available += 1
    else {
      summary.inFlight += 1
      if (slot.endTime && (!nextReturn?.endTime || Date.parse(slot.endTime) < Date.parse(nextReturn.endTime))) {
        nextReturn = slot
      }
    }
  }

  return { ...summary, nextReturn }
}

export type SeasonClock = {
  /** 1-based; clamped to the season's length. */
  week: number
  weeks: number
  endsInMs: number
  /** What this week's event shop stocks, when the feed says. */
  shop: ReadonlyArray<string>
}

export function seasonClock(season: TimelineSeason, now: number): SeasonClock {
  const start = Date.parse(season.startsAt)
  const end = Date.parse(season.endsAt)
  const weeks = Math.max(1, season.duration)
  const index = Math.min(weeks - 1, Math.max(0, Math.floor((now - start) / week)))

  return {
    week: index + 1,
    weeks,
    endsInMs: Math.max(0, end - now),
    shop: season.eventShop[index] ?? [],
  }
}

/** Questlines and events that run during the given 1-based week. */
export function activeThisWeek<T extends { startWeek: number | null; endWeek: number | null }>(entries: ReadonlyArray<T>, currentWeek: number) {
  return entries.filter((entry) => (entry.startWeek ?? 1) <= currentWeek && (entry.endWeek ?? Infinity) >= currentWeek)
}

export type RewardDigest = {
  events: Array<RewardEvent>
  received: number
  recycled: number
  failed: number
}

/** Automation reward events inside the window, newest first, with item totals. */
export function digestRewardEvents(events: ReadonlyArray<RewardEvent>, now: number, windowMs = day): RewardDigest {
  const since = now - windowMs
  const recent = events.filter((event) => Date.parse(event.timestamp) >= since).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  const count = (rewards: RewardEvent['received']) => rewards.reduce((n, reward) => n + reward.quantity, 0)

  return {
    events: recent,
    received: recent.reduce((n, event) => n + count(event.received), 0),
    recycled: recent.reduce((n, event) => n + count(event.recycled), 0),
    failed: recent.filter((event) => event.status === 'error').length,
  }
}
