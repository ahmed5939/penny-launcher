import type { AccountData } from '../../types/accounts'
import type { LockerSlotKey } from '../../config/fortnite/locker'
import type { CosmeticMeta } from './locker-catalog'
import type { LockerCardFilters } from './locker-loadout'
import type { CompanionCollectionEntry } from './locker-companions'

import path from 'node:path'
import { app, dialog, shell } from 'electron'
import { copyFile } from 'node:fs/promises'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { slotTemplates } from '../../config/fortnite/locker'

import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { getCosmeticsCatalog, resolveCosmetic } from './locker-catalog'
import { buildCompanionCollection } from './locker-companions'
import { sortForCard } from './locker-card'
import { LockerCardWorker } from '../startup/locker-card-worker'
import {
  buildLoadoutPayload,
  cardGroupOrder,
  filterForCard,
  parseEquippedSlots,
} from './locker-loadout'

import { fortnitePCGameClient } from '../../config/fortnite/clients'

import {
  getQueryProfileAthena,
  getQueryProfileMainProfile,
} from '../../services/endpoints/mcp'
import {
  getEOSAccessToken,
  getLockerItems,
  setActiveLoadoutGroup,
} from '../../services/endpoints/locker'
import {
  createAccessTokenUsingExchange,
  getExchangeCodeUsingAccessToken,
} from '../../services/endpoints/oauth'

/**
 * The Battle Royale locker.
 *
 * Two halves that share a catalogue and nothing else:
 *
 * - the *board* — read the account's equipped slots off EOS, list what it
 *   owns from the athena profile, and write a slot back;
 * - the *card* — draw everything it owns as one image (see `locker-card`).
 *
 * Reading the locker is not an MCP call. It lives on Epic Online Services
 * behind a token this app mints nowhere else, which is what `eosToken`
 * below is for.
 */

export type { LockerCardFilters } from './locker-loadout'

export type LockerSlotState = {
  slotKey: LockerSlotKey
  /** Null when the slot is empty, or absent from this account's locker. */
  templateId: string | null
  name: string | null
  imageUrl: string | null
  rarity: string | null
  /** The item's own series palette, when it belongs to one. */
  seriesColors: Array<string> | null
  /** Banner colours only. */
  color: string | null
}

export type LockerPayload = {
  accountId: string
  errorMessage?: string
  /** Only the slots this account actually has; the board draws the rest empty. */
  slots: Record<string, LockerSlotState>
}

export type LockerOwnedPayload = {
  accountId: string
  errorMessage?: string
  cosmetics: Array<CosmeticMeta>
}

export type LockerCompanionsPayload = {
  accountId: string
  errorMessage?: string
  companions: Array<CompanionCollectionEntry>
}

export type LockerEquipNotification = {
  accountId: string
  slotKey: LockerSlotKey
  templateId: string | null
  itemName: string
  errorMessage?: string
}

export type LockerCardProgress = {
  accountId: string
  done: number
  total: number
}

export type LockerCardNotification = {
  accountId: string
  errorMessage?: string
  card?: {
    filePath: string
    fileName: string
    count: number
    width: number
    height: number
    previewDataUrl: string
    sizeBytes: number
  }
}

/**
 * EOS tokens live about eight hours, and equipping one item is a read plus a
 * write. Minting a fresh one per click would mean four extra round trips for
 * every slot the user touches, so it is kept until shortly before it lapses.
 */
const tokenSafetyMarginMs = 5 * 60 * 1000

const eosTokens = new Map<string, { token: string; expiresAt: number }>()

/**
 * Labels which hop of the token chain broke.
 *
 * Three services answer here — Epic's OAuth, its exchange, and EOS — and all
 * three phrase a rejection the same way, so an unlabelled message leaves you
 * guessing which one said it.
 */
async function step<Result>(label: string, run: () => Promise<Result>) {
  try {
    return await run()
  } catch (error) {
    throw new Error(`${label}: ${errorMessage(error)}`, { cause: error })
  }
}

async function mintEOSToken(account: AccountData) {
  const accessToken = await Authentication.verifyAccessToken(account)

  if (!accessToken) {
    return null
  }

  /*
   * EOS checks that the eg1 token it is handed and the client credentials in
   * the Basic header belong to the *same product* — hand it a token from one
   * and credentials from another and it answers "the product Id passed does
   * not match the product Id on the access token".
   *
   * So the account's token is walked through an exchange code into a
   * `fortnitePCGameClient` token, and `getEOSAccessToken` presents that same
   * client. The two are deliberately the one constant: changing either
   * without the other is exactly the mismatch above.
   */
  const exchange = await step('Exchange code', () =>
    getExchangeCodeUsingAccessToken(accessToken)
  )
  const game = await step('Game client sign-in', () =>
    createAccessTokenUsingExchange(
      {
        exchange_code: exchange.data.code,
        token_type: 'eg1',
      },
      {
        headers: {
          Authorization: `basic ${fortnitePCGameClient.auth}`,
        },
      }
    )
  )
  const eos = await step('EOS sign-in', () =>
    getEOSAccessToken(game.data.access_token)
  )

  if (!eos.data.access_token) {
    return null
  }

  eosTokens.set(account.accountId, {
    token: eos.data.access_token,
    expiresAt:
      Date.now() +
      Math.max(0, (eos.data.expires_in ?? 7200) * 1000 - tokenSafetyMarginMs),
  })

  return eos.data.access_token
}

export async function eosToken(account: AccountData, { fresh = false } = {}) {
  const cached = eosTokens.get(account.accountId)

  if (!fresh && cached && cached.expiresAt > Date.now()) {
    return cached.token
  }

  eosTokens.delete(account.accountId)

  return mintEOSToken(account)
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { errorMessage?: string } } })
      .response

    if (response?.data?.errorMessage) {
      return response.data.errorMessage
    }
  }

  return error instanceof Error ? error.message : 'Unknown error'
}

export class Locker {
  /** Owned cosmetics, per account, for as long as the page stays open. */
  private static ownedCache = new Map<
    string,
    { cosmetics: Array<CosmeticMeta>; fetchedAt: number }
  >()

  private static ownedCacheMaxAgeMs = 10 * 60 * 1000

  /**
   * One read per account at a time. The owned list and the sidekick view
   * are asked for together on page load, and both start from the same
   * profile query — without this the second request would repeat it.
   */
  private static ownedInFlight = new Map<string, Promise<Array<CosmeticMeta>>>()

  static async request(account: AccountData) {
    const payload: LockerPayload = {
      accountId: account.accountId,
      slots: {},
    }

    try {
      const token = await eosToken(account)

      if (!token) {
        payload.errorMessage = 'Could not authenticate this account'

        return Locker.send(ElectronAPIEventKeys.LockerResponse, payload)
      }

      const [items, catalog] = await Promise.all([
        step('Locker read', () =>
          getLockerItems({ accessToken: token, accountId: account.accountId })
        ),
        getCosmeticsCatalog(),
      ])
      const equipped = parseEquippedSlots(items.data)

      Object.entries(equipped).forEach(([slotKey, templateId]) => {
        if (!templateId) {
          payload.slots[slotKey] = {
            slotKey: slotKey as LockerSlotKey,
            templateId: null,
            name: null,
            imageUrl: null,
            rarity: null,
            seriesColors: null,
            color: null,
          }

          return
        }

        const meta = resolveCosmetic(catalog, templateId)

        payload.slots[slotKey] = {
          slotKey: slotKey as LockerSlotKey,
          templateId,
          name: meta.name,
          imageUrl: meta.imageUrl,
          rarity: meta.rarity,
          seriesColors: meta.seriesColors,
          color: meta.color,
        }
      })
    } catch (error) {
      RuntimeLog.error('caught:core/locker.ts', error)
      payload.errorMessage = errorMessage(error)
    }

    Locker.send(ElectronAPIEventKeys.LockerResponse, payload)
  }

  static async requestOwned(account: AccountData, refresh = false) {
    const payload: LockerOwnedPayload = {
      accountId: account.accountId,
      cosmetics: [],
    }

    try {
      payload.cosmetics = await Locker.getOwned(account, refresh)
    } catch (error) {
      RuntimeLog.error('caught:core/locker.ts', error)
      payload.errorMessage = errorMessage(error)
    }

    Locker.send(ElectronAPIEventKeys.LockerOwnedResponse, payload)
  }

  /**
   * Every sidekick Epic has shipped, flagged by whether this account owns it.
   *
   * Reads the same owned list as `requestOwned` (and shares its cache), so
   * asking for both costs one profile query, not two.
   */
  static async requestCompanions(account: AccountData, refresh = false) {
    const payload: LockerCompanionsPayload = {
      accountId: account.accountId,
      companions: [],
    }

    try {
      const [owned, catalog] = await Promise.all([
        Locker.getOwned(account, refresh),
        getCosmeticsCatalog(),
      ])

      payload.companions = buildCompanionCollection(
        catalog,
        owned.map((cosmetic) => cosmetic.templateId)
      )
    } catch (error) {
      RuntimeLog.error('caught:core/locker.ts', error)
      payload.errorMessage = errorMessage(error)
    }

    Locker.send(ElectronAPIEventKeys.LockerCompanionsResponse, payload)
  }

  static async equip(
    account: AccountData,
    slotKey: LockerSlotKey,
    templateId: string | null,
    itemName: string
  ) {
    const notification: LockerEquipNotification = {
      accountId: account.accountId,
      slotKey,
      templateId,
      itemName,
    }

    try {
      if (!(slotKey in slotTemplates)) {
        throw new Error(`Unknown slot: ${slotKey}`)
      }

      const token = await eosToken(account)

      if (!token) {
        throw new Error('Could not authenticate this account')
      }

      const write = async (accessToken: string) => {
        const current = await getLockerItems({
          accessToken,
          accountId: account.accountId,
        })

        return setActiveLoadoutGroup({
          accessToken,
          accountId: account.accountId,
          loadouts: buildLoadoutPayload(current.data, slotKey, templateId),
        })
      }

      try {
        await write(token)
      } catch (error) {
        /*
         * A token can lapse between the mint and the write. One retry with a
         * fresh one, and only for the status that means exactly that.
         */
        const status = (error as { response?: { status?: number } }).response
          ?.status

        if (status !== 401) {
          throw error
        }

        const refreshed = await eosToken(account, { fresh: true })

        if (!refreshed) {
          throw new Error('Could not authenticate this account')
        }

        await write(refreshed)
      }
    } catch (error) {
      RuntimeLog.error('caught:core/locker.ts', error)
      notification.errorMessage = errorMessage(error)
    }

    Locker.send(ElectronAPIEventKeys.LockerEquipNotification, notification)

    if (!notification.errorMessage) {
      /* The board reads back from Epic rather than trusting the write. */
      await Locker.request(account)
    }
  }

  static async generateCard(
    account: AccountData,
    filters: LockerCardFilters
  ) {
    const notification: LockerCardNotification = {
      accountId: account.accountId,
    }

    try {
      const cosmetics = await Locker.getOwned(account)
      const equipped = new Set<string>()

      if (filters.equippedOnly) {
        const token = await eosToken(account)

        if (!token) {
          throw new Error('Could not authenticate this account')
        }

        const items = await getLockerItems({
          accessToken: token,
          accountId: account.accountId,
        })

        Object.values(parseEquippedSlots(items.data)).forEach((templateId) => {
          if (templateId) {
            equipped.add(templateId)
          }
        })
      }

      const selected = sortForCard(
        filterForCard(cosmetics, filters, equipped),
        cardGroupOrder
      )

      if (selected.length === 0) {
        throw new Error('Nothing matches those filters')
      }

      const card = await LockerCardWorker.render(
        {
          cosmetics: selected,
          directory: Locker.outputDirectory(),
          displayName: account.displayName || account.accountId,
          subtitle: `${selected.length.toLocaleString()} cosmetics`,
        },
        (done, total) => {
          Locker.send(ElectronAPIEventKeys.LockerCardProgress, {
            accountId: account.accountId,
            done,
            total,
          } as LockerCardProgress)
        }
      )

      notification.card = {
        filePath: card.filePath,
        fileName: card.fileName,
        count: card.count,
        width: card.width,
        height: card.height,
        previewDataUrl: card.previewDataUrl,
        sizeBytes: card.sizeBytes,
      }
    } catch (error) {
      RuntimeLog.error('caught:core/locker.ts', error)
      notification.errorMessage = errorMessage(error)
    }

    Locker.send(ElectronAPIEventKeys.LockerCardNotification, notification)
  }

  static async openCard(filePath: string) {
    try {
      await shell.openPath(filePath)
    } catch (error) {
      RuntimeLog.error('caught:core/locker.ts', error)
    }
  }

  static async exportCard(filePath: string, fileName: string) {
    try {
      const response = await dialog.showSaveDialog(MainWindow.instance, {
        defaultPath: fileName,
        filters: [{ extensions: ['png'], name: 'Locker card' }],
      })

      if (response.canceled || !response.filePath) {
        return
      }

      await copyFile(filePath, response.filePath)
    } catch (error) {
      RuntimeLog.error('caught:core/locker.ts', error)
    }
  }

  /**
   * Everything the account owns, decorated.
   *
   * Two profiles, because Epic files banners on the homebase side: `athena`
   * holds the locker proper, `common_core` holds `HomebaseBannerIcon` and
   * `HomebaseBannerColor`. The banner half is best-effort — an account that
   * has never played STW still has a perfectly good locker.
   *
   * Cached for ten minutes so opening the page, switching away and coming
   * back is free; `refresh` is what Reload passes to get past it after
   * buying something.
   */
  private static async getOwned(account: AccountData, refresh = false) {
    const cached = Locker.ownedCache.get(account.accountId)

    if (
      !refresh &&
      cached &&
      Date.now() - cached.fetchedAt < Locker.ownedCacheMaxAgeMs
    ) {
      return cached.cosmetics
    }

    const pending = Locker.ownedInFlight.get(account.accountId)

    if (pending) {
      return pending
    }

    const request = Locker.fetchOwned(account).finally(() => {
      Locker.ownedInFlight.delete(account.accountId)
    })

    Locker.ownedInFlight.set(account.accountId, request)

    return request
  }

  private static async fetchOwned(account: AccountData) {
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      throw new Error('Could not authenticate this account')
    }

    const [athena, catalog] = await Promise.all([
      getQueryProfileAthena({ accessToken, accountId: account.accountId }),
      getCosmeticsCatalog(),
    ])

    const templateIds = new Set<string>()

    Object.values(athena.data.profileChanges[0]?.profile.items ?? {}).forEach(
      (item) => {
        if (item.templateId?.includes(':')) {
          templateIds.add(item.templateId)
        }
      }
    )

    try {
      const core = await getQueryProfileMainProfile({
        accessToken,
        accountId: account.accountId,
      })

      Object.values(core.data.profileChanges[0]?.profile.items ?? {}).forEach(
        (item) => {
          if (
            item.templateId?.startsWith('HomebaseBannerIcon:') ||
            item.templateId?.startsWith('HomebaseBannerColor:')
          ) {
            templateIds.add(item.templateId)
          }
        }
      )
    } catch (error) {
      RuntimeLog.error('caught:core/locker.ts', error)
    }

    const cosmetics = [...templateIds].map((templateId) =>
      resolveCosmetic(catalog, templateId)
    )

    Locker.ownedCache.set(account.accountId, {
      cosmetics,
      fetchedAt: Date.now(),
    })

    return cosmetics
  }

  /**
   * Cards go where a user would look for a picture. `pictures` is not
   * guaranteed to resolve on every platform, so the app's own data directory
   * is the fallback.
   */
  private static outputDirectory() {
    try {
      return path.join(app.getPath('pictures'), 'Penny', 'Locker Cards')
    } catch {
      return path.join(app.getPath('userData'), 'locker-cards')
    }
  }

  private static send(channel: ElectronAPIEventKeys, payload: unknown) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}
