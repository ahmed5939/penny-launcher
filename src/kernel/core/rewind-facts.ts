import type { AccountData } from '../../types/accounts'
import type {
  AccountRewindFacts,
  CosmeticLookup,
  RewindFactsPayload,
  StwLookup,
} from '../../features/rewind/facts'
import type { ItemRecordMap } from './item-database'
import type { CosmeticsCatalog } from './locker-catalog'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { peglegImageURL } from '../../config/constants/pegleg'

import { AccountsManager } from '../startup/accounts'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { ItemDatabase } from './item-database'
import { getCosmeticsCatalog, resolveCosmetic, splitTemplateId } from './locker-catalog'

import {
  cosmeticFacts,
  parseBattleRoyale,
  parseGifts,
  parseSaveTheWorld,
} from '../../features/rewind/facts'
import { parseCommander } from '../../features/rewind/stw-facts'
import {
  getQueryProfile,
  getQueryProfileAthena,
  getQueryProfileCommonPublic,
  getQueryProfileMainProfile,
} from '../../services/endpoints/mcp'

/**
 * Penny Rewind's game-profile facts for every linked account: the three
 * profiles read side by side on each account's own Fortnite token, boiled
 * down to counters in `features/rewind/facts.ts` before anything leaves
 * this process. Read only when a Rewind is opened.
 */

export type { AccountRewindFacts, RewindFactsPayload } from '../../features/rewind/facts'

/** Profiles move with every match; a Rewind watched twice in a session needs no second read. */
const factsMaxAgeMs = 30 * 60 * 1000

export class RewindFacts {
  private static results = new Map<string, AccountRewindFacts>()
  private static run: Promise<void> | null = null

  static request(refresh = false) {
    RewindFacts.run ??= RewindFacts.check(Boolean(refresh)).finally(() => {
      RewindFacts.run = null
    })

    return RewindFacts.run
  }

  private static async check(refresh: boolean) {
    const accounts: Record<string, AccountRewindFacts> = {}
    /*
     * The same catalogue the locker pays for, cached a day. Without it the
     * Rewind loses its pictures, not its numbers.
     */
    const catalog = await getCosmeticsCatalog().catch((error: unknown) => {
      RuntimeLog.error('caught:core/rewind-facts.ts (catalogue)', error)

      return null
    })
    const lookup = catalog ? RewindFacts.lookup(catalog) : null
    /* PegLeg's item database, on disk once any page has asked for it: Save the World's names and art. */
    const items = await ItemDatabase.snapshot()
      .then((payload) => (payload.total > 0 ? RewindFacts.stwLookup(payload.records) : null))
      .catch((error: unknown) => {
        RuntimeLog.error('caught:core/rewind-facts.ts (item database)', error)

        return null
      })

    for (const account of AccountsManager.getAccounts().values()) {
      const cached = RewindFacts.results.get(account.accountId)

      if (!refresh && cached?.status === 'ok' && Date.now() - Date.parse(cached.checkedAt) < factsMaxAgeMs) {
        accounts[account.accountId] = cached

        continue
      }

      const entry = await RewindFacts.read(account, lookup, items)

      RewindFacts.results.set(account.accountId, entry)
      accounts[account.accountId] = entry
      RewindFacts.send({ accounts: { [account.accountId]: entry }, complete: false })
    }

    RewindFacts.send({ accounts, complete: true })
  }

  /** Template id → what the Rewind draws: name, tier colours, icon and full-body render. */
  private static lookup(catalog: CosmeticsCatalog): CosmeticLookup {
    return (templateId) => {
      const meta = resolveCosmetic(catalog, templateId)

      if (!meta.resolved) {
        return null
      }

      const raw = catalog.br.get(splitTemplateId(templateId).id.toLowerCase())
      const introduced = Number((raw?.introduction as { backendValue?: unknown } | undefined)?.backendValue)

      return {
        name: meta.name,
        rarity: meta.rarity,
        series: meta.series,
        seriesColors: meta.seriesColors,
        icon: raw?.images?.icon ?? meta.imageUrl,
        featured: raw?.images?.featured ?? null,
        introduced: Number.isInteger(introduced) && introduced > 0 ? introduced : null,
      }
    }
  }

  /** Template id → a Save the World item's name, rarity and PegLeg art. */
  private static stwLookup(records: ItemRecordMap): StwLookup {
    return (templateId) => {
      const item = records[templateId.toLowerCase()]

      if (!item) {
        return null
      }

      const file = templateId.toLowerCase().startsWith('hero:') ? (item.largeImage ?? item.image) : (item.image ?? item.largeImage)

      return {
        name: item.name,
        rarity: item.rarity,
        /* PegLeg's stand-in for every unnamed survivor is a black silhouette. */
        image: file && file !== 'GenericWorker.png' ? peglegImageURL(file) : null,
      }
    }
  }

  /** Each profile on its own: one that fails costs its slides, not the account. */
  private static async read(account: AccountData, lookup: CosmeticLookup | null, items: StwLookup | null): Promise<AccountRewindFacts> {
    const checkedAt = new Date().toISOString()

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        throw new Error('This account is signed out. Sign it in again from Accounts.')
      }

      const options = { accessToken, accountId: account.accountId }
      const quietly = <T>(label: string, read: Promise<{ data: T }>) =>
        read
          .then((response) => response.data as unknown)
          .catch((error: unknown) => {
            RuntimeLog.error(`caught:core/rewind-facts.ts (${label})`, error)

            return null
          })
      const [athena, campaign, commonCore, commonPublic] = await Promise.all([
        quietly('athena', getQueryProfileAthena(options)),
        quietly('campaign', getQueryProfile(options)),
        quietly('common_core', getQueryProfileMainProfile(options)),
        quietly('common_public', getQueryProfileCommonPublic(options)),
      ])

      return {
        status: 'ok',
        battleRoyale: parseBattleRoyale(athena),
        saveTheWorld: parseSaveTheWorld(campaign),
        gifts: parseGifts(commonCore),
        cosmetics: lookup ? cosmeticFacts(athena, lookup) : null,
        commander: parseCommander(campaign, commonPublic, items),
        checkedAt,
      }
    } catch (error) {
      RuntimeLog.error('caught:core/rewind-facts.ts', error)

      return {
        status: 'unknown',
        battleRoyale: null,
        saveTheWorld: null,
        gifts: null,
        checkedAt,
        errorMessage: error instanceof Error ? error.message : 'Could not read this account.',
      }
    }
  }

  private static send(payload: RewindFactsPayload) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(ElectronAPIEventKeys.RewindFactsResponse, payload)
    }
  }
}
