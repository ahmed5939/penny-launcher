import type { AccountData } from '../../types/accounts'
import type { SpriteCatalogResponse } from '../../types/services/sprites'
import type { SpriteCollection } from './sprite-collection'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { eosToken } from './locker'
import { buildSpriteCollection } from './sprite-collection'

import {
  getSpriteCatalog,
  getSpriteInventory,
} from '../../services/endpoints/sprites'

/**
 * The sprite collection, fetched.
 *
 * Two documents make the page: the catalogue (what exists — a game-service
 * call on an ordinary token) and the account's inventory (what it holds — an
 * EOS inventory behind the locker's gateway and token). The join itself is
 * `buildSpriteCollection` in `sprite-collection.ts`.
 */

export type {
  SpriteCollection,
  SpriteEntry,
  SpriteFamilySummary,
  SpriteVariantKey,
} from './sprite-collection'

export type SpritesPayload = {
  accountId: string
  errorMessage?: string
  collection: SpriteCollection | null
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (
      error as {
        response?: { status?: number; data?: { errorMessage?: string } }
      }
    ).response

    if (response?.data?.errorMessage) {
      return response.data.errorMessage
    }

    if (response?.status) {
      return `Request failed with status ${response.status}`
    }
  }

  return error instanceof Error ? error.message : 'Unknown error'
}

export class Sprites {
  /**
   * The catalogue is the same for every account and only changes with a
   * patch; the inventory is per account and changes every match. Only the
   * former is cached, and briefly.
   */
  private static catalog: {
    data: SpriteCatalogResponse
    fetchedAt: number
  } | null = null

  private static catalogMaxAgeMs = 60 * 60 * 1000

  /**
   * Either half may fail without taking the page down: the bundled data file
   * can draw the whole collection on its own, so a broken catalogue costs
   * summon costs and a broken inventory costs ownership — each with a
   * warning, never a blank tab.
   */
  static async request(account: AccountData, refresh = false) {
    const payload: SpritesPayload = {
      accountId: account.accountId,
      collection: null,
    }
    const problems: Array<string> = []

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        throw new Error('Could not authenticate this account')
      }

      const [catalog, inventory] = await Promise.all([
        Sprites.getCatalog(accessToken, refresh).catch((error: unknown) => {
          RuntimeLog.error('caught:core/sprites.ts (catalog)', error)
          problems.push(`Catalogue: ${errorMessage(error)}`)

          return {}
        }),
        Sprites.getInventory(account).catch((error: unknown) => {
          RuntimeLog.error('caught:core/sprites.ts (inventory)', error)
          problems.push(`Collection: ${errorMessage(error)}`)

          return null
        }),
      ])

      payload.collection = buildSpriteCollection(catalog, inventory)

      RuntimeLog.info(
        'core/sprites.ts',
        `catalog relics=${Object.keys(catalog).length}; ` +
          `inventory modules=${inventory?.inventory?.length ?? 'none'} ` +
          `counts=${
            inventory?.inventory?.reduce(
              (n, module) => n + Object.keys(module.counts ?? {}).length,
              0
            ) ?? 0
          }`
      )
    } catch (error) {
      RuntimeLog.error('caught:core/sprites.ts', error)
      problems.push(errorMessage(error))
    }

    if (problems.length > 0) {
      payload.errorMessage = problems.join(' — ')
    }

    Sprites.send(ElectronAPIEventKeys.SpritesResponse, payload)
  }

  private static async getCatalog(accessToken: string, refresh: boolean) {
    const cached = Sprites.catalog

    if (
      !refresh &&
      cached &&
      Date.now() - cached.fetchedAt < Sprites.catalogMaxAgeMs
    ) {
      return cached.data
    }

    const response = await getSpriteCatalog({ accessToken })
    const data = response.data ?? {}

    if (Object.keys(data).length > 0) {
      Sprites.catalog = { data, fetchedAt: Date.now() }
    }

    return data
  }

  /**
   * The inventory is best-effort: an account that has never played this
   * season still gets the full catalogue, shown as all-missing, rather than
   * an error page.
   */
  private static async getInventory(account: AccountData) {
    const token = await eosToken(account)

    if (!token) {
      throw new Error('Could not authenticate this account with EOS')
    }

    try {
      const response = await getSpriteInventory({
        accessToken: token,
        accountId: account.accountId,
      })

      /*
       * Logged raw (redacted, truncated) because the count-state semantics
       * were reverse-engineered from emulators — if ownership ever reads
       * wrong, this line is the evidence needed to correct it.
       */
      RuntimeLog.info(
        'core/sprites.ts (inventory)',
        JSON.stringify(response.data).slice(0, 4000)
      )

      return response.data ?? null
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response
        ?.status

      if (status === 404) {
        RuntimeLog.info(
          'core/sprites.ts (inventory)',
          'answered 404 — no relic inventory on this account'
        )

        return null
      }

      throw error
    }
  }

  private static send(channel: ElectronAPIEventKeys, payload: unknown) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}
