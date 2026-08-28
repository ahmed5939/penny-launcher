import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'
import { RuntimeLog } from '../runtime-log'

import { getQueryProfileAthena, getQueryProfileMainProfile } from '../../services/endpoints/mcp'
import { findUsersByAccountIds } from '../../services/endpoints/lookup'

/**
 * Gift history — who gifted cosmetics to an account, and when.
 *
 * Two Epic profiles carry the story: `common_core` keeps aggregate counters
 * (`gift_history.num_received` and a `receivedFrom` map of the last gift per
 * sender), while `athena` stamps every gifted locker item with a
 * `giftFromAccountId` attribute. This joins the two, resolves the sender ids
 * to display names, and decorates each cosmetic with its public metadata so
 * the renderer never has to talk to fortnite-api.com itself.
 */
export type GiftsInformationCosmetic = {
  /** e.g. `AthenaCharacter:cid_030_athena_commando_f_halloween`. */
  templateId: string
  /** The id fortnite-api.com keys its catalogue and images by. */
  cosmeticId: string | null
  name: string
  image: string | null
  type: string | null
  rarity: string | null
  /** ISO date the item landed in the locker, when Epic recorded one. */
  creationTime: string | null
}

export type GiftsInformationSender = {
  accountId: string
  displayName: string
  /** Last gift from this sender, from `receivedFrom` or the newest item. */
  lastGiftDate: string | null
  cosmetics: Array<GiftsInformationCosmetic>
}

export type GiftsInformationEntry = {
  accountId: string
  errorMessage?: string
  /** `gift_history.num_received` — Epic's own counter. */
  numReceived: number
  /** `gift_history.num_sent` — kept for the summary strip. */
  numSent: number
  senders: Array<GiftsInformationSender>
}

export type GiftsInformationPayload = Record<string, GiftsInformationEntry>

type CosmeticsCatalogue = Map<
  string,
  { name: string; image: string | null; type: string | null; rarity: string | null }
>

/** Re-downloaded roughly daily; the catalogue only moves when Fortnite patches. */
const cosmeticsCacheMaxAgeMs = 24 * 60 * 60 * 1000

let cosmeticsCatalogue: CosmeticsCatalogue | null = null
let cosmeticsCatalogueFetchedAt = 0
let cosmeticsCatalogueRequest: Promise<CosmeticsCatalogue | null> | null = null

function prettifyTemplateId(templateId: string) {
  const leaf = templateId.split(':').pop() ?? templateId

  return leaf
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

async function getCatalogue(): Promise<CosmeticsCatalogue | null> {
  if (
    cosmeticsCatalogue &&
    Date.now() - cosmeticsCatalogueFetchedAt < cosmeticsCacheMaxAgeMs
  ) {
    return cosmeticsCatalogue
  }

  if (!cosmeticsCatalogueRequest) {
    cosmeticsCatalogueRequest = (async () => {
      try {
        const response = await fetch(
          'https://fortnite-api.com/v2/cosmetics/br',
          { signal: AbortSignal.timeout(15_000) }
        )

        if (!response.ok) {
          return null
        }

        const body = (await response.json()) as {
          data?: Array<{
            id?: string
            name?: string
            type?: { displayValue?: string }
            rarity?: { displayValue?: string }
            images?: { smallIcon?: string; icon?: string }
          }>
        }
        const catalogue: CosmeticsCatalogue = new Map()

        body.data?.forEach((cosmetic) => {
          if (!cosmetic.id) {
            return
          }

          catalogue.set(cosmetic.id.toLowerCase(), {
            name: cosmetic.name || cosmetic.id,
            image: cosmetic.images?.smallIcon ?? cosmetic.images?.icon ?? null,
            type: cosmetic.type?.displayValue ?? null,
            rarity: cosmetic.rarity?.displayValue ?? null,
          })
        })

        cosmeticsCatalogue = catalogue
        cosmeticsCatalogueFetchedAt = Date.now()

        return catalogue

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        RuntimeLog.error('caught:core/gifts-information.ts', error)

        return null
      } finally {
        cosmeticsCatalogueRequest = null
      }
    })()
  }

  return cosmeticsCatalogueRequest
}

function toCosmetic(
  catalogue: CosmeticsCatalogue | null,
  templateId: string,
  creationTime: string | null
): GiftsInformationCosmetic {
  const cosmeticId = templateId.split(':')[1] ?? null
  const entry = cosmeticId
    ? catalogue?.get(cosmeticId.toLowerCase())
    : undefined

  return {
    templateId,
    cosmeticId,
    name: entry?.name ?? prettifyTemplateId(templateId),
    image: entry?.image ?? null,
    type: entry?.type ?? null,
    rarity: entry?.rarity ?? null,
    creationTime,
  }
}

export class GiftsInformation {
  static async requestBulkInfo(accounts: Array<AccountData>) {
    accounts.forEach((account) => {
      GiftsInformation.getInfo(account)
        .then((entry) => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.GiftsInformationResponseData,
            { [account.accountId]: entry } as GiftsInformationPayload
          )
        })
        .catch(() => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.GiftsInformationResponseData,
            {
              [account.accountId]: {
                accountId: account.accountId,
                errorMessage: 'Unknown Error',
                numReceived: 0,
                numSent: 0,
                senders: [],
              },
            } as GiftsInformationPayload
          )
        })
    })
  }

  static async getInfo(account: AccountData): Promise<GiftsInformationEntry> {
    const entry: GiftsInformationEntry = {
      accountId: account.accountId,
      numReceived: 0,
      numSent: 0,
      senders: [],
    }

    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      entry.errorMessage = 'Unknown Error'

      return entry
    }

    try {
      const [commonCore, athena, catalogue] = await Promise.all([
        getQueryProfileMainProfile({
          accessToken,
          accountId: account.accountId,
        }),
        getQueryProfileAthena({
          accessToken,
          accountId: account.accountId,
        }),
        getCatalogue(),
      ])

      const giftHistory =
        commonCore.data.profileChanges[0]?.profile.stats.attributes
          .gift_history

      entry.numReceived = giftHistory?.num_received ?? 0
      entry.numSent = giftHistory?.num_sent ?? 0
      const receivedFrom = giftHistory?.receivedFrom ?? {}

      const items = athena.data.profileChanges[0]?.profile.items ?? {}
      const cosmeticsBySender = new Map<string, GiftsInformationCosmetic[]>()

      Object.values(items).forEach((item) => {
        const sender = item.attributes.giftFromAccountId

        if (!sender) {
          return
        }

        const cosmetics = cosmeticsBySender.get(sender) ?? []

        cosmetics.push(
          toCosmetic(
            catalogue,
            item.templateId,
            item.attributes.creation_time ?? null
          )
        )
        cosmeticsBySender.set(sender, cosmetics)
      })

      const senderIds = new Set<string>([
        ...Object.keys(receivedFrom),
        ...cosmeticsBySender.keys(),
      ])

      const displayNames = await GiftsInformation.resolveDisplayNames({
        accessToken,
        accountIds: [...senderIds],
      })

      entry.senders = [...senderIds].map((senderId) => {
        const cosmetics = cosmeticsBySender.get(senderId) ?? []

        // Newest first; undated gifts sink to the end of their sender.
        cosmetics.sort((cosmeticA, cosmeticB) => {
          if (!cosmeticA.creationTime) return 1
          if (!cosmeticB.creationTime) return -1

          return cosmeticB.creationTime.localeCompare(cosmeticA.creationTime)
        })

        return {
          accountId: senderId,
          displayName: displayNames.get(senderId) ?? senderId,
          lastGiftDate:
            receivedFrom[senderId] ?? cosmetics[0]?.creationTime ?? null,
          cosmetics,
        }
      })

      // Most generous sender first, then the most recent gift.
      entry.senders.sort((senderA, senderB) => {
        const byCount =
          senderB.cosmetics.length - senderA.cosmetics.length

        if (byCount !== 0) {
          return byCount
        }

        if (!senderA.lastGiftDate) return 1
        if (!senderB.lastGiftDate) return -1

        return senderB.lastGiftDate.localeCompare(senderA.lastGiftDate)
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      RuntimeLog.error('caught:core/gifts-information.ts', error)
      entry.errorMessage =
        error?.response?.data?.errorMessage ?? 'Unknown Error'
    }

    return entry
  }

  /** Epic accepts 100 ids per call; friend lists routinely run past that. */
  private static async resolveDisplayNames({
    accessToken,
    accountIds,
  }: {
    accessToken: string
    accountIds: Array<string>
  }) {
    const displayNames = new Map<string, string>()

    for (let index = 0; index < accountIds.length; index += 100) {
      try {
        const response = await findUsersByAccountIds({
          accessToken,
          accountIds: accountIds.slice(index, index + 100),
        })

        response.data.forEach((account) => {
          if (account.displayName) {
            displayNames.set(account.id, account.displayName)
          }
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        RuntimeLog.error('caught:core/gifts-information.ts', error)
      }
    }

    return displayNames
  }
}
