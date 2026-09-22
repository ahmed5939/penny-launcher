/** Reviewed surfaces only; adding an entry also requires a host policy and projection. */
export const PLUGIN_FORTNITE_PROFILES = ['campaign', 'athena', 'common_core', 'theater0', 'outpost0', 'collection_book_people0', 'collection_book_schematics0'] as const
export type PluginFortniteProfile = (typeof PLUGIN_FORTNITE_PROFILES)[number]
export const PLUGIN_MCP_OPERATIONS = [
  'QueryProfile', 'ClientQuestLogin', 'SetPinnedQuests', 'FortRerollDailyQuest',
  'ClaimQuestReward', 'ClaimMissionAlertRewards', 'ClaimDifficultyIncreaseRewards',
  'RefreshExpeditions', 'ClaimCollectedResources', 'CollectExpedition', 'StartExpedition', 'AbandonExpedition',
  'AssignWorkerToSquadBatch', 'AssignHeroToLoadout', 'AssignDefenderToLoadout',
  'AssignWeaponToDefender', 'SetActiveHeroLoadout', 'ClearHeroLoadout',
  'AssignTeamPerkToLoadout', 'AssignGadgetToLoadout',
] as const
export type PluginMCPOperation = (typeof PLUGIN_MCP_OPERATIONS)[number]
export type PluginFortniteAccess = { profiles: PluginFortniteProfile[]; operations: PluginMCPOperation[] }
