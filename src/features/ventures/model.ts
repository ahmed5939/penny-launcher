import questRewards from '../../data/quest-rewards.json'

/**
 * Ventures, as the campaign profile tells it.
 *
 * Everything here is read straight off `campaign`: the season's XP is the
 * `AccountResource:phoenixxp` stack, the Ventures F.O.R.T. stats are the
 * `Stat:*_phoenix` items, and the seasonal quest chains are the
 * `Quest:adventure_seasonal_*` items with their `completion_*` counters.
 *
 * What the profile does NOT carry is the level curve. Epic keeps that in a
 * game DataTable, and the profile only reports the level when a stats
 * attribute happens to expose it. So `level` is nullable, and the zone
 * ladder below is the one thing we can state from XP alone.
 */

export type VentureQuestState = 'not-started' | 'active' | 'completed' | 'claimed'

export type VentureQuest = {
  templateId: string
  /** Chain name: destroy, locating, mission, monster, weapon. */
  chain: string
  /** 1-based position in the chain. */
  step: number
  state: VentureQuestState
  /** Ventures XP this quest pays, from the bundled reward table. */
  xp: number
  /** Raw `completion_*` counters; the renderer pairs them with objectives. */
  objectives: Array<{ backendName: string; completed: number }>
  lastChange: string | null
  itemId: string | null
}

export type VenturesProgress = {
  accountId: string
  fetchedAt: string
  /** Season Ventures XP. `null` when the profile has no phoenixxp stack. */
  xp: number | null
  /** Only when the profile states it; never derived. */
  level: number | null
  fort: { fortitude: number; offense: number; resistance: number; technology: number } | null
  quests: Array<VentureQuest>
}

/**
 * Zone unlocks by cumulative Ventures XP.
 *
 * Copied from the Penny database site's profile page, which sourced it from
 * player-collected level totals. Levels are the in-game Ventures level at
 * which each zone opens; `totalXp` is the season XP that level needs. This
 * is the only part of the level curve we hold, so it is the only level
 * information the tab states as fact.
 */
export const ventureZones: ReadonlyArray<{ level: number; powerLevel: number; totalXp: number }> = [
  { level: 7, powerLevel: 23, totalXp: 37_350 },
  { level: 11, powerLevel: 34, totalXp: 81_000 },
  { level: 16, powerLevel: 46, totalXp: 166_900 },
  { level: 20, powerLevel: 58, totalXp: 257_250 },
  { level: 23, powerLevel: 70, totalXp: 337_500 },
  { level: 28, powerLevel: 82, totalXp: 499_475 },
  { level: 31, powerLevel: 94, totalXp: 617_350 },
  { level: 36, powerLevel: 108, totalXp: 855_175 },
  { level: 39, powerLevel: 124, totalXp: 1_028_275 },
  { level: 43, powerLevel: 140, totalXp: 1_301_150 },
]

export const chainNames: Record<string, string> = {
  destroy: 'Destroy',
  locating: 'Locate',
  mission: 'Missions',
  monster: 'Monsters',
  weapon: 'Weapons',
}

const chainPattern = /^Quest:adventure_seasonal_([a-z]+)_(\d+)$/i

type RewardRow = { quantity: number; questTemplateId: string; templateId: string }

/** Every seasonal Ventures quest the bundled reward table knows, with its XP. */
export const seasonalQuests: ReadonlyArray<{ templateId: string; chain: string; step: number; xp: number }> = Object.entries(
  questRewards as Record<string, Array<RewardRow>>
)
  .flatMap(([templateId, rewards]) => {
    const match = chainPattern.exec(templateId)
    if (!match) return []
    const xp = rewards.find((r) => r.templateId.toLowerCase() === 'accountresource:phoenixxp_reward')?.quantity ?? 0
    return [{ templateId, chain: match[1].toLowerCase(), step: Number(match[2]), xp }]
  })
  .sort((a, b) => a.chain.localeCompare(b.chain) || a.step - b.step)

export function zonesUnlocked(xp: number | null) {
  if (xp === null) return null
  return ventureZones.filter((z) => xp >= z.totalXp).length
}

export function nextZone(xp: number | null) {
  if (xp === null) return null
  return ventureZones.find((z) => xp < z.totalXp) ?? null
}

/** The highest level the XP proves, from the ladder alone. */
export function levelFloor(xp: number | null) {
  if (xp === null) return null
  const reached = ventureZones.filter((z) => xp >= z.totalXp)
  return reached.length ? reached[reached.length - 1].level : xp > 0 ? 1 : 0
}

export function parseVenturesProfile(body: unknown, accountId: string): VenturesProgress {
  const root = (body ?? {}) as { profileChanges?: Array<{ profile?: { accountId?: string; profileId?: string; items?: Record<string, unknown>; stats?: { attributes?: Record<string, unknown> } } }> }
  const profile = root.profileChanges?.[0]?.profile
  if (!profile || profile.profileId !== 'campaign') throw new Error('Epic did not return the campaign profile.')
  if (profile.accountId && profile.accountId !== accountId) throw new Error('Epic returned a different account’s profile.')

  const items = Object.entries(profile.items ?? {}) as Array<[string, { templateId?: string; quantity?: number; attributes?: Record<string, unknown> }]>
  let xp: number | null = null
  const fort = { fortitude: 0, offense: 0, resistance: 0, technology: 0 }
  let sawFort = false
  const owned = new Map<string, { itemId: string; item: { attributes?: Record<string, unknown> } }>()

  for (const [itemId, item] of items) {
    const tid = (item.templateId ?? '').toLowerCase()
    if (tid === 'accountresource:phoenixxp') {
      xp = (xp ?? 0) + (typeof item.quantity === 'number' ? item.quantity : 0)
    } else if (tid.startsWith('stat:') && tid.endsWith('_phoenix')) {
      const key = tid.slice(5, -8) as keyof typeof fort
      if (key in fort) {
        fort[key] = typeof item.quantity === 'number' ? item.quantity : 0
        sawFort = true
      }
    } else if (chainPattern.test(item.templateId ?? '')) {
      owned.set((item.templateId ?? '').toLowerCase(), { itemId, item })
    }
  }

  const attributes = profile.stats?.attributes ?? {}
  const statedLevel = attributes.phoenix_level ?? attributes.ventures_level
  const level = typeof statedLevel === 'number' && Number.isFinite(statedLevel) ? statedLevel : null

  const quests: Array<VentureQuest> = seasonalQuests.map((known) => {
    const hit = owned.get(known.templateId.toLowerCase())
    const attrs = (hit?.item.attributes ?? {}) as Record<string, unknown>
    const raw = typeof attrs.quest_state === 'string' ? attrs.quest_state : hit ? 'Active' : null
    const state: VentureQuestState = raw === 'Claimed' ? 'claimed' : raw === 'Completed' ? 'completed' : raw ? 'active' : 'not-started'
    return {
      ...known,
      state,
      itemId: hit?.itemId ?? null,
      lastChange: typeof attrs.last_state_change_time === 'string' ? attrs.last_state_change_time : null,
      objectives: Object.entries(attrs)
        .filter(([key]) => key.startsWith('completion_'))
        .map(([key, value]) => ({ backendName: key.replace(/^completion_/, ''), completed: typeof value === 'number' ? value : 0 })),
    }
  })

  return { accountId, fetchedAt: new Date().toISOString(), xp, level, fort: sawFort ? fort : null, quests }
}
