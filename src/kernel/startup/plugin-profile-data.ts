import { z } from 'zod'
import type { PluginFortniteProfile } from '../../types/plugin-fortnite'

const text = z.string().max(2048)
const number = z.number().finite()
const flag = z.boolean()
const texts = z.array(text).max(1000)
const variant = z.object({ channel: text, active: text.optional(), owned: texts.optional() })
const fields = (names: string, schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> =>
  Object.fromEntries(names.split(' ').map((name) => [name, schema]))

// Positive schemas at EVERY level. Unknown fields are omitted, never copied through.
const itemFields: Record<string, z.ZodTypeAny> = {
  ...fields('level quantity squad_slot_idx building_slot_used max_level_bonus resource_count max_resource_count durability loadedAmmo xp_reward_scalar expedition_success_chance expedition_max_target_power expedition_min_target_power', number),
  ...fields('favorite item_seen', flag),
  ...fields('quest_state quest_rarity creation_time last_state_change_time personality portrait set_bonus managerSynergy squad_id expedition_squad_id expedition_slot_id expedition_start_time expedition_end_time expedition_expiration_end_time', text),
  ...fields('alterations alteration_base_rarities expedition_criteria', texts),
  variants: z.array(variant).max(100),
  outfitvariants: z.array(variant).max(100),
  backblingvariants: z.array(variant).max(100),
  crew_members: z.object(Object.fromEntries(['CommanderSlot', 'FollowerSlot1', 'FollowerSlot2', 'FollowerSlot3', 'FollowerSlot4', 'FollowerSlot5'].map((key) => [key, text.optional()]))),
  team_perk: text,
  gadgets: z.array(z.object({ gadget: text, slot_index: number })).max(2),
}
const statFields: Record<string, z.ZodTypeAny> = {
  ...fields('level xp xp_overflow xp_lost matches_played rewards_claimed_post_max_level book_level book_xp season_num season_level season_match_boost season_friend_match_boost rested_xp rested_xp_mult accountLevel battlestars vote_data', number),
  selected_hero_loadout: text,
  research_levels: z.object({ technology: number.optional(), offense: number.optional(), fortitude: number.optional(), resistance: number.optional() }),
  collection_book: z.object({ maxBookXpLevelAchieved: number.optional() }),
  client_settings: z.object({ pinnedQuestInstances: texts.optional() }),
  gameplay_stats: z.array(z.object({ statName: text, statValue: number })).max(1000),
  quest_manager: z.object({ dailyLoginInterval: text.optional(), dailyQuestRerolls: number.optional(),
    questPoolStats: z.object({ poolStats: z.array(z.object({ questHistory: texts.optional(), rerollsRemaining: number.optional(), nextRefresh: text.optional(), poolName: text.optional() })).max(100).optional() }).optional() }),
  daily_rewards: z.object({ nextDefaultReward: number.optional(), totalDaysLoggedIn: number.optional(), lastClaimDate: text.optional() }),
}

function record(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
}
function project(input: unknown, schemas: Record<string, z.ZodTypeAny>) {
  const source = record(input)
  const output: Record<string, unknown> = Object.create(null)
  for (const [key, schema] of Object.entries(schemas)) {
    if (!Object.hasOwn(source, key)) continue
    const parsed = schema.safeParse(source[key])
    if (parsed.success) output[key] = parsed.data
  }
  return output
}
const safeId = /^[A-Za-z0-9_-]{1,160}$/
const itemTemplate = /^(Hero|Schematic|Worker|Defender|Quest|Token|AccountResource|CollectedResource|Expedition|ConsumableAccountItem|CardPack|CampaignHeroLoadout|HomebaseNode|CollectionBook|Weapon|Trap|Ammo|Ingredient|Currency|Athena[A-Za-z]+|Cosmetic[A-Za-z]+|Sparks[A-Za-z]+|VehicleCosmetics_[A-Za-z]+|HomebaseBannerIcon|HomebaseBannerColor):[A-Za-z0-9_.-]{1,240}$/

export function filterPluginProfile(data: unknown, accountId: string, profileId: PluginFortniteProfile) {
  const envelope = record(data)
  if (!Array.isArray(envelope.profileChanges)) throw new Error('Missing game profile.')
  const update = envelope.profileChanges.slice(0, 100).map(record).find((change) =>
    change.changeType === 'fullProfileUpdate' && record(change.profile).profileId === profileId)
  const profile = record(update?.profile)
  if (profile.accountId !== accountId || profile.profileId !== profileId) throw new Error('Game profile does not match the selected account.')
  const source = record(profile.items)
  if (Object.keys(source).length > 30_000) throw new Error('Game profile is too large.')
  const items: Record<string, { templateId: string; quantity: number; attributes: Record<string, unknown> }> = Object.create(null)
  for (const [itemId, raw] of Object.entries(source)) {
    const item = record(raw)
    if (!safeId.test(itemId) || ['__proto__', 'constructor', 'prototype'].includes(itemId) ||
      typeof item.templateId !== 'string' || !itemTemplate.test(item.templateId) ||
      !number.safeParse(item.quantity).success) continue
    const attributes = project(item.attributes, itemFields)
    // Quest objective names are dynamic, but their values can only be finite numbers.
    if (item.templateId.startsWith('Quest:')) {
      for (const [key, value] of Object.entries(record(item.attributes))) {
        if (/^completion_[a-zA-Z0-9_]{1,160}$/.test(key) && typeof value === 'number' && Number.isFinite(value)) attributes[key] = value
      }
    }
    items[itemId] = { templateId: item.templateId, quantity: item.quantity as number, attributes }
  }
  const result = {
    accountId, profileId, filtered: true as const,
    ...project(profile, { rvn: number, commandRevision: number }),
    items, stats: { attributes: profileId === 'common_core' ? {} : project(record(profile.stats).attributes, statFields) },
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 4 * 1024 * 1024) throw new Error('Filtered game profile exceeds 4 MiB.')
  return result
}

export function filterPluginLocker(data: unknown) {
  const source = record(record(record(data).activeLoadoutGroup).loadouts)
  if (Object.keys(source).length > 100) throw new Error('Locker is too large.')
  const loadouts: Record<string, unknown> = Object.create(null)
  const schema = z.object({
    loadoutSlots: z.array(z.object({ slotTemplate: text, equippedItemId: text.optional() })).max(100).optional(),
    shuffleType: text.optional(),
  })
  for (const [key, value] of Object.entries(source)) {
    if (!/^CosmeticLoadout:[A-Za-z0-9_]{1,160}$/.test(key)) continue
    const parsed = schema.safeParse(value)
    if (parsed.success) loadouts[key] = parsed.data
  }
  return { activeLoadoutGroup: { loadouts }, filtered: true as const }
}
