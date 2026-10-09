import { z } from 'zod'
import { PLUGIN_FORTNITE_PROFILES, PLUGIN_MCP_CONFIRMED_OPERATIONS, PLUGIN_MCP_OPERATION_PATTERN, type PluginFortniteProfile } from '../../types/plugin-fortnite'

const maxBodyBytes = 64 * 1024
const id = z.string().regex(/^[A-Za-z0-9_:.-]{1,160}$/)
const unique = (values: string[]) => new Set(values).size === values.length
const ids = z.array(id).max(50).refine(unique, 'Duplicate ids.')
const manyIds = z.array(id).min(1).max(1000).refine(unique, 'Duplicate ids.')
const empty = z.object({})
const slotIndices = z.array(z.number().int().min(0).max(15)).max(50)
const theaters = ['theater0', 'theater1', 'theater2'] as const
/** Plain JSON only: the body is serialized as-is, so anything else would change on the way. */
function jsonBytes(body: unknown) {
  try { return Buffer.byteLength(JSON.stringify(body)) } catch { return Infinity }
}
const anyBody = z.record(z.unknown()).refine((body) => jsonBytes(body) <= maxBodyBytes, 'Request body exceeds 64 KiB.')

type Policy = { profiles: readonly PluginFortniteProfile[]; body: z.ZodTypeAny; description: string; write: boolean; known: boolean }
/** Known fields are checked; unknown fields still reach Epic, so plugins can follow new game builds. */
function command(description: string, body: z.ZodTypeAny = empty, profiles: readonly PluginFortniteProfile[] = ['campaign']): Policy {
  return { profiles, body: z.intersection(anyBody, body), description, write: true, known: true }
}
/** Listed for discovery; Penny has not seen these bodies from its own code, so it does not shape them. */
function passthrough(description: string, profiles: readonly PluginFortniteProfile[] = PLUGIN_FORTNITE_PROFILES): Policy {
  return { profiles, body: anyBody, description, write: true, known: true }
}
export const pluginMCPPolicy: Record<string, Policy> = {
  QueryProfile: { profiles: PLUGIN_FORTNITE_PROFILES, body: z.object({}).strict(), description: 'Read a game profile with account secrets removed.', write: false, known: true },
  ClientQuestLogin: command('Refresh daily quests and login progress.', empty, ['campaign', 'athena']),
  SetPinnedQuests: command('Replace the pinned quest selection.', z.object({ pinnedQuestIds: ids })),
  FortRerollDailyQuest: command('Replace a daily quest and consume one available reroll.', z.object({ questId: id })),
  ClaimQuestReward: command('Claim a quest reward.', z.object({ questId: id, selectedRewardIndex: z.number().int().min(-1).max(20) })),
  ClaimMissionAlertRewards: command('Claim pending mission alert rewards.'),
  ClaimDifficultyIncreaseRewards: command('Claim pending difficulty rewards.'),
  RefreshExpeditions: command('Refresh available expeditions.'),
  ClaimCollectedResources: command('Collect banked resources.', z.object({ collectorsToClaim: ids.refine((value) => value.length > 0) })),
  CollectExpedition: command('Collect a completed expedition.', z.object({ expeditionId: id, expeditionTemplate: id })),
  StartExpedition: command('Send selected heroes on an expedition; they may be unavailable until it finishes.',
    z.object({ expeditionId: id, squadId: id, itemIds: ids, slotIndices }).refine((body) =>
      body.itemIds.length > 0 && body.itemIds.length === body.slotIndices.length && new Set(body.slotIndices).size === body.slotIndices.length, 'Invalid expedition slots.')),
  AbandonExpedition: command('Abandon an expedition; progress or rewards may be lost.', z.object({ expeditionId: id })),
  AssignWorkerToSquadBatch: command('Change survivor squad assignments.',
    z.object({ characterIds: ids, squadIds: z.array(id).max(50), slotIndices }).refine((body) =>
      body.characterIds.length > 0 && body.characterIds.length === body.squadIds.length && body.characterIds.length === body.slotIndices.length &&
      new Set(body.squadIds.map((squad, index) => `${squad}:${body.slotIndices[index]}`)).size === body.squadIds.length, 'Invalid squad slots.')),
  AssignHeroToLoadout: command('Change a hero loadout slot.', z.object({ heroId: id, loadoutId: id, slotName: z.enum(['CommanderSlot', 'FollowerSlot1', 'FollowerSlot2', 'FollowerSlot3', 'FollowerSlot4', 'FollowerSlot5']) })),
  AssignDefenderToLoadout: command('Change a defender loadout slot.', z.object({ defenderId: id, loadoutId: id, slotName: id })),
  AssignWeaponToDefender: command('Assign a weapon schematic to a defender.', z.object({ defenderId: id, weaponSchematicId: id })),
  SetActiveHeroLoadout: command('Switch the active hero loadout.', z.object({ selectedLoadout: id })),
  ClearHeroLoadout: command('Clear the selected hero loadout.', z.object({ loadoutId: id })),
  AssignTeamPerkToLoadout: command('Change a loadout team perk.', z.object({ loadoutId: id, teamPerkId: id })),
  AssignGadgetToLoadout: command('Change a loadout gadget.', z.object({ loadoutId: id, gadgetId: id, slotIndex: z.number().int().min(0).max(1) })),
  RecycleItemBatch: command('Permanently recycle items. Favorites and equipped items are not protected on this route.', z.object({ targetItemIds: manyIds })),
  OpenCardPackBatch: command('Open owned card packs (llamas).', z.object({ cardPackItemIds: manyIds })),
  PopulatePrerolledOffers: command('Refresh the llama shop previews.'),
  PurchaseOrUpgradeHomebaseNode: command('Spend research or skill points on a node.', z.object({ nodeId: id })),
  UpgradeItem: command('Level up an item, spending materials.', z.object({ targetItemId: id })),
  UpgradeItemBulk: command('Level up an item several times, spending materials.', z.object({ targetItemId: id, desiredLevel: z.number().int().min(1).max(200) })),
  UpgradeItemRarity: command('Raise an item’s rarity, spending flux.', z.object({ targetItemId: id })),
  UpgradeAlteration: command('Upgrade a perk, spending perk-UP.', z.object({ targetItemId: id, alterationSlot: z.number().int().min(0).max(10) })),
  RespecAlteration: command('Replace a perk, spending re-perk.', z.object({ targetItemId: id, alterationSlot: z.number().int().min(0).max(10), alterationId: id })),
  ActivateConsumable: command('Use a consumable such as an XP boost.', z.object({ targetItemId: id, targetAccountId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/) })),
  SkipTutorial: command('Skip the Save the World tutorial.'),
  StorageTransfer: command('Move items between the backpack and storage.',
    z.object({ transferOperations: z.array(z.object({ itemId: id, quantity: z.number().int().min(1), toStorage: z.boolean() })).min(1).max(1000) }), ['theater0']),
  ExecuteTerminalCommand: command('Submit an in-game Admin Panel (lobby hack) code.', z.object({ command: z.string().min(1).max(256) }), ['athena']),
  RedeemSTWAccoladeTokens: command('Redeem Save the World accolade tokens for Battle Royale XP.', empty, ['athena']),
  DisassembleWorldItems: passthrough('Disassemble backpack items into crafting materials.', theaters),
  ModifyQuickbar: passthrough('Change the in-game quickbar slots.', theaters),
  ...Object.fromEntries(PLUGIN_MCP_CONFIRMED_OPERATIONS.map((operation) =>
    [operation, passthrough('Spends money, gives items to another account, refunds, or changes store settings. Penny asks every time.')])),
}

export function getPluginMCPPolicy(operation: string): Policy {
  // The pattern also rules out paths, URLs and prototype keys such as `__proto__`.
  if (!PLUGIN_MCP_OPERATION_PATTERN.test(operation)) throw new Error('Unsupported MCP operation name.')
  if (Object.hasOwn(pluginMCPPolicy, operation)) return pluginMCPPolicy[operation]
  return { profiles: PLUGIN_FORTNITE_PROFILES, body: anyBody, description: 'A game profile command Penny has no description for. The body is sent unchanged.', write: true, known: false }
}

/** Data-only input descriptions for plugin form builders; host refinements still apply. */
function describe(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodEffects) return describe(schema.innerType())
  // Every command is `anyBody & shape`: the shape is checked, other fields pass through.
  if (schema instanceof z.ZodIntersection) return { ...describe(schema._def.right), additionalProperties: true }
  if (schema instanceof z.ZodRecord) return { type: 'object', additionalProperties: true }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    return { type: 'object', additionalProperties: schema._def.unknownKeys !== 'strict', required: Object.keys(shape),
      properties: Object.fromEntries(Object.entries(shape).map(([key, field]) => [key, describe(field)])) }
  }
  if (schema instanceof z.ZodArray) return { type: 'array', items: describe(schema.element), maxItems: schema._def.maxLength?.value }
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options }
  if (schema instanceof z.ZodLiteral) return { const: schema.value }
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' }
  if (schema instanceof z.ZodString) return { type: 'string', pattern: schema._def.checks.find((check) => check.kind === 'regex')?.regex.source }
  if (schema instanceof z.ZodNumber) return { type: schema.isInt ? 'integer' : 'number', minimum: schema.minValue, maximum: schema.maxValue }
  throw new Error('Missing plugin payload description.')
}

export function pluginMCPCatalog() {
  return Object.entries(pluginMCPPolicy).map(([operation, policy]) => ({
    operation, profiles: [...policy.profiles], description: policy.description,
    permission: policy.write ? 'fortnite:commands' : 'fortnite:profiles',
    alwaysConfirmed: (PLUGIN_MCP_CONFIRMED_OPERATIONS as readonly string[]).includes(operation),
    bodySchema: describe(policy.body),
  }))
}
