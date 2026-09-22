import supportingData from './expedition-data.json'
import powerData from './hero-power.json'

export type Item = { templateId: string; quantity?: number; favorite?: unknown; attributes?: Record<string, unknown> }
export type Items = Record<string, Item>
export type Reward = { templateId: string; quantity: number; itemId?: string }
export const rewardTypes = ['Survivors', 'Heroes', 'Traps', 'Weapons', 'Materials']
const kinds: Array<[string, string, string]> = [
  ['survivorscouting', 'Survivor Scouting', 'Survivors'],
  ['managers', 'Lead Survivors', 'Survivors'],
  ['peoplerun', 'People Run', 'Survivors'],
  ['heroes', 'Heroes', 'Heroes'], ['traprun', 'Trap Run', 'Traps'],
  ['traps', 'Traps', 'Traps'], ['weapons', 'Weapons', 'Weapons'],
  ['supplyrun', 'Supply Run', 'Materials'], ['craftingrun', 'Crafting Run', 'Materials'],
  ['resourcerun', 'Building Resources', 'Materials'],
  ['miningore', 'Ore Mining', 'Materials'], ['choppingwood', 'Wood Gathering', 'Materials'],
]
export function expeditionKind(id: string) {
  const match = kinds.find(([fragment]) => id.toLowerCase().includes(fragment))
  return { name: match?.[1] ?? 'Unknown expedition', category: match?.[2] ?? '' }
}
export function metadata(id: string) {
  return (supportingData.attributes as Record<string, Record<string, number>>)[id] ?? {}
}
export function confirmedRewards(value: unknown): Reward[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const templateId = raw.itemType ?? raw.templateId ?? raw.item_type
    const quantity = Number(raw.quantity ?? raw.count ?? 1)
    const itemId = raw.itemGuid ?? raw.item_guid
    return typeof templateId === 'string' && Number.isFinite(quantity) && quantity > 0
      ? [{ templateId, quantity, ...(typeof itemId === 'string' ? { itemId } : {}) }] : []
  })
}
export function protectedIds(items: Items) {
  const ids = new Set<string>()
  for (const item of Object.values(items)) {
    const a = item.attributes ?? {}
    if (a.loadout_index != null || item.templateId.includes('CampaignHeroLoadout')) {
      if (a.crew_members && typeof a.crew_members === 'object') {
        Object.values(a.crew_members).forEach((id) => { if (typeof id === 'string') ids.add(id) })
      }
    }
  }
  return ids
}
export function recyclableRewards(rewards: Reward[], before: Items, items: Items, threshold: string): Reward[] {
  const limit = ({ Common: 1, Uncommon: 2, Rare: 3, Epic: 4 } as Record<string, number>)[threshold]
  const protectedHeroes = protectedIds(items)
  const seen = new Set<string>()
  return rewards.filter((reward) => {
    const id = reward.itemId
    if (!limit || !id || before[id] || seen.has(id)) return false
    seen.add(id)
    const item = items[id]
    if (!item || item.templateId !== reward.templateId || !/^(Hero|Schematic|Worker|Defender):/i.test(item.templateId)) return false
    const rarity = /_(c|uc|r|vr|sr|ur)_/i.exec(item.templateId)?.[1]?.toLowerCase()
    const rank = ({ c: 1, uc: 2, r: 3, vr: 4, sr: 5, ur: 6 } as Record<string, number>)[rarity ?? '']
    const a = item.attributes ?? {}
    return !!rank && rank <= limit && !item.favorite && !a.favorite && !a.is_favorite && !a.squad_id && a.loadout_index == null &&
      !(typeof a.squad_slot_idx === 'number' && a.squad_slot_idx >= 0) &&
      !(Number(a.building_slot_used) > 0) && !protectedHeroes.has(id) &&
      Number(item.quantity ?? 1) === reward.quantity
  })
}
export function resourceGains(before: Items, after: Items): Reward[] {
  const balances = (items: Items) => {
    const result: Record<string, number> = {}
    Object.values(items).forEach((item) => {
      if (/^(AccountResource|Ingredient):/i.test(item.templateId)) {
        result[item.templateId] = (result[item.templateId] ?? 0) + Number(item.quantity ?? 0)
      }
    })
    return result
  }
  const initial = balances(before)
  return Object.entries(balances(after)).flatMap(([templateId, quantity]) =>
    quantity > (initial[templateId] ?? 0) ? [{ templateId, quantity: quantity - (initial[templateId] ?? 0) }] : [])
}

const vehicles = [
  ['dirtbike', 'One', 'Land', 3], ['truck', 'Two', 'Land', 5],
  ['rowboat', 'Three', 'Sea', 4], ['speedboat', 'Four', 'Sea', 5],
  ['propplane', 'Five', 'Air', 3], ['helicopter', 'Six', 'Air', 4],
] as const
type Hero = { id: string; power: number; rarity: string; kind: string }
type Requirement = { ModValue: number; requirements: { class?: string; rarity?: string[] } }
const requirements = supportingData.criteriaRequirements as Record<string, Requirement>

export function selectTeam(items: Items, templateId: string, attributes: Record<string, unknown>) {
  const slot = String(attributes.expedition_slot_id ?? '').toLowerCase()
  const vehicle = /\.(air|sea|land)\./.exec(slot)?.[1] ?? (templateId.includes('_air_') ? 'air' : templateId.includes('_sea_') ? 'sea' : 'land')
  const occupied = new Set(Object.values(items).filter((i) => i.templateId.startsWith('Expedition:') && i.attributes?.expedition_end_time).map((i) => String(i.attributes?.expedition_squad_id).toLowerCase()))
  const candidates = vehicles.map(([name, suffix, mode, capacity]) => {
    let unlocked = 0
    Object.values(items).forEach((i) => {
      const prefix = `homebasenode:questreward_expedition_${name}`
      if (i.templateId.toLowerCase().startsWith(prefix)) unlocked = Math.max(unlocked, Number(/(\d+)$/.exec(i.templateId)?.[1] ?? capacity))
    })
    return { squadId: `Squad_Expedition_ExpeditionSquad${suffix}`, slots: Math.min(capacity, unlocked), mode }
  }).filter((v) => v.mode.toLowerCase() === vehicle && v.slots > 0 && !occupied.has(v.squadId.toLowerCase())).sort((a, b) => b.slots - a.slots)
  const protectedHeroes = protectedIds(items)
  const heroes: Hero[] = Object.entries(items).flatMap(([id, item]) => {
    const a = item.attributes ?? {}
    if (!item.templateId.startsWith('Hero:') || protectedHeroes.has(id) || a.squad_id || Number(a.building_slot_used) > 0) return []
    const match = /_(c|uc|r|vr|sr|ur)_t(\d+)/i.exec(item.templateId)
    if (!match) return []
    const power = (powerData as Record<string, Record<string, number>>)[`_${match[1].toLowerCase()}_t${match[2].padStart(2, '0')}`]?.[String(a.level ?? 1)] ?? 0
    const kind = /hid_(ninja|outlander|constructor|commando)/i.exec(item.templateId)?.[1]?.toLowerCase() ?? ''
    return power > 0 ? [{ id, power, rarity: match[1].toLowerCase(), kind }] : []
  }).sort((a, b) => b.power - a.power).slice(0, 12)
  const raw = attributes.expedition_criteria ?? []
  const criteria = Array.isArray(raw) ? raw : (raw as { RequiredTags?: unknown[] }).RequiredTags ?? []
  const specs = criteria.map((c) => requirements[String(c)])
  const target = Number(attributes.expedition_target_power ?? attributes.expedition_max_target_power ?? metadata(templateId).expedition_max_target_power ?? 0)
  const empty = { heroIds: [] as string[], power: 0, squadId: null as string | null, vehicle: vehicle[0].toUpperCase() + vehicle.slice(1), target }
  if (specs.some((s) => !s) || !Number.isFinite(target) || target <= 0) return empty
  let best: { heroIds: string[]; power: number; squadId: string } | undefined
  const scoreBetter = (power: number, count: number) => !best || Math.min(power, target) > Math.min(best.power, target) ||
    (Math.min(power, target) === Math.min(best.power, target) && (count < best.heroIds.length || (count === best.heroIds.length && power < best.power)))
  for (const v of candidates) {
    const evaluate = (team: Hero[]) => {
      // Assign distinct heroes to special slots; backtracking avoids a broad
      // requirement consuming the only hero satisfying a narrower requirement.
      const assign = (index: number, remaining: Hero[], ordered: Hero[], bonus: number) => {
        if (index === specs.length) {
          const power = Math.floor(team.reduce((n, h) => n + h.power, 0) + bonus)
          if (power >= Math.ceil(target * 0.8) && scoreBetter(power, team.length)) best = { heroIds: [...ordered, ...remaining].map((h) => h.id), power, squadId: v.squadId }
          return
        }
        const spec = specs[index]
        remaining.forEach((h, i) => {
          if ((!spec.requirements.class || h.kind === spec.requirements.class) && (!spec.requirements.rarity || spec.requirements.rarity.includes(h.rarity))) {
            assign(index + 1, remaining.filter((_, j) => i !== j), [...ordered, h], bonus + h.power * (spec.ModValue - 1))
          }
        })
      }
      assign(0, team, [], 0)
    }
    const visit = (start: number, team: Hero[]) => {
      if (team.length >= Math.max(1, specs.length)) evaluate(team)
      if (team.length >= v.slots) return
      for (let i = start; i < heroes.length; i++) visit(i + 1, [...team, heroes[i]])
    }
    visit(0, [])
  }
  return { ...empty, ...best }
}
