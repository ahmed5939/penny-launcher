import type { CommanderFacts, StwLookup, StwShowcase } from './facts'

import { parseCommanderProfile } from '../commander-profile/model'
import { parseQuestHistory, stormShields } from '../quest-history/model'

/**
 * The Save the World half of the Rewind's facts, beyond the campaign's
 * counters: Power and the loadout through the Profile page's own parser,
 * the Storm Shields through the quest history's, and the mythics the
 * account owns. Kept apart from `./facts` so the renderer, which only needs
 * the types, does not carry the parsers.
 */

const mythicOrder = ['hero', 'schematic', 'worker', 'defender']

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function profileOf(reply: unknown) {
  const changes = record(reply)?.profileChanges

  return Array.isArray(changes) ? record(record(changes[0])?.profile) : null
}

function showcase(lookup: StwLookup, templateId: string, level: number): StwShowcase | null {
  const known = lookup(templateId)

  return known ? { templateId, ...known, name: known.name.trim(), level } : null
}

export function parseCommander(campaign: unknown, commonPublic: unknown, lookup: StwLookup | null): CommanderFacts | null {
  const profile = profileOf(campaign)
  const accountId = typeof profile?.accountId === 'string' ? profile.accountId : ''
  let entry: ReturnType<typeof parseCommanderProfile>

  try {
    entry = parseCommanderProfile(campaign, accountId, '')
  } catch {
    return null
  }

  const loadout = lookup
    ? [entry.commander, ...entry.support].flatMap((hero) => {
        const known = hero ? showcase(lookup, hero.templateId, hero.level) : null

        return known ? [known] : []
      })
    : []
  const mythics = new Map<string, { order: number; item: StwShowcase }>()

  if (lookup) {
    for (const item of Object.values(record(profile?.items) ?? {})) {
      const templateId = String(record(item)?.templateId ?? '')
      const order = mythicOrder.indexOf(templateId.split(':')[0].toLowerCase())

      if (order < 0) {
        continue
      }

      const level = Number(record(record(item)?.attributes)?.level) || 1
      const known = showcase(lookup, templateId, level)

      if (known?.rarity !== 'Mythic') {
        continue
      }

      /* Heroes come in a copy per tier; one of each name, at its best level. */
      const key = `${order}:${known.name}`
      const seen = mythics.get(key)

      if (!seen || level > seen.item.level) {
        mythics.set(key, { order, item: { ...known, image: known.image ?? seen?.item.image ?? null } })
      }
    }
  }

  const homebase = record(record(profileOf(commonPublic)?.stats)?.attributes)?.homebase_name

  return {
    power: entry.power?.value ?? null,
    loadout,
    collection: entry.counts,
    mythics: [...mythics.values()]
      .sort((a, b) => a.order - b.order || a.item.name.localeCompare(b.item.name))
      .map((mythic) => mythic.item),
    shields: stormShields(parseQuestHistory(campaign, accountId)).map((shield) => ({
      zone: shield.zone,
      completed: shield.completed,
      finishedAt: shield.levels[shield.levels.length - 1]?.doneAt ?? null,
    })),
    homebase: typeof homebase === 'string' && homebase.trim() ? homebase.trim() : null,
  }
}
