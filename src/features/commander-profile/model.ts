import type { ResearchLevels, SquadMember } from './power'

import { parseVenturesProfile, ventureZones, zonesUnlocked } from '../ventures/model'
import { homebasePower, maxResearchLevel, researchFort, squadFort } from './power'

import {
  squadAttributeStats,
  squadLeadJobs,
  survivorSquads,
} from '../../config/constants/fortnite/squads'

/**
 * The commander profile, read from the account's own Epic campaign profile.
 *
 * Levels and counters are profile attributes, resources and llamas are
 * profile items; nothing is fetched from a tracker. F.O.R.T. is the profile's
 * `Stat:*` items — which hold only the commander-level grants — plus the
 * survivor squads' share, computed from the survivors (`squadFort`) with the
 * game's own rating tables. Power is squads plus research, see `./power`.
 */

export type ProfileFort = {
  fortitude: number
  offense: number
  resistance: number
  technology: number
}

/** A hero, as ids — the renderer names and draws it from the item database. */
export type ProfileHero = {
  templateId: string
  level: number
  tier: number
}

export type ProfileStack = {
  templateId: string
  quantity: number
}

export type ProfileSquadSummary = {
  id: string
  label: string
  attribute: keyof typeof squadAttributeStats
  filled: number
  /** Lead in the squad whose job doubles their power. */
  leadMatches: boolean
  /** Support survivors whose personality matches the lead's. */
  personalityMatches: number
}

export type ProfileSetBonus = {
  name: string
  /** Survivors carrying it across all squads. */
  matched: number
  /** How many times it is switched on, squad by squad. */
  active: number
  totalPct: number
}

export type ProfileEntry = {
  accountId: string
  displayName: string
  errorMessage?: string

  commanderLevel: number
  /** Levels claimed past the commander cap. */
  postMaxLevels: number
  collectionBookLevel: number
  daysLoggedIn: number
  matchesPlayed: number

  /** Total F.O.R.T.: commander-level grants plus survivor squads. Null when the profile holds neither. */
  fort: ProfileFort | null
  /**
   * Power from squads and research, as PennyDB reports it. `approximate` when
   * research is part-way, where research F.O.R.T. is interpolated.
   */
  power: { value: number; approximate: boolean } | null

  ventures: { xp: number | null; zonesUnlocked: number | null; zones: number } | null

  counts: {
    defenders: number
    heroes: number
    schematics: number
    survivors: number
  }

  /** The equipped loadout. */
  commander: ProfileHero | null
  support: Array<ProfileHero>

  squads: Array<ProfileSquadSummary>
  setBonuses: Array<ProfileSetBonus>

  llamas: Array<ProfileStack>
  resources: Array<ProfileStack>

  pending: {
    difficultyIncreaseRewards: number
    missionAlertRewards: number
  }
}

export type ProfilePayload = Record<string, ProfileEntry>

/**
 * Set bonus sizes and per-activation value. Trap Durability, Health, Shield
 * and Shield Regeneration are two-piece sets; the damage sets need three.
 */
export const setBonusRules: Record<string, { need: number; pct: number }> = {
  'Ability Damage': { need: 3, pct: 5 },
  Health: { need: 2, pct: 5 },
  'Melee Damage': { need: 3, pct: 5 },
  'Ranged Damage': { need: 3, pct: 5 },
  Shield: { need: 2, pct: 5 },
  'Shield Regeneration': { need: 2, pct: 5 },
  'Trap Damage': { need: 3, pct: 5 },
  'Trap Durability': { need: 2, pct: 8 },
}

/** `Homebase.Worker.SetBonus.IsTrapDurabilityHigh` → "Trap Durability". */
export function setBonusName(raw: unknown) {
  if (typeof raw !== 'string') return null

  const leaf = raw.split('.').pop() ?? ''

  if (/TrapDurability/i.test(leaf)) return 'Trap Durability'
  if (/TrapDamage/i.test(leaf)) return 'Trap Damage'
  if (/ShieldRegen/i.test(leaf)) return 'Shield Regeneration'
  if (/Resistance|Shield/i.test(leaf)) return 'Shield'
  if (/Fortitude|Health/i.test(leaf)) return 'Health'
  if (/Melee/i.test(leaf)) return 'Melee Damage'
  if (/Ranged/i.test(leaf)) return 'Ranged Damage'
  if (/Ability/i.test(leaf)) return 'Ability Damage'

  return null
}

type RawItem = { templateId?: string; quantity?: number; attributes?: Record<string, unknown> }

const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

function tierOf(templateId: string) {
  const match = /_t(\d+)/.exec(templateId.toLowerCase())

  return match ? Number(match[1]) : 0
}

export function parseCommanderProfile(body: unknown, accountId: string, displayName: string): ProfileEntry {
  const root = (body ?? {}) as {
    profileChanges?: Array<{ profile?: { accountId?: string; profileId?: string; items?: Record<string, RawItem>; stats?: { attributes?: Record<string, unknown> } } }>
  }
  const profile = root.profileChanges?.[0]?.profile

  if (!profile || profile.profileId !== 'campaign') throw new Error('Epic did not return the campaign profile.')
  if (profile.accountId && profile.accountId !== accountId) throw new Error('Epic returned a different account’s profile.')

  const items = profile.items ?? {}
  const attributes = (profile.stats?.attributes ?? {}) as Record<string, unknown>
  const book = (attributes.collection_book ?? {}) as Record<string, unknown>
  const daily = (attributes.daily_rewards ?? {}) as Record<string, unknown>
  const difficulty = (attributes.difficulty_increase_rewards_record ?? {}) as { pendingRewards?: Array<unknown> }
  const alerts = (attributes.mission_alert_redemption_record ?? {}) as { pendingMissionAlertRewards?: { items?: Array<unknown> } }

  const fort: ProfileFort = { fortitude: 0, offense: 0, resistance: 0, technology: 0 }
  let sawFort = false
  const counts = { defenders: 0, heroes: 0, schematics: 0, survivors: 0 }
  const resources = new Map<string, number>()
  const llamas = new Map<string, number>()

  type Member = { slot: number; templateId: string; personality: unknown; setBonus: unknown; synergy: unknown }
  const squadMembers = new Map<string, Array<Member>>()
  const powerMembers: Array<SquadMember> = []

  for (const item of Object.values(items)) {
    const templateId = item.templateId ?? ''
    const lower = templateId.toLowerCase()
    const itemAttributes = item.attributes ?? {}

    if (lower.startsWith('stat:')) {
      /* `Stat:fortitude_phoenix` and the like are Ventures stats — not campaign F.O.R.T. */
      const key = lower.slice(5) as keyof ProfileFort
      if (key in fort) {
        fort[key] += number(item.quantity)
        sawFort = true
      }
    } else if (lower.startsWith('worker:')) {
      counts.survivors += 1
      const squad = typeof itemAttributes.squad_id === 'string' ? itemAttributes.squad_id.toLowerCase() : ''
      if (squad) {
        powerMembers.push({
          level: number(itemAttributes.level) || 1,
          personality: itemAttributes.personality,
          slot: number(itemAttributes.squad_slot_idx),
          squadId: squad,
          synergy: itemAttributes.managerSynergy,
          templateId,
        })
        const members = squadMembers.get(squad) ?? []
        members.push({
          slot: number(itemAttributes.squad_slot_idx),
          templateId,
          personality: itemAttributes.personality,
          setBonus: itemAttributes.set_bonus,
          synergy: itemAttributes.managerSynergy,
        })
        squadMembers.set(squad, members)
      }
    } else if (lower.startsWith('hero:')) {
      counts.heroes += 1
    } else if (lower.startsWith('defender:')) {
      counts.defenders += 1
    } else if (lower.startsWith('schematic:')) {
      counts.schematics += 1
    } else if (lower.startsWith('accountresource:') && number(item.quantity) > 0) {
      resources.set(templateId, (resources.get(templateId) ?? 0) + number(item.quantity))
    } else if (lower.startsWith('cardpack:') && number(item.quantity) > 0) {
      llamas.set(templateId, (llamas.get(templateId) ?? 0) + number(item.quantity))
    }
  }

  const setTotals = new Map<string, ProfileSetBonus>()
  const squads = survivorSquads.map((squad): ProfileSquadSummary => {
    const members = squadMembers.get(squad.id.toLowerCase()) ?? []
    const lead = members.find((member) => member.slot === 0)
    const supports = members.filter((member) => member.slot !== 0)
    const perSquad = new Map<string, number>()

    supports.forEach((member) => {
      const name = setBonusName(member.setBonus)
      if (name) perSquad.set(name, (perSquad.get(name) ?? 0) + 1)
    })
    perSquad.forEach((count, name) => {
      const rule = setBonusRules[name]
      const total = setTotals.get(name) ?? { active: 0, matched: 0, name, totalPct: 0 }
      const active = Math.floor(count / rule.need)

      total.matched += count
      total.active += active
      total.totalPct += active * rule.pct
      setTotals.set(name, total)
    })

    const job = squadLeadJobs[squad.id]

    return {
      attribute: squad.attribute,
      filled: members.length,
      id: squad.id,
      label: squad.label,
      leadMatches: Boolean(lead && typeof lead.synergy === 'string' && job && lead.synergy.endsWith(job)),
      personalityMatches: lead
        ? supports.filter((member) => member.personality && member.personality === lead.personality).length
        : 0,
    }
  })

  const heroAt = (itemId: unknown): ProfileHero | null => {
    const hero = typeof itemId === 'string' ? items[itemId] : undefined
    if (!hero?.templateId?.toLowerCase().startsWith('hero:')) return null

    return { level: number(hero.attributes?.level) || 1, templateId: hero.templateId, tier: tierOf(hero.templateId) }
  }
  const selected = attributes.selected_hero_loadout
  const loadout = (typeof selected === 'string' ? items[selected] : undefined) ??
    Object.values(items).find((item) => item.templateId?.startsWith('CampaignHeroLoadout:'))
  const crew = (loadout?.attributes?.crew_members ?? {}) as Record<string, unknown>

  const squadStats = squadFort(powerMembers)
  const hasFort = sawFort || powerMembers.length > 0
  const totalFort: ProfileFort | null = hasFort
    ? {
        fortitude: fort.fortitude + squadStats.fortitude,
        offense: fort.offense + squadStats.offense,
        resistance: fort.resistance + squadStats.resistance,
        technology: fort.technology + squadStats.technology,
      }
    : null
  const commanderHero = heroAt(crew.commanderslot)
  const supportHeroes = [1, 2, 3, 4, 5].flatMap((slot) => {
    const hero = heroAt(crew[`followerslot${slot}`])
    return hero ? [hero] : []
  })
  const researchLevels = (attributes.research_levels ?? {}) as ResearchLevels
  const research = Object.values(researchLevels)
  const power = hasFort
    ? {
        approximate: research.some((level) => number(level) > 0 && number(level) < maxResearchLevel),
        value: homebasePower(squadStats, researchFort(researchLevels)),
      }
    : null

  let ventures: ProfileEntry['ventures'] = null
  try {
    const progress = parseVenturesProfile(body, accountId)
    ventures = { xp: progress.xp, zones: ventureZones.length, zonesUnlocked: zonesUnlocked(progress.xp) }
  } catch {
    ventures = null
  }

  const byQuantity = (map: Map<string, number>) =>
    [...map].map(([templateId, quantity]) => ({ quantity, templateId })).sort((a, b) => b.quantity - a.quantity)

  return {
    accountId,
    collectionBookLevel: number(book.maxBookXpLevelAchieved),
    commander: commanderHero,
    commanderLevel: number(attributes.level),
    counts,
    daysLoggedIn: number(daily.totalDaysLoggedIn),
    displayName,
    fort: totalFort,
    llamas: byQuantity(llamas),
    matchesPlayed: number(attributes.matches_played),
    pending: {
      difficultyIncreaseRewards: difficulty.pendingRewards?.length ?? 0,
      missionAlertRewards: alerts.pendingMissionAlertRewards?.items?.length ?? 0,
    },
    postMaxLevels: number(attributes.rewards_claimed_post_max_level),
    power,
    resources: byQuantity(resources),
    setBonuses: [...setTotals.values()].sort((a, b) => b.totalPct - a.totalPct),
    squads,
    support: supportHeroes,
    ventures,
  }
}
