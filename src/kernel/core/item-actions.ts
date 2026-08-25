import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import {
  setRespecAlteration,
  setUpgradeAlteration,
  setUpgradeItem,
  setUpgradeItemBulk,
  setUpgradeItemRarity,
} from '../../services/endpoints/mcp'

/**
 * Modifying an item you own — levelling, evolving, and perk work.
 *
 * Everything here spends materials and cannot be undone, so each action is
 * a single explicit request rather than anything batched or inferred: the
 * renderer confirms, the main process performs exactly what was confirmed.
 */

export type ItemActionKind =
  | 'level'
  | 'evolve'
  | 'rarity'
  | 'perk-upgrade'
  | 'perk-respec'

export type ItemActionRequest = {
  kind: ItemActionKind
  itemId: string
  /** `level` and `evolve`: the level to end at. */
  desiredLevel?: number
  /** `evolve`: lowercase roman numeral, e.g. `iv`. */
  desiredTier?: string
  /** `evolve`: which material, when the evolution offers a choice. */
  conversionIndex?: number
  /** Perk actions: which slot, 0–5. */
  alterationSlot?: number
  /** `perk-respec`: the perk to switch to. */
  alterationId?: string
}

export type ItemActionNotification = {
  accountId: string
  kind: ItemActionKind
  errorMessage?: string
}

export class ItemActions {
  static async perform(
    account: AccountData,
    request: ItemActionRequest
  ) {
    const notification: ItemActionNotification = {
      accountId: account.accountId,
      kind: request.kind,
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        notification.errorMessage = 'Unknown Error'
      } else {
        await ItemActions.dispatch(
          accessToken,
          account.accountId,
          request
        )
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      notification.errorMessage =
        error?.response?.data?.errorMessage ?? 'Unknown Error'
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ItemActionNotification,
      notification
    )
  }

  private static async dispatch(
    accessToken: string,
    accountId: string,
    request: ItemActionRequest
  ) {
    const targetItemId = request.itemId

    switch (request.kind) {
      case 'level':
        /**
         * `UpgradeItem` moves one level at a time; the bulk command reaches
         * a target level in one request, which is both faster and leaves no
         * half-finished state if something fails part-way.
         */
        if (typeof request.desiredLevel === 'number') {
          await setUpgradeItemBulk({
            accessToken,
            accountId,
            targetItemId,
            desiredLevel: request.desiredLevel,
          })

          return
        }

        await setUpgradeItem({ accessToken, accountId, targetItemId })

        return

      case 'evolve':
        await setUpgradeItemBulk({
          accessToken,
          accountId,
          targetItemId,
          desiredLevel: request.desiredLevel ?? 1,
          desiredTier: request.desiredTier ?? 'no_tier',
          conversionRecipeIndexChoice: request.conversionIndex ?? -1,
        })

        return

      case 'rarity':
        await setUpgradeItemRarity({
          accessToken,
          accountId,
          targetItemId,
        })

        return

      case 'perk-upgrade':
        await setUpgradeAlteration({
          accessToken,
          accountId,
          targetItemId,
          alterationSlot: request.alterationSlot ?? 0,
        })

        return

      case 'perk-respec':
        if (!request.alterationId) {
          throw new Error('No perk was chosen')
        }

        await setRespecAlteration({
          accessToken,
          accountId,
          targetItemId,
          alterationSlot: request.alterationSlot ?? 0,
          alterationId: request.alterationId,
        })

        return

      default:
        throw new Error('Unsupported action')
    }
  }
}
