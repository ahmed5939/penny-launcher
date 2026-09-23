import zoneQuests from './zone-quests.json'

/**
 * Quest history, as the PennyDB profile's History tab showed it: Storm Shield
 * Defences per zone, each zone's questline grouped under the SSD it leads up
 * to, and the account's recent quest activity.
 *
 * Everything comes from the `campaign` profile. A quest item that is Claimed
 * or Completed is done, and its `last_state_change_time` is when — the same
 * rule the outpost screen uses for defence history.
 */

export const zones = ['Stonewood', 'Plankerton', 'Canny Valley', 'Twine Peaks'] as const
export type Zone = (typeof zones)[number]

/** `Quest:outpostquest_t3_l7` is Canny Valley, defence 7. */
const ssdPattern = /^Quest:outpostquest_t([1-4])_l(\d+)$/i
export const ssdLevels = 10

export type HistoryQuest = {
  templateId: string
  state: 'active' | 'completed' | 'claimed'
  /** ISO time of the last state change; for done quests, when it was done. */
  changedAt: string | null
}

export type QuestHistory = {
  accountId: string
  fetchedAt: string
  quests: Array<HistoryQuest>
}

export function parseQuestHistory(body: unknown, accountId: string): QuestHistory {
  const root = (body ?? {}) as { profileChanges?: Array<{ profile?: { accountId?: string; profileId?: string; items?: Record<string, { templateId?: string; attributes?: Record<string, unknown> }> } }> }
  const profile = root.profileChanges?.[0]?.profile
  if (!profile || profile.profileId !== 'campaign') throw new Error('Epic did not return the campaign profile.')
  if (profile.accountId && profile.accountId !== accountId) throw new Error('Epic returned a different account’s profile.')

  const quests: Array<HistoryQuest> = []
  for (const item of Object.values(profile.items ?? {})) {
    const templateId = item.templateId ?? ''
    if (!templateId.toLowerCase().startsWith('quest:')) continue
    const attributes = item.attributes ?? {}
    const raw = attributes.quest_state
    const state = raw === 'Claimed' ? 'claimed' : raw === 'Completed' ? 'completed' : 'active'
    const changedAt = typeof attributes.last_state_change_time === 'string' ? attributes.last_state_change_time : null
    quests.push({ templateId, state, changedAt })
  }
  return { accountId, fetchedAt: new Date().toISOString(), quests }
}

const isDone = (quest: HistoryQuest) => quest.state !== 'active'

/** Earliest valid date, so a re-granted quest keeps the day it was first done. */
function earliest(a: string | null, b: string | null) {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) <= Date.parse(b) ? a : b
}

export type StormShield = {
  zone: Zone
  /** Index 0 is SSD 1. `null` when that defence is not done. */
  levels: Array<{ level: number; doneAt: string | null; done: boolean }>
  completed: number
}

export function stormShields(history: QuestHistory): Array<StormShield> {
  const done = new Map<string, string | null>()
  for (const quest of history.quests) {
    const match = ssdPattern.exec(quest.templateId)
    if (!match || !isDone(quest)) continue
    const key = `${match[1]}:${Number(match[2])}`
    done.set(key, done.has(key) ? earliest(done.get(key) ?? null, quest.changedAt) : quest.changedAt)
  }
  return zones.map((zone, index) => {
    const levels = Array.from({ length: ssdLevels }, (_, i) => {
      const key = `${index + 1}:${i + 1}`
      return { level: i + 1, done: done.has(key), doneAt: done.get(key) ?? null }
    })
    return { zone, levels, completed: levels.filter((l) => l.done).length }
  })
}

/**
 * Quests added to a zone long after launch. Veterans finished them years
 * after the rest of the questline, so they would stretch the zone's date
 * range into nonsense; PennyDB leaves them out of it for the same reason.
 */
const lateAdditions = new Set(['Stand and Fight'])

export type ZoneQuestLevel = {
  level: number
  /** The SSD itself. */
  defence: { done: boolean; doneAt: string | null }
  quests: Array<{ name: string; done: boolean; doneAt: string | null }>
}

export type ZoneProgress = {
  zone: Zone
  levels: Array<ZoneQuestLevel>
  questsDone: number
  questsTotal: number
  firstAt: string | null
  lastAt: string | null
}

/**
 * The zone questline, grouped by the SSD it leads to. The grouping is
 * PennyDB's hand-kept list of quest names; names come from the item
 * database, so `nameOf` turns a template id into the name that list uses.
 * A quest the database cannot name simply never matches — it is counted as
 * not done rather than guessed.
 */
export function zoneProgress(history: QuestHistory, nameOf: (templateId: string) => string | null | undefined): Array<ZoneProgress> {
  const doneByName = new Map<string, string | null>()
  for (const quest of history.quests) {
    if (!isDone(quest)) continue
    const name = nameOf(quest.templateId)
    if (!name) continue
    doneByName.set(name, doneByName.has(name) ? earliest(doneByName.get(name) ?? null, quest.changedAt) : quest.changedAt)
  }
  const shields = stormShields(history)
  const mapping = zoneQuests as Record<Zone, Record<string, Array<string>>>

  return zones.map((zone, index) => {
    const levels: Array<ZoneQuestLevel> = []
    for (let level = 1; level <= ssdLevels; level++) {
      const names = mapping[zone]?.[String(level)] ?? []
      const defence = shields[index].levels[level - 1]
      levels.push({
        level,
        defence: { done: defence.done, doneAt: defence.doneAt },
        quests: names.map((name) => ({ name, done: doneByName.has(name), doneAt: doneByName.get(name) ?? null })),
      })
    }
    const all = levels.flatMap((l) => l.quests)
    const dates = [
      ...all.filter((q) => !lateAdditions.has(q.name)).map((q) => q.doneAt),
      ...levels.map((l) => l.defence.doneAt),
    ].filter((d): d is string => Boolean(d)).sort()
    return {
      zone,
      levels,
      questsDone: all.filter((q) => q.done).length,
      questsTotal: all.length,
      firstAt: dates[0] ?? null,
      lastAt: dates[dates.length - 1] ?? null,
    }
  })
}

/** Done quests, newest first, for the activity list. */
export function recentActivity(history: QuestHistory) {
  return history.quests
    .filter((q) => isDone(q) && q.changedAt)
    .sort((a, b) => Date.parse(b.changedAt!) - Date.parse(a.changedAt!))
}
