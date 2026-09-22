import { z } from 'zod'
import { PLUGIN_FORTNITE_PROFILES, type PluginFortniteProfile, type PluginMCPOperation } from '../../types/plugin-fortnite'

const id = z.string().regex(/^[A-Za-z0-9_:.-]{1,160}$/)
const ids = z.array(id).max(50).refine((values) => new Set(values).size === values.length, 'Duplicate ids.')
const empty = z.object({}).strict()
const slotIndices = z.array(z.number().int().min(0).max(15)).max(50)
type Policy = { profiles: readonly PluginFortniteProfile[]; body: z.ZodTypeAny; description: string; write: boolean }
function command(description: string, body: z.ZodTypeAny = empty): Policy {
  return { profiles: ['campaign'], body, description, write: true }
}
export const pluginMCPPolicy: Record<PluginMCPOperation, Policy> = {
  QueryProfile: { profiles: PLUGIN_FORTNITE_PROFILES, body: empty, description: 'Read a filtered game profile.', write: false },
  ClientQuestLogin: command('Refresh daily quests and login progress.'),
  SetPinnedQuests: command('Replace the pinned quest selection.', z.object({ pinnedQuestIds: ids }).strict()),
  FortRerollDailyQuest: command('Replace a daily quest and consume one available reroll.', z.object({ questId: id }).strict()),
  ClaimQuestReward: command('Claim a quest reward using the first reward option.', z.object({ questId: id, selectedRewardIndex: z.literal(0) }).strict()),
  ClaimMissionAlertRewards: command('Claim pending mission alert rewards.'),
  ClaimDifficultyIncreaseRewards: command('Claim pending difficulty rewards.'),
  RefreshExpeditions: command('Refresh available expeditions.'),
  ClaimCollectedResources: command('Collect banked resources.', z.object({ collectorsToClaim: ids.refine((value) => value.length > 0) }).strict()),
  CollectExpedition: command('Collect a completed expedition.', z.object({ expeditionId: id, expeditionTemplate: id }).strict()),
  StartExpedition: command('Send selected heroes on an expedition; they may be unavailable until it finishes.',
    z.object({ expeditionId: id, squadId: id, itemIds: ids, slotIndices }).strict().refine((body) =>
      body.itemIds.length > 0 && body.itemIds.length === body.slotIndices.length && new Set(body.slotIndices).size === body.slotIndices.length, 'Invalid expedition slots.')),
  AbandonExpedition: command('Abandon an expedition; progress or rewards may be lost.', z.object({ expeditionId: id }).strict()),
  AssignWorkerToSquadBatch: command('Change survivor squad assignments.',
    z.object({ characterIds: ids, squadIds: z.array(id).max(50), slotIndices }).strict().refine((body) =>
      body.characterIds.length > 0 && body.characterIds.length === body.squadIds.length && body.characterIds.length === body.slotIndices.length &&
      new Set(body.squadIds.map((squad, index) => `${squad}:${body.slotIndices[index]}`)).size === body.squadIds.length, 'Invalid squad slots.')),
  AssignHeroToLoadout: command('Change a hero loadout slot.', z.object({ heroId: id, loadoutId: id, slotName: z.enum(['CommanderSlot', 'FollowerSlot1', 'FollowerSlot2', 'FollowerSlot3', 'FollowerSlot4', 'FollowerSlot5']) }).strict()),
  AssignDefenderToLoadout: command('Change a defender loadout slot.', z.object({ defenderId: id, loadoutId: id, slotName: id }).strict()),
  AssignWeaponToDefender: command('Assign a weapon schematic to a defender.', z.object({ defenderId: id, weaponSchematicId: id }).strict()),
  SetActiveHeroLoadout: command('Switch the active hero loadout.', z.object({ selectedLoadout: id }).strict()),
  ClearHeroLoadout: command('Clear the selected hero loadout.', z.object({ loadoutId: id }).strict()),
  AssignTeamPerkToLoadout: command('Change a loadout team perk.', z.object({ loadoutId: id, teamPerkId: id }).strict()),
  AssignGadgetToLoadout: command('Change a loadout gadget.', z.object({ loadoutId: id, gadgetId: id, slotIndex: z.number().int().min(0).max(1) }).strict()),
}

export function getPluginMCPPolicy(operation: string) {
  if (!Object.hasOwn(pluginMCPPolicy, operation)) throw new Error('Unsupported MCP operation.')
  return pluginMCPPolicy[operation as PluginMCPOperation]
}

/** Data-only input descriptions for plugin form builders; host refinements still apply. */
function describe(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodEffects) return describe(schema.innerType())
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    return { type: 'object', additionalProperties: false, required: Object.keys(shape),
      properties: Object.fromEntries(Object.entries(shape).map(([key, field]) => [key, describe(field)])) }
  }
  if (schema instanceof z.ZodArray) return { type: 'array', items: describe(schema.element), maxItems: schema._def.maxLength?.value }
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options }
  if (schema instanceof z.ZodLiteral) return { const: schema.value }
  if (schema instanceof z.ZodString) return { type: 'string', pattern: schema._def.checks.find((check) => check.kind === 'regex')?.regex.source }
  if (schema instanceof z.ZodNumber) return { type: schema.isInt ? 'integer' : 'number', minimum: schema.minValue, maximum: schema.maxValue }
  throw new Error('Missing plugin payload description.')
}

export function pluginMCPCatalog() {
  return Object.entries(pluginMCPPolicy).map(([operation, policy]) => ({
    operation, profiles: [...policy.profiles], description: policy.description,
    permission: policy.write ? 'fortnite:commands' : 'fortnite:profiles',
    confirmationRequired: policy.write,
    bodySchema: describe(policy.body),
  }))
}
