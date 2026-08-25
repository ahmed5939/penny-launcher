import type {
  MCPClaimDifficultyIncreaseRewardsResponse,
  MCPClaimMissionAlertRewardsResponse,
  MCPClaimQuestRewardResponse,
  MCPFortRerollDailyQuestResponse,
  MCPOpenCardPackBatchPayload,
  MCPOpenCardPackBatchResponse,
  MCPRecordCampaignMatchEndedResponse,
  MCPRedeemSTWAccoladeTokensResponse,
  MCPSetPinnedQuestsPayload,
  MCPSetPinnedQuestsResponse,
} from '../../types/services/mcp/claim-rewards'
import type {
  MCPActivateConsumableResponse,
  MCPClientQuestLoginResponse,
  MCPPurchaseCatalogEntryResponse,
  MCPQueryProfile,
  MCPQueryProfileMainProfile,
  MCPQueryProfileStorageProfile,
  MCPStorageTransferItem,
  MCPStorageTransferResponse,
} from '../../types/services/mcp'

import { baseGameService } from '../config/base-game'

export function getQueryProfile({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/QueryProfile`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function getQueryProfileMainProfile({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPQueryProfileMainProfile>(
    `/profile/${accountId}/client/QueryProfile`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'common_core',
        rvn: -1,
      },
    }
  )
}

export function getQueryProfileStorageProfile({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPQueryProfileStorageProfile>(
    `/profile/${accountId}/client/QueryProfile`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'outpost0',
        rvn: -1,
      },
    }
  )
}

export function getQueryPublicProfile({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/public/QueryPublicProfile`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function populatePrerolledOffers({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/PopulatePrerolledOffers`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function purchaseCatalogEntry({
  accessToken,
  accountId,

  offerId,
  currency = 'GameItem',
  purchaseQuantity = 1,
  currencySubType = 'AccountResource:currency_xrayllama',
  expectedTotalPrice = 0,
  gameContext = 'FrontEnd.None',
}: {
  accessToken: string
  accountId: string

  offerId: string
  currency?: string
  purchaseQuantity?: number
  currencySubType?: string
  expectedTotalPrice?: number
  gameContext?: string
}) {
  return baseGameService.post<MCPPurchaseCatalogEntryResponse>(
    `/profile/${accountId}/client/PurchaseCatalogEntry`,
    {
      offerId,
      currency,
      currencySubType,
      expectedTotalPrice,
      purchaseQuantity,
      gameContext,
      // client_request_id: '',
      // additionalData: {
      //   islandId: 'campaign',
      //   islandTitle: 'None',
      //   productTag: 'Product.STW',
      //   storeContext: 'FrontEnd',
      //   sourceContext: '',
      //   checkoutProperties: {},
      //   itemShopFilterContext: {
      //     activeFilters: [],
      //     inactiveFilters: [],
      //   },
      //   storefront: 'CardPackStorePreroll',
      //   storeId: '',
      //   groupId: '',
      // },
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'common_core',
        rvn: -1,
      },
    }
  )
}

export function setActivateConsumable({
  accessToken,
  accountId,
  targetItemId,
  targetAccountId,
}: {
  accessToken: string
  accountId: string
  targetItemId: string
  targetAccountId: string
}) {
  return baseGameService.post<MCPActivateConsumableResponse>(
    `/profile/${accountId}/client/ActivateConsumable`,
    {
      targetItemId,
      targetAccountId,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setClaimDifficultyIncreaseRewards({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPClaimDifficultyIncreaseRewardsResponse>(
    `/profile/${accountId}/client/ClaimDifficultyIncreaseRewards`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setClaimMissionAlertRewards({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPClaimMissionAlertRewardsResponse>(
    `/profile/${accountId}/client/ClaimMissionAlertRewards`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setClaimQuestReward({
  accessToken,
  accountId,
  questId,
}: {
  accessToken: string
  accountId: string
  questId: string
}) {
  return baseGameService.post<MCPClaimQuestRewardResponse>(
    `/profile/${accountId}/client/ClaimQuestReward`,
    {
      questId,
      selectedRewardIndex: 0,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setFortRerollDailyQuest({
  accessToken,
  accountId,
  questId,
}: {
  accessToken: string
  accountId: string
  questId: string
}) {
  return baseGameService.post<MCPFortRerollDailyQuestResponse>(
    `/profile/${accountId}/client/FortRerollDailyQuest`,
    {
      questId,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setClientQuestLogin({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPClientQuestLoginResponse>(
    `/profile/${accountId}/client/ClientQuestLogin`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setCollectExpedition({
  accessToken,
  accountId,
  expeditionId,
  expeditionTemplate,
}: {
  accessToken: string
  accountId: string
  expeditionId: string
  /** e.g. `Expedition:expedition_sea_supplyrun_long_t04` */
  expeditionTemplate: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/CollectExpedition`,
    {
      expeditionTemplate,
      expeditionId,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setStartExpedition({
  accessToken,
  accountId,
  expeditionId,
  squadId,
  itemIds,
  slotIndices,
}: {
  accessToken: string
  accountId: string
  expeditionId: string
  squadId: string
  /** Survivor/hero item GUIDs sent on the expedition. */
  itemIds: Array<string>
  slotIndices: Array<number>
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/StartExpedition`,
    {
      expeditionId,
      squadId,
      itemIds,
      slotIndices,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setAbandonExpedition({
  accessToken,
  accountId,
  expeditionId,
}: {
  accessToken: string
  accountId: string
  expeditionId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/AbandonExpedition`,
    {
      expeditionId,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

/**
 * Moves survivors between squad slots. The three arrays are positional —
 * index `n` of each describes one assignment.
 */
export function setAssignWorkerToSquadBatch({
  accessToken,
  accountId,
  characterIds,
  squadIds,
  slotIndices,
}: {
  accessToken: string
  accountId: string
  characterIds: Array<string>
  squadIds: Array<string>
  slotIndices: Array<number>
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/AssignWorkerToSquadBatch`,
    {
      characterIds,
      squadIds,
      slotIndices,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setOpenCardPackBatch({
  accessToken,
  accountId,
  cardPackItemIds,
}: {
  accessToken: string
  accountId: string
} & MCPOpenCardPackBatchPayload) {
  return baseGameService.post<MCPOpenCardPackBatchResponse>(
    `/profile/${accountId}/client/OpenCardPackBatch`,
    {
      cardPackItemIds,
    } as MCPOpenCardPackBatchPayload,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setPurchaseOrUpgradeHomebaseNode({
  accessToken,
  accountId,
  nodeId,
}: {
  accessToken: string
  accountId: string
  nodeId: string
}) {
  return baseGameService.post<unknown>(
    `/profile/${accountId}/client/PurchaseOrUpgradeHomebaseNode`,
    {
      nodeId,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setRecordCampaignMatchEnded({
  accessToken,
  accountId,
  sessionId,
}: {
  accessToken: string
  accountId: string
  sessionId: string
}) {
  return baseGameService.post<MCPRecordCampaignMatchEndedResponse>(
    `/profile/${accountId}/client/RecordCampaignMatchEnded`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
        'X-EpicGames-GameSessionId': sessionId,
      },
      params: {
        profileId: 'athena',
        rvn: -1,
      },
    }
  )
}

/**
 * Item modification.
 *
 * Every one of these spends resources and cannot be undone, so the callers
 * confirm first and the payloads are taken verbatim from the endpoint
 * documentation rather than from memory.
 *
 * @see https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation
 */

/** Raises an item one level. */
export function setUpgradeItem({
  accessToken,
  accountId,
  targetItemId,
}: {
  accessToken: string
  accountId: string
  targetItemId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/UpgradeItem`,
    { targetItemId },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

/**
 * Levels and/or evolves an item in one call.
 *
 * `desiredTier` is a lowercase roman numeral (`i`–`v`) or `no_tier` to only
 * change the level. `conversionRecipeIndexChoice` picks between materials
 * when an evolution offers a choice, and is `-1` when there is none.
 */
export function setUpgradeItemBulk({
  accessToken,
  accountId,
  targetItemId,
  desiredLevel,
  desiredTier = 'no_tier',
  conversionRecipeIndexChoice = -1,
}: {
  accessToken: string
  accountId: string
  targetItemId: string
  desiredLevel: number
  desiredTier?: string
  conversionRecipeIndexChoice?: number
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/UpgradeItemBulk`,
    {
      targetItemId,
      desiredLevel,
      desiredTier,
      conversionRecipeIndexChoice,
    },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

/** Raises a hero or schematic one rarity. */
export function setUpgradeItemRarity({
  accessToken,
  accountId,
  targetItemId,
}: {
  accessToken: string
  accountId: string
  targetItemId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/UpgradeItemRarity`,
    { targetItemId },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

/** Raises the perk in `alterationSlot` (0–5) one rarity. */
export function setUpgradeAlteration({
  accessToken,
  accountId,
  targetItemId,
  alterationSlot,
}: {
  accessToken: string
  accountId: string
  targetItemId: string
  alterationSlot: number
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/UpgradeAlteration`,
    { targetItemId, alterationSlot },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

/** Swaps the perk in `alterationSlot` for `alterationId`. */
export function setRespecAlteration({
  accessToken,
  accountId,
  targetItemId,
  alterationSlot,
  alterationId,
}: {
  accessToken: string
  accountId: string
  targetItemId: string
  alterationSlot: number
  /** e.g. `Alteration:aid_att_damage_t05`. */
  alterationId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/RespecAlteration`,
    { targetItemId, alterationSlot, alterationId },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

export function setAssignHeroToLoadout({
  accessToken,
  accountId,
  heroId,
  loadoutId,
  slotName,
}: {
  accessToken: string
  accountId: string
  heroId: string
  loadoutId: string
  /** `CommanderSlot`, or `FollowerSlot1`–`FollowerSlot5`. */
  slotName: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/AssignHeroToLoadout`,
    { heroId, loadoutId, slotName },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

export function setActiveHeroLoadout({
  accessToken,
  accountId,
  selectedLoadout,
}: {
  accessToken: string
  accountId: string
  selectedLoadout: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/SetActiveHeroLoadout`,
    { selectedLoadout },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

export function setClearHeroLoadout({
  accessToken,
  accountId,
  loadoutId,
}: {
  accessToken: string
  accountId: string
  loadoutId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/ClearHeroLoadout`,
    { loadoutId },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

export function setAssignTeamPerkToLoadout({
  accessToken,
  accountId,
  loadoutId,
  teamPerkId,
}: {
  accessToken: string
  accountId: string
  loadoutId: string
  teamPerkId: string
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/AssignTeamPerkToLoadout`,
    { teamPerkId, loadoutId },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

export function setAssignGadgetToLoadout({
  accessToken,
  accountId,
  gadgetId,
  loadoutId,
  slotIndex,
}: {
  accessToken: string
  accountId: string
  /** Template id, not an item GUID — e.g. `Gadget:g_supplydrop`. */
  gadgetId: string
  loadoutId: string
  /** 0 or 1. */
  slotIndex: number
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/AssignGadgetToLoadout`,
    { gadgetId, loadoutId, slotIndex },
    {
      headers: { Authorization: `bearer ${accessToken}` },
      params: { profileId: 'campaign', rvn: -1 },
    }
  )
}

/**
 * Recycles items for their crafting materials. Irreversible, so the caller
 * is responsible for having filtered out anything favourited or equipped.
 *
 * @see https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation
 */
export function setRecycleItemBatch({
  accessToken,
  accountId,
  targetItemIds,
}: {
  accessToken: string
  accountId: string
  /** Item GUIDs. */
  targetItemIds: Array<string>
}) {
  return baseGameService.post<MCPQueryProfile>(
    `/profile/${accountId}/client/RecycleItemBatch`,
    {
      targetItemIds,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setRedeemSTWAccoladeTokens({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<MCPRedeemSTWAccoladeTokensResponse>(
    `/profile/${accountId}/client/RedeemSTWAccoladeTokens`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'athena',
        rvn: -1,
      },
    }
  )
}

export function setSetPinnedQuests({
  accessToken,
  accountId,
  pinnedQuestIds,
}: {
  accessToken: string
  accountId: string
} & MCPSetPinnedQuestsPayload) {
  return baseGameService.post<MCPSetPinnedQuestsResponse>(
    `/profile/${accountId}/client/SetPinnedQuests`,
    {
      pinnedQuestIds,
    } as MCPSetPinnedQuestsPayload,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setSkipTutorial({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return baseGameService.post<unknown>(
    `/profile/${accountId}/client/SkipTutorial`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'campaign',
        rvn: -1,
      },
    }
  )
}

export function setStorageTransfer({
  accessToken,
  accountId,
  items,
}: {
  accessToken: string
  accountId: string
  items: Array<MCPStorageTransferItem>
}) {
  return baseGameService.post<MCPStorageTransferResponse>(
    `/profile/${accountId}/client/StorageTransfer`,
    {
      transferOperations: items,
    },
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        profileId: 'theater0',
        rvn: -1,
      },
    }
  )
}
