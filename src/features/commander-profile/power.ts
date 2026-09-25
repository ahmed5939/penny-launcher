import legacy from '../../data/stw-power/homebase-rating-legacy.json'
import ratings from '../../data/stw-power/ratings-v42.20.json'

import { squadAttributeStats, squadLeadJobs } from '../../config/constants/fortnite/squads'

/**
 * Save the World Power, the way PennyDB reports it: the pre-v39
 * `HomebaseRatingMapping.UIMonsterRating` curve over F.O.R.T. × 4, where
 * F.O.R.T. is the survivor squads plus legacy research — not the v39+
 * commander-level grants the profile's `Stat:*` items hold now. A maxed
 * account (squads 2,742–2,758, research 120) lands at 145.28, which is what
 * PennyDB shows for every such account whatever its heroes and weapons.
 *
 * Survivor ratings come from the game's own v42.20 `SurvivorItemRating`
 * (`src/data/stw-power/`, extracted from the installed client). Every curve
 * is piecewise linear with constant extrapolation at the ends.
 */

type Curve = ReadonlyArray<readonly [number, number]>

const legacyHomebaseCurve = legacy.homebaseRating as unknown as Curve
const survivorCurves = ratings.survivorItemRating as unknown as Record<string, Curve>

export function evalCurve(curve: Curve, x: number) {
  if (curve.length === 0) return 0
  if (x <= curve[0][0]) return curve[0][1]

  for (let index = 1; index < curve.length; index++) {
    const [x1, y1] = curve[index]

    if (x <= x1) {
      const [x0, y0] = curve[index - 1]

      return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0)
    }
  }

  return curve[curve.length - 1][1]
}

export type Fort = { fortitude: number; offense: number; resistance: number; technology: number }

/** F.O.R.T. a research stat at level 120 adds — fitted to PennyDB's maxed accounts. */
export const maxResearchFort = 764
export const maxResearchLevel = 120

export type ResearchLevels = Partial<Record<'fortitude' | 'offense' | 'resistance' | 'technology', number>>

/**
 * Research F.O.R.T. by stat. Exact at level 120 (and 0); in between it is
 * taken as linear, as the research curve is not in the extracted tables.
 */
export function researchFort(levels: ResearchLevels): Fort {
  const at = (level: number | undefined) =>
    (Math.min(maxResearchLevel, Math.max(0, level ?? 0)) / maxResearchLevel) * maxResearchFort

  return {
    fortitude: at(levels.fortitude),
    offense: at(levels.offense),
    resistance: at(levels.resistance),
    technology: at(levels.technology),
  }
}

/** Squad and research F.O.R.T. → Power. */
export function homebasePower(squads: Fort, research: Fort) {
  const total = (fort: Fort) => fort.fortitude + fort.offense + fort.resistance + fort.technology

  return evalCurve(legacyHomebaseCurve, 4 * (total(squads) + total(research)))
}

/** `workerbasic_sr_t05`, `managerdoctor_sr_kingsly_t05`, `worker_karolina_ur_t05` → curve inputs. */
export function parseSurvivorTemplate(templateId: string) {
  const fields = (templateId.split(':')[1] ?? '').toLowerCase().split('_')
  const kind = fields.shift() ?? ''
  const tier = Number.parseInt((fields.pop() ?? '').slice(1), 10)
  const lead = kind.includes('manager')
  const rarity = (lead ? fields.shift() : fields.pop()) ?? ''

  return Number.isFinite(tier) ? { lead, rarity, tier } : null
}

export function survivorRating(templateId: string, level: number) {
  const parsed = parseSurvivorTemplate(templateId)
  if (!parsed) return 0

  const curve = survivorCurves[`${parsed.lead ? 'manager' : 'default'}_${parsed.rarity}_t0${parsed.tier}`]

  return curve ? evalCurve(curve, level) : 0
}

/** Match bonus a support survivor gets from its lead, by the lead's rarity token. */
const personalityBonus: Record<string, number> = { c: 2, r: 4, sr: 8, uc: 3, vr: 5 }

export type SquadMember = {
  squadId: string
  slot: number
  templateId: string
  level: number
  personality: unknown
  synergy: unknown
}

/**
 * What the squads add to F.O.R.T.: every member's rating, a lead doubled when
 * its job matches the squad, a support raised by its lead's rarity when their
 * personalities match — and, under a Mythic (`sr`) lead, lowered by 2 when
 * they do not (never below its own rating of 2 or less).
 */
export function squadFort(members: ReadonlyArray<SquadMember>): Fort {
  const fort: Fort = { fortitude: 0, offense: 0, resistance: 0, technology: 0 }
  const bySquad = new Map<string, Array<SquadMember>>()

  members.forEach((member) => {
    const list = bySquad.get(member.squadId.toLowerCase()) ?? []
    list.push(member)
    bySquad.set(member.squadId.toLowerCase(), list)
  })

  bySquad.forEach((list, squadId) => {
    const attribute = squadId.split('_')[2] as keyof typeof squadAttributeStats
    const stat = squadAttributeStats[attribute]
    if (!stat) return

    const job = Object.entries(squadLeadJobs).find(([id]) => id.toLowerCase() === squadId)?.[1]
    const lead = list.find((member) => member.slot === 0)
    const leadInfo = lead ? parseSurvivorTemplate(lead.templateId) : null

    list.forEach((member) => {
      const rating = survivorRating(member.templateId, member.level)
      let total = rating

      if (member === lead) {
        if (job && typeof member.synergy === 'string' && member.synergy.split('.').pop() === job) total += rating
      } else if (lead && leadInfo?.lead) {
        if (member.personality && member.personality === lead.personality) {
          total += personalityBonus[leadInfo.rarity] ?? 0
        } else if (leadInfo.rarity === 'sr' && rating > 2) {
          total -= 2
        }
      }

      fort[stat] += total
    })
  })

  return fort
}
