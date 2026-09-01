import type { AccountData } from '../../types/accounts'
import type {
  ItemKind,
  Rarity,
} from '../../config/constants/fortnite/items'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import {
  decodeItemTemplate,
  prettifyWorkerTrait,
} from '../../config/constants/fortnite/items'

import {
  getQueryProfile,
  setRecycleItemBatch,
} from '../../services/endpoints/mcp'

/**
 * Epic accepts large batches, but a failure part-way through an enormous one
 * tells you nothing about what survived. Chunking keeps the reported count
 * honest and each request small enough to retry.
 */
const recycleChunkSize = 50

export type InventoryLockReason = 'favorite' | 'in-use'

export type InventoryItem = {
  /** Item GUID — what `RecycleItemBatch` wants. */
  itemId: string
  templateId: string
  kind: ItemKind
  name: string
  subtitle: string | null
  rarity: Rarity
  tier: number
  level: number
  quantity: number
  /**
   * Set when the item must not be recycled. The main process re-checks this
   * before every recycle, so a stale renderer cannot delete a locked item.
   */
  lockedReason: InventoryLockReason | null
  /** Survivors only. */
  personality: string | null
  setBonus: string | null
  /**
   * Survivors only — the `WorkerPortrait:` template id of the face the game
   * rolled for this copy. See `SquadSurvivor.portrait`.
   */
  portrait: string | null
  /**
   * Schematics and heroes: the perks actually rolled on this copy, as
   * `Alteration:` template ids the item database can name.
   */
  alterations: Array<string>
}

export type InventoryEntry = {
  accountId: string
  errorMessage?: string
  items: Array<InventoryItem>
}

export type InventoryPayload = Record<string, InventoryEntry>

export type InventoryRecycleNotification = {
  results: Array<{
    accountId: string
    recycled: number
    /** Ids dropped because they turned out to be locked. */
    skipped: number
    errorMessage?: string
  }>
}

export class Inventory {
  static async request(accounts: Array<AccountData>) {
    accounts.forEach((account) => {
      Inventory.getInventory(account)
        .then((entry) => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.InventoryResponse,
            { [account.accountId]: entry } as InventoryPayload
          )
        })
        .catch(() => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.InventoryResponse,
            {
              [account.accountId]: {
                accountId: account.accountId,
                errorMessage: 'Unknown Error',
                items: [],
              },
            } as InventoryPayload
          )
        })
    })
  }

  private static async getInventory(account: AccountData) {
    const entry: InventoryEntry = {
      accountId: account.accountId,
      items: [],
    }
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      entry.errorMessage = 'Unknown Error'

      return entry
    }

    const response = await getQueryProfile({
      accessToken,
      accountId: account.accountId,
    })

    entry.items = Inventory.parseItems(
      response.data.profileChanges[0]?.profile.items ?? {}
    )

    return entry
  }

  /**
   * Heroes slotted into a loadout carry nothing on the hero item itself —
   * the link lives on the loadout, so it has to be collected up front.
   */
  private static getLoadoutMemberIds(
    items: Record<string, { templateId: string; attributes?: unknown }>
  ) {
    const memberIds = new Set<string>()

    Object.values(items).forEach((item) => {
      if (!item.templateId.startsWith('CampaignHeroLoadout:')) {
        return
      }

      const attributes = item.attributes as
        | {
            crew_members?: Record<string, unknown>
            defenders?: Record<string, unknown>
            defender_slots?: Record<string, unknown>
          }
        | undefined
      const assigned = [
        attributes?.crew_members,
        attributes?.defenders,
        attributes?.defender_slots,
      ]

      if (!assigned.some(Boolean)) {
        return
      }

      assigned.forEach((slots) => {
        Object.values(slots ?? {}).forEach((value) => {
          if (typeof value === 'string' && value.length > 0) {
            memberIds.add(value)
          }
        })
      })
    })

    return memberIds
  }

  private static parseItems(
    items: Record<string, { templateId: string; attributes?: unknown }>
  ) {
    const loadoutMemberIds = Inventory.getLoadoutMemberIds(items)
    const parsed: Array<InventoryItem> = []

    Object.entries(items).forEach(([itemId, item]) => {
      const decoded = decodeItemTemplate(item.templateId)

      if (!decoded) {
        return
      }

      const attributes = (item.attributes ?? {}) as Partial<{
        alterations: Array<string>
        building_slot_used: number
        favorite: boolean
        level: number
        personality: string
        portrait: string
        set_bonus: string
        squad_id: string
        squad_slot_idx: number
      }>

      /**
       * Conservative on purpose: anything sitting in a squad, a building
       * slot or a hero loadout counts as equipped. Recycling one of those
       * is not recoverable, so a false positive costs nothing and a false
       * negative costs the user their squad.
       */
      const isEquipped =
        loadoutMemberIds.has(itemId) ||
        (attributes.squad_id ?? '').length > 0 ||
        (attributes.squad_slot_idx ?? -1) >= 0 ||
        (attributes.building_slot_used ?? -1) >= 0

      parsed.push({
        itemId,
        templateId: item.templateId,
        kind: decoded.kind,
        name: decoded.name,
        subtitle: decoded.subtitle,
        rarity: decoded.rarity,
        tier: decoded.tier,
        level: attributes.level ?? 1,
        quantity: (item as { quantity?: number }).quantity ?? 1,
        lockedReason:
          attributes.favorite === true
            ? 'favorite'
            : isEquipped
              ? 'in-use'
              : null,
        personality: prettifyWorkerTrait(attributes.personality),
        setBonus: prettifyWorkerTrait(attributes.set_bonus),
        portrait: attributes.portrait ?? null,
        alterations: (attributes.alterations ?? []).filter(
          (alteration) =>
            typeof alteration === 'string' && alteration.length > 0
        ),
      })
    })

    parsed.sort((itemA, itemB) => {
      if (itemA.kind !== itemB.kind) {
        return itemA.kind.localeCompare(itemB.kind)
      }

      if (itemA.tier !== itemB.tier) {
        return itemB.tier - itemA.tier
      }

      return itemA.name.localeCompare(itemB.name)
    })

    return parsed
  }

  /**
   * Recycles the requested items. The selection is re-validated against a
   * freshly fetched profile first — the renderer's copy can be minutes old,
   * and by then the user may have favourited or equipped something in game.
   */
  static async recycle(
    accounts: Array<AccountData>,
    selection: Record<string, Array<string>>
  ) {
    const results: InventoryRecycleNotification['results'] = []

    await Promise.allSettled(
      accounts.map(async (account) => {
        const result = {
          accountId: account.accountId,
          recycled: 0,
          skipped: 0,
        } as InventoryRecycleNotification['results'][number]
        const requested = selection[account.accountId] ?? []

        if (requested.length <= 0) {
          results.push(result)

          return
        }

        try {
          const accessToken =
            await Authentication.verifyAccessToken(account)

          if (!accessToken) {
            result.errorMessage = 'Unknown Error'
            results.push(result)

            return
          }

          const entry = await Inventory.getInventory(account)
          const recyclable = new Set(
            entry.items
              .filter((item) => item.lockedReason === null)
              .map((item) => item.itemId)
          )
          const targets = requested.filter((itemId) =>
            recyclable.has(itemId)
          )

          result.skipped = requested.length - targets.length

          for (
            let index = 0;
            index < targets.length;
            index += recycleChunkSize
          ) {
            const chunk = targets.slice(index, index + recycleChunkSize)

            try {
              await setRecycleItemBatch({
                accessToken,
                accountId: account.accountId,
                targetItemIds: chunk,
              })

              result.recycled += chunk.length

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
              result.errorMessage =
                error?.response?.data?.errorMessage ?? 'Unknown Error'

              break
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          result.errorMessage =
            error?.response?.data?.errorMessage ?? 'Unknown Error'
        }

        results.push(result)
      })
    )

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.InventoryRecycleNotification,
      { results } as InventoryRecycleNotification
    )
  }
}
