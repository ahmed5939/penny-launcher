import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'
import { RuntimeLog } from '../runtime-log'

import { getQueryProfileAthena, getQueryProfileMainProfile } from '../../services/endpoints/mcp'
import { findUsersByAccountIds } from '../../services/endpoints/lookup'
import {
  type CosmeticsCatalog,
  getCosmeticsCatalog,
  prettifyCosmeticId,
  resolveCosmetic,
  splitTemplateId,
} from './locker-catalog'

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

/**
 * Names and art come from the locker's shared catalogue, which spans every
 * fortnite-api document — a gifted jam track (`SparksSong:`), instrument or
 * car part is not in the BR list, and resolving against that alone left them
 * as a prettified slug with no picture.
 */
function toCosmetic(
  catalog: CosmeticsCatalog | null,
  templateId: string,
  creationTime: string | null
): GiftsInformationCosmetic {
  const { backendType, id } = splitTemplateId(templateId)
  const cosmeticId = id || null

  if (!catalog) {
    return {
      templateId,
      cosmeticId,
      name: prettifyCosmeticId(id),
      image: null,
      type: null,
      rarity: null,
      creationTime,
    }
  }

  const meta = resolveCosmetic(catalog, templateId)
  const key = id.toLowerCase()

  /*
   * The page shows Epic's display strings ("Outfit", "Icon Series"), which
   * `CosmeticMeta` folds away, so they are read off the raw entry. Jam
   * tracks have no type or rarity of their own.
   */
  const raw =
    catalog.br.get(key) ??
    catalog.br.get(key.split(':')[0]) ??
    catalog.instruments.get(key) ??
    catalog.cars.get(key)
  const isTrack = backendType === 'SparksSong' && meta.resolved

  return {
    templateId,
    cosmeticId,
    name: meta.name,
    image: meta.imageUrl,
    type: isTrack ? 'Jam Track' : (raw?.type?.displayValue ?? null),
    rarity: isTrack ? null : (raw?.rarity?.displayValue ?? null),
    creationTime,
  }
}

async function getCatalog() {
  try {
    return await getCosmeticsCatalog()
  } catch (error) {
    RuntimeLog.error('caught:core/gifts-information.ts', error)

    return null
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
        getCatalog(),
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
