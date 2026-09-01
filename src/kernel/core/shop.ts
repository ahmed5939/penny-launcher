import type { AccountData } from '../../types/accounts'
import type { Rarity } from '../../config/constants/fortnite/items'
import type { StorefrontCatalogResponse } from '../../types/services/storefront'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import { decodeItemTemplate } from '../../config/constants/fortnite/items'

import {
  getQueryProfile,
  getQueryProfileMainProfile,
  populatePrerolledOffers,
  purchaseCatalogEntry,
  setOpenCardPackBatch,
} from '../../services/endpoints/mcp'
import { getPennyDBStwShop } from '../../services/endpoints/pennydb'
import { getCatalog } from '../../services/endpoints/storefront'
import {
  parsePennyDBShop,
  type ShopCatalogPayload,
} from './shop-catalog'

export type {
  ShopCatalogOffer,
  ShopCatalogPayload,
  ShopCatalogStorefront,
  ShopView,
} from './shop-catalog'

/**
 * The three shelves the app surfaces, and the storefronts Epic files them
 * under. `CardPackStoreGameplay` is deliberately left out: those offers are
 * the ones the game hands you mid-match, and they cannot be bought here.
 */
const storefrontSections: Record<string, ShopSection> = {
  CardPackStorePreroll: 'llamas',
  STWSpecialEventStorefront: 'event',
  STWRotationalEventStorefront: 'weekly',
}

/** Currencies whose display name cannot be guessed from the template id. */
const currencyLabels: Record<string, string> = {
  'AccountResource:currency_xrayllama': 'X-Ray Tickets',
  'AccountResource:currency_mtxswap': 'V-Bucks',
  'AccountResource:eventcurrency_scaling': 'Gold',
  'AccountResource:eventcurrency_founder': "Founder's Coins",
}

export type ShopSection = 'llamas' | 'event' | 'weekly'

export const shopSections: Array<ShopSection> = ['llamas', 'event', 'weekly']

export type ShopGrant = {
  templateId: string
  quantity: number
  name: string
  rarity: Rarity | null
  tier: number
  /**
   * Survivors in a pre-rolled llama: the `WorkerPortrait:` template id of the
   * face that copy will come with, so the preview shows the survivor you are
   * actually buying rather than a silhouette.
   */
  portrait: string | null
}

export type ShopOffer = {
  offerId: string
  devName: string
  title: string
  section: ShopSection
  currency: string
  currencySubType: string
  currencyLabel: string
  regularPrice: number
  finalPrice: number
  /** Whether the account's balance covers `finalPrice`. */
  affordable: boolean
  dailyLimit: number
  weeklyLimit: number
  monthlyLimit: number
  /** Cap tied to the current STW event rather than a calendar interval. */
  eventLimit: number
  /** Purchases already made during this offer's active limit window. */
  purchased: number
  /** The account already consumed the exact preroll fulfillment being shown. */
  fulfillmentOwned: boolean
  /** ISO date this specific offer stops being available. */
  saleExpiration: string | null
  itemGrants: Array<ShopGrant>
  /**
   * What this llama will actually contain for this account. Only X-Ray
   * llamas have one; everything else grants what `itemGrants` says.
   */
  preroll: Array<ShopGrant> | null
  sortPriority: number
}

export type ShopCurrency = {
  templateId: string
  label: string
  quantity: number
}

export type ShopEntry = {
  accountId: string
  errorMessage?: string
  /** ISO date the catalog as a whole rotates. */
  expiration: string | null
  offers: Array<ShopOffer>
  currencies: Array<ShopCurrency>
  /** Card packs sitting unopened in the account. */
  unopenedLlamas: number
}

export type ShopPayload = Record<string, ShopEntry>

export type ShopPurchaseNotification = {
  accountId: string
  offerTitle: string
  quantity: number
  errorMessage?: string
}

export type ShopOpenNotification = {
  results: Array<{
    accountId: string
    opened: number
    /** Rarity histogram of everything that dropped, when readable. */
    loot: Partial<Record<Rarity, number>>
    errorMessage?: string
  }>
}

function labelForCurrency(currencySubType: string, currency: string) {
  if (currencyLabels[currencySubType]) {
    return currencyLabels[currencySubType]
  }

  if (currency === 'MtxCurrency') {
    return 'V-Bucks'
  }

  if (currency === 'RealMoney') {
    return 'Real Money'
  }

  const leaf = currencySubType.split(':').pop() ?? currencySubType

  return leaf
    .replace(/^(account|event)?currency_?/i, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function toGrant(
  templateId: string,
  quantity: number,
  portrait?: string | null
): ShopGrant {
  const decoded = decodeItemTemplate(templateId)

  return {
    templateId,
    quantity,
    portrait: portrait ?? null,
    name:
      decoded?.name ??
      (templateId.split(':').pop() ?? templateId)
        .split('_')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    rarity: decoded?.rarity ?? null,
    tier: decoded?.tier ?? 0,
  }
}

function usableExpiration(value: string | null | undefined) {
  if (!value) return null

  const timestamp = new Date(value).getTime()
  const year = new Date(value).getUTCFullYear()

  // Epic uses extreme min/max dates as “no expiry” sentinels. Rendering one
  // produced strings such as “leaves in 7973 years”.
  return Number.isFinite(timestamp) && year >= 2020 && year <= 2100
    ? value
    : null
}

export class Shop {
  static async request(accounts: Array<AccountData>) {
    accounts.forEach((account) => {
      Shop.getShop(account)
        .then((entry) => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.ShopResponse,
            { [account.accountId]: entry } as ShopPayload
          )
        })
        .catch(() => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.ShopResponse,
            {
              [account.accountId]: {
                accountId: account.accountId,
                errorMessage: 'Unknown Error',
                expiration: null,
                offers: [],
                currencies: [],
                unopenedLlamas: 0,
              },
            } as ShopPayload
          )
        })
    })
  }

  /**
   * Public PennyDB catalog. Not a purchase path — `purchase` still talks
   * only to Epic's MCP catalog for the selected account.
   */
  static async requestCatalog() {
    try {
      const response = await getPennyDBStwShop()
      const storefronts = parsePennyDBShop(response.data)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ShopCatalogResponse,
        { storefronts } as ShopCatalogPayload
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ShopCatalogResponse,
        {
          errorMessage:
            error?.response?.data?.errorMessage ??
            error?.message ??
            'Unknown Error',
          storefronts: [],
        } as ShopCatalogPayload
      )
    }
  }

  private static async getShop(account: AccountData) {
    const entry: ShopEntry = {
      accountId: account.accountId,
      expiration: null,
      offers: [],
      currencies: [],
      unopenedLlamas: 0,
    }
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      entry.errorMessage = 'Unknown Error'

      return entry
    }

    /**
     * `PopulatePrerolledOffers` is what the game itself calls when you walk
     * into the llama store: it fills in this account's X-Ray rolls. Its own
     * response is a profile *delta*, so the profile is read back separately
     * rather than trusting the command to return every item.
     */
    await populatePrerolledOffers({
      accessToken,
      accountId: account.accountId,
    })

    const [profile, commonCore, catalog] = await Promise.all([
      getQueryProfile({
        accessToken,
        accountId: account.accountId,
      }),
      getQueryProfileMainProfile({
        accessToken,
        accountId: account.accountId,
      }),
      getCatalog({ accessToken }),
    ])

    const items = profile.data.profileChanges[0]?.profile.items ?? {}
    const prerollsByOfferId = new Map<
      string,
      { fulfillmentId: string; grants: Array<ShopGrant> }
    >()

    Object.values(items).forEach((item) => {
      if (item.templateId.startsWith('AccountResource:')) {
        const quantity = (item as { quantity?: number }).quantity ?? 0

        if (quantity > 0) {
          entry.currencies.push({
            templateId: item.templateId,
            label: labelForCurrency(item.templateId, 'GameItem'),
            quantity,
          })
        }

        return
      }

      if (item.templateId.startsWith('CardPack:')) {
        entry.unopenedLlamas += (item as { quantity?: number }).quantity ?? 1

        return
      }

      if (!item.templateId.startsWith('PrerollData:')) {
        return
      }

      const attributes = (item.attributes ?? {}) as Partial<{
        offerId: string
        fulfillmentId: string
        items: Array<{
          itemType?: string
          quantity?: number
          attributes?: { portrait?: string }
        }>
      }>

      if (!attributes.offerId) {
        return
      }

      prerollsByOfferId.set(
        attributes.offerId,
        {
          fulfillmentId: attributes.fulfillmentId ?? '',
          grants: (attributes.items ?? [])
            .filter((grant) => typeof grant.itemType === 'string')
            .map((grant) =>
              toGrant(
                grant.itemType as string,
                grant.quantity ?? 1,
                grant.attributes?.portrait
              )
            )
        }
      )
    })

    const balances = new Map(
      entry.currencies.map((currency) => [
        currency.templateId,
        currency.quantity,
      ])
    )
    const commonProfile = commonCore.data.profileChanges[0]?.profile
    const fulfillmentCounts =
      commonProfile?.stats.attributes.in_app_purchases?.fulfillmentCounts ?? {}
    const purchaseCounts = new Map<string, number>()
    const addPurchases = (values: Record<string, number> | undefined) => {
      Object.entries(values ?? {}).forEach(([offerId, count]) => {
        purchaseCounts.set(
          offerId,
          Math.max(purchaseCounts.get(offerId) ?? 0, count)
        )
      })
    }

    addPurchases(commonProfile?.stats.attributes.daily_purchases?.purchaseList)
    addPurchases(commonProfile?.stats.attributes.weekly_purchases?.purchaseList)
    addPurchases(commonProfile?.stats.attributes.monthly_purchases?.purchaseList)
    Object.values(commonProfile?.items ?? {}).forEach((item) =>
      addPurchases(item.attributes?.event_purchases)
    )

    entry.expiration = catalog.data.expiration ?? null
    entry.offers = Shop.parseCatalog(
      catalog.data,
      prerollsByOfferId,
      balances,
      purchaseCounts,
      fulfillmentCounts
    )
    entry.currencies.sort((currencyA, currencyB) =>
      currencyA.label.localeCompare(currencyB.label)
    )

    return entry
  }

  private static parseCatalog(
    catalog: StorefrontCatalogResponse,
    prerollsByOfferId: Map<
      string,
      { fulfillmentId: string; grants: Array<ShopGrant> }
    >,
    balances: Map<string, number>,
    purchaseCounts: Map<string, number>,
    fulfillmentCounts: Record<string, number>
  ) {
    const offers: Array<ShopOffer> = []

    catalog.storefronts.forEach((storefront) => {
      const section = storefrontSections[storefront.name]

      if (!section) {
        return
      }

      storefront.catalogEntries.forEach((catalogEntry) => {
        const price = catalogEntry.prices[0]

        if (!price) {
          return
        }

        const balance = balances.get(price.currencySubType) ?? 0
        const eventLimit = Number(catalogEntry.meta?.EventLimit ?? -1)
        const purchaseKey =
          catalogEntry.meta?.PurchaseLimitingEventId || catalogEntry.offerId
        const preroll = prerollsByOfferId.get(catalogEntry.offerId) ?? null

        offers.push({
          offerId: catalogEntry.offerId,
          devName: catalogEntry.devName,
          title:
            catalogEntry.title ??
            catalogEntry.devName.split('.').pop() ??
            catalogEntry.devName,
          section,
          currency: price.currencyType,
          currencySubType: price.currencySubType,
          currencyLabel: labelForCurrency(
            price.currencySubType,
            price.currencyType
          ),
          regularPrice: price.regularPrice,
          finalPrice: price.finalPrice,
          affordable: price.finalPrice <= balance,
          dailyLimit: catalogEntry.dailyLimit,
          weeklyLimit: catalogEntry.weeklyLimit,
          monthlyLimit: catalogEntry.monthlyLimit,
          eventLimit: Number.isFinite(eventLimit) ? eventLimit : -1,
          purchased:
            purchaseCounts.get(purchaseKey) ??
            purchaseCounts.get(catalogEntry.offerId) ??
            0,
          fulfillmentOwned:
            !!preroll?.fulfillmentId &&
            (fulfillmentCounts[preroll.fulfillmentId] ?? 0) > 0,
          saleExpiration: usableExpiration(price.saleExpiration),
          itemGrants: catalogEntry.itemGrants.map((grant) =>
            toGrant(grant.templateId, grant.quantity)
          ),
          preroll: preroll?.grants ?? null,
          sortPriority: catalogEntry.sortPriority,
        })
      })
    })

    /** Highest sort priority first, which is the order the game shows. */
    offers.sort((offerA, offerB) => {
      if (offerA.sortPriority !== offerB.sortPriority) {
        return offerB.sortPriority - offerA.sortPriority
      }

      return offerA.title.localeCompare(offerB.title)
    })

    return offers
  }

  static async purchase(
    account: AccountData,
    offer: {
      offerId: string
      title: string
      currency: string
      currencySubType: string
      finalPrice: number
      quantity: number
    }
  ) {
    const notification: ShopPurchaseNotification = {
      accountId: account.accountId,
      offerTitle: offer.title,
      quantity: offer.quantity,
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        notification.errorMessage = 'Unknown Error'
      } else {
        /*
         * X-Ray offers are backed by account-specific preroll data. Epic can
         * invalidate that data after the shop was loaded (and does so for the
         * daily free Upgrade Llama), so refresh it at checkout just like the
         * working auto-llama purchase path does.
         */
        await populatePrerolledOffers({
          accessToken,
          accountId: account.accountId,
        })

        await purchaseCatalogEntry({
          accessToken,
          accountId: account.accountId,
          offerId: offer.offerId,
          currency: offer.currency,
          currencySubType: offer.currencySubType,
          purchaseQuantity: offer.quantity,
          expectedTotalPrice: offer.finalPrice * offer.quantity,
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      notification.errorMessage =
        error?.response?.data?.errorMessage ?? 'Unknown Error'
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ShopPurchaseNotification,
      notification
    )

    await Shop.request([account])
  }

  /**
   * Opens every unopened card pack on each account.
   *
   * The loot histogram is parsed defensively — the notification payload is
   * not pinned down by the endpoint documentation, so an unreadable response
   * degrades to "opened N" rather than failing the operation.
   */
  static async openLlamas(accounts: Array<AccountData>) {
    const results: ShopOpenNotification['results'] = []

    await Promise.allSettled(
      accounts.map(async (account) => {
        const result = {
          accountId: account.accountId,
          opened: 0,
          loot: {},
        } as ShopOpenNotification['results'][number]

        try {
          const accessToken =
            await Authentication.verifyAccessToken(account)

          if (!accessToken) {
            result.errorMessage = 'Unknown Error'
            results.push(result)

            return
          }

          const profile = await getQueryProfile({
            accessToken,
            accountId: account.accountId,
          })
          const items = profile.data.profileChanges[0]?.profile.items ?? {}
          const cardPackItemIds = Object.entries(items)
            .filter(([, item]) => item.templateId.startsWith('CardPack:'))
            .map(([itemId]) => itemId)

          if (cardPackItemIds.length <= 0) {
            results.push(result)

            return
          }

          const response = await setOpenCardPackBatch({
            accessToken,
            accountId: account.accountId,
            cardPackItemIds,
          })

          result.opened = cardPackItemIds.length
          result.loot = Shop.parseLoot(response.data)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          result.errorMessage =
            error?.response?.data?.errorMessage ?? 'Unknown Error'
        }

        results.push(result)
      })
    )

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ShopOpenNotification,
      { results } as ShopOpenNotification
    )
  }

  private static parseLoot(response: unknown) {
    const loot: Partial<Record<Rarity, number>> = {}
    const notifications = (
      response as {
        notifications?: Array<{
          lootGranted?: { items?: Array<{ itemType?: string }> }
        }>
      }
    )?.notifications

    if (!Array.isArray(notifications)) {
      return loot
    }

    notifications.forEach((notification) => {
      notification.lootGranted?.items?.forEach((item) => {
        const decoded =
          typeof item.itemType === 'string'
            ? decodeItemTemplate(item.itemType)
            : null

        if (!decoded) {
          return
        }

        loot[decoded.rarity] = (loot[decoded.rarity] ?? 0) + 1
      })
    })

    return loot
  }
}
