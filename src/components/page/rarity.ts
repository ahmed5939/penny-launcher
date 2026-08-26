import type { CSSProperties } from 'react'
import type { ParseResourceData } from '../../types/data/resources'

import {
  rarities,
  raritiesColor,
  RarityType,
} from '../../config/constants/resources'
import { parseResource } from '../../lib/parsers/resources'

/**
 * The least a screen has to know about a thing to draw it as a reward. Every
 * shape the app already holds items in — world-info rewards, MCP loot, an
 * item-database row — either is this or trivially widens to it.
 */
export type RewardLike = {
  imageUrl: string
  itemId: string
  isBad?: boolean
  key?: string
  quantity: number
  rarity?: RarityType | string | null
  type?: string | null
}

/**
 * Memoised `parseResource`. It linearly scans four JSON blobs with
 * `key.includes(id)`, and a 40-row page asks for the same handful of ids over
 * and over, so the cache is what keeps a re-render cheap.
 *
 * Keyed on `itemId` ALONE — never read `.quantity` off the result, it belongs
 * to whichever caller got here first.
 *
 * `context: 'world-info'` is deliberately NOT passed. Every `itemId` reaching
 * this function already came out of `parseResource` upstream (world-info
 * stores `parsedResource.itemType`), and that context flag promotes a lead
 * survivor's rarity one step and rewrites the id to match. Re-parsing an
 * already-promoted id with the flag set promotes it a second time — a
 * Legendary lead would read "Mythic", and a Mythic one would fall off the end
 * of the conversion map and read "undefined Lead Survivor".
 */
const metaCache = new Map<string, ParseResourceData>()

export function rewardMeta(itemId: string, quantity: number) {
  const cached = metaCache.get(itemId)

  if (cached) {
    return cached
  }

  const parsed = parseResource({
    key: itemId,
    quantity,
  })

  metaCache.set(itemId, parsed)

  return parsed
}

/**
 * Rarity is a real property of graded item classes only. A resource is not
 * "Common" — it has no rarity at all, and `parseRarity` falling through to
 * Common for every unsuffixed id is what used to label 200 Nuts & Bolts.
 */
export const gradedTypes = new Set([
  'defender',
  'hero',
  'melee',
  'ranged',
  'trap',
  'worker',
])

/**
 * The restraint ladder. Common and Uncommon deliberately have no entry: junk
 * renders in the neutral border token with no rarity word, so the only colour
 * on a page of rewards is the stuff worth having. It also keeps Uncommon's
 * green off a row whose zone rail is Stonewood green.
 */
export const accentByRarity: Partial<Record<RarityType, string>> = {
  [RarityType.Rare]: raritiesColor[RarityType.Rare],
  [RarityType.Epic]: raritiesColor[RarityType.Epic],
  [RarityType.Legendary]: raritiesColor[RarityType.Legendary],
  [RarityType.Mythic]: raritiesColor[RarityType.Mythic],
}

/**
 * A name `parseResource` never actually resolved. Its fall-through returns the
 * id itself (or the id's `Type:` prefix), so those must be slugged rather than
 * printed into the payload bay as `eventcurrency_founders`. A real name is
 * capitalised and carries no underscore.
 */
function isUnresolvedName(name: string) {
  return name === '' || name.includes('_') || name === name.toLowerCase()
}

function slugToName(itemId: string) {
  return (
    itemId
      .split(':')
      .at(-1)
      ?.replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? itemId
  )
}

export function rewardGrade(reward: RewardLike) {
  const meta = reward.itemId
    ? rewardMeta(reward.itemId, reward.quantity)
    : null
  const rarity =
    (reward.rarity as RarityType | undefined) ??
    meta?.rarity ??
    RarityType.Common
  const type = reward.type ?? meta?.type ?? null
  const graded =
    (type !== null && gradedTypes.has(type)) ||
    reward.itemId.startsWith('Schematic:')
  const accent = graded ? accentByRarity[rarity] ?? null : null
  /*
   * Every `parseResource` branch that recognised the id sets a `type`, except
   * the schematic one — which `graded` already covers. Anything else fell
   * through and its `name` is just the id wearing a hat.
   */
  const parsedName = meta && (meta.type !== null || graded) ? meta.name : ''

  return {
    accent,
    graded,
    name: isUnresolvedName(parsedName)
      ? slugToName(reward.itemId)
      : parsedName,
    rarity,
    word: accent ? rarities[rarity] ?? null : null,
  }
}

export function rarityStyle(accent: string | null): CSSProperties {
  if (!accent) return {}

  return {
    '--rarity': accent,
    '--rarity-soft': `color-mix(in srgb, ${accent} 38%, transparent)`,
  } as CSSProperties
}

/**
 * The three ids the mission list has always hidden from a preview: event
 * scaling filler, event tickets and Venture XP. Left in, any of them can win
 * the payload bay and advertise itself instead of the schematic the alert is
 * actually for.
 */
export function isNoisyReward(itemId: string) {
  return (
    itemId.includes('eventscaling') ||
    itemId.includes('campaign_event_currency') ||
    itemId.includes('phoenixxp')
  )
}
