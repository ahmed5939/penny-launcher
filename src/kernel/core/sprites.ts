import type { AccountData } from '../../types/accounts'
import type {
  SpriteCatalogResponse,
  SpriteInventoryResponse,
} from '../../types/services/sprites'
import type { SpriteCollection } from './sprite-collection'
import type { CatalogueStatus } from './sprite-history-model'

import { randomUUID } from 'node:crypto'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { AccountsManager } from '../startup/accounts'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { buildSpriteCollection } from './sprite-collection'
import { SpriteHistory } from './sprite-history'

import {
  spriteModuleVersion,
  spriteModuleVersionCandidates,
} from '../../services/config/sprites'
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
 * `buildSpriteCollection` in `sprite-collection.ts`; what changed since the
 * last read is `SpriteHistory` in `sprite-history.ts`.
 */

export type {
  SpriteCollection,
  SpriteEntry,
  SpriteFamilySummary,
  SpriteVariantKey,
} from './sprite-collection'
export type { CatalogueStatus } from './sprite-history-model'
export { SpriteHistory } from './sprite-history'

export type SpritesPayload = {
  accountId: string
  errorMessage?: string
  collection: SpriteCollection | null
  /** New and unknown relics, and whether Epic moved the catalogue. */
  catalogue: CatalogueStatus | null
}

/**
 * One message of an all-accounts sweep. `start` names the accounts about to
 * be read, `account` arrives as each one lands, `done` closes the sweep.
 * Every message carries the sweep's id, so a view that opened mid-sweep can
 * tell a replay of this sweep from the start of the next.
 */
export type SpritesAllAccountPayload = {
  kind: 'account'
  sweepId: string
  accountId: string
  displayName: string
  /** 1-based position of this account in the sweep. */
  index: number
  total: number
  /** Null when the account could not be read at all. */
  collection: SpriteCollection | null
  errorMessage?: string
}

export type SpritesAllPayload =
  | {
      kind: 'start'
      sweepId: string
      total: number
      accounts: Array<{ accountId: string; displayName: string }>
    }
  | SpritesAllAccountPayload
  | {
      kind: 'done'
      sweepId: string
      total: number
      catalogue: CatalogueStatus | null
      /** Set when the shared catalogue read failed; costs, not ownership. */
      catalogueError?: string
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

function statusOf(error: unknown) {
  return (error as { response?: { status?: number } } | null)?.response
    ?.status
}

function displayNameOf(account: AccountData) {
  return account.customDisplayName?.trim() || account.displayName
}

/**
 * A pause between accounts in a sweep. Each read is three token hops and an
 * inventory call; spacing them keeps a sweep of many accounts from looking
 * like a burst from one machine.
 */
const sweepGapMs = 750

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

type InventoryRead = {
  inventory: SpriteInventoryResponse | null
  /**
   * The inventory answered with a document. Only these reads are
   * remembered: a failure — or a 404 for an account with no relics yet —
   * says nothing about what the account holds.
   */
  answered: boolean
  problem: string | null
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

  /** The catalogue version that answers this session. */
  private static catalogVersion = Number(spriteModuleVersion)

  /** The 404 probe runs at most once per launch. */
  private static versionProbed = false

  /** The sweep in progress, with what it has sent so far. */
  private static sweep: { sent: Array<SpritesAllPayload> } | null = null

  /**
   * Either half may fail without taking the page down: the bundled data file
   * can draw the whole collection on its own, so a broken catalogue costs
   * summon costs and a broken inventory costs ownership — each with a
   * warning, never a blank tab.
   */
  static async request(input: AccountData, refresh = false) {
    // The renderer's copy has its secrets stripped; read with the real one.
    const account = AccountsManager.getAccountById(input.accountId) ?? input
    const payload: SpritesPayload = {
      accountId: account.accountId,
      collection: null,
      catalogue: null,
    }
    const problems: Array<string> = []

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        throw new Error('Could not authenticate this account')
      }

      const [catalog, read] = await Promise.all([
        Sprites.getCatalog(accessToken, refresh).catch((error: unknown) => {
          RuntimeLog.error('caught:core/sprites.ts (catalog)', error)
          problems.push(`Catalogue: ${errorMessage(error)}`)

          return {}
        }),
        Sprites.readInventory(account),
      ])

      if (read.problem) {
        problems.push(`Collection: ${read.problem}`)
      }

      payload.collection = buildSpriteCollection(catalog, read.inventory)

      RuntimeLog.info(
        'core/sprites.ts',
        `catalog relics=${Object.keys(catalog).length}; ` +
          `inventory modules=${read.inventory?.inventory?.length ?? 'none'}`
      )

      if (read.answered) {
        await SpriteHistory.record(
          { accountId: account.accountId, displayName: displayNameOf(account) },
          payload.collection
        )
      }
    } catch (error) {
      RuntimeLog.error('caught:core/sprites.ts', error)
      problems.push(errorMessage(error))
    }

    payload.catalogue = await SpriteHistory.catalogueStatus().catch(
      () => null
    )

    if (problems.length > 0) {
      payload.errorMessage = problems.join(' — ')
    }

    Sprites.send(ElectronAPIEventKeys.SpritesResponse, payload)
  }

  /**
   * Every linked account, one after another.
   *
   * Sequential on purpose: an account's token can only read its own
   * inventory, so there is no shortcut, and reading seven at once is seven
   * token chains at once. Each account's result is sent the moment it lands
   * so the grid fills in as the sweep goes. The catalogue is read once, on
   * the first account that can sign in, and shared.
   *
   * A second request while a sweep runs does not start another: it replays
   * what this one has sent so far, and the running sweep sends the rest.
   */
  static async requestAll(
    refresh = false,
    { background = false }: { background?: boolean } = {}
  ) {
    if (Sprites.sweep) {
      Sprites.sweep.sent.forEach((payload) =>
        Sprites.send(ElectronAPIEventKeys.SpritesAllResponse, payload)
      )

      return
    }

    const sweep = { sent: [] as Array<SpritesAllPayload> }
    const sweepId = randomUUID()
    const emit = (payload: SpritesAllPayload) => {
      sweep.sent.push(payload)
      Sprites.send(ElectronAPIEventKeys.SpritesAllResponse, payload)
    }

    Sprites.sweep = sweep

    const accounts = [...AccountsManager.getAccounts().values()]
    const total = accounts.length
    let catalog: SpriteCatalogResponse | null = null
    let catalogueError: string | undefined

    try {
      emit({
        kind: 'start',
        sweepId,
        total,
        accounts: accounts.map((account) => ({
          accountId: account.accountId,
          displayName: displayNameOf(account),
        })),
      })

      for (const [position, listed] of accounts.entries()) {
        if (position > 0) {
          await wait(sweepGapMs)
        }

        const account = AccountsManager.getAccountById(listed.accountId)
        const base = {
          kind: 'account' as const,
          sweepId,
          accountId: listed.accountId,
          displayName: displayNameOf(account ?? listed),
          index: position + 1,
          total,
        }

        if (!account) {
          emit({
            ...base,
            collection: null,
            errorMessage: 'Removed from Penny during the sweep.',
          })

          continue
        }

        try {
          const accessToken = await Authentication.verifyAccessToken(account)

          if (!accessToken) {
            throw new Error('Could not authenticate this account')
          }

          if (catalog === null && catalogueError === undefined) {
            catalog = await Sprites.getCatalog(accessToken, refresh).catch(
              (error: unknown) => {
                RuntimeLog.error('caught:core/sprites.ts (catalog)', error)
                catalogueError = errorMessage(error)

                return null
              }
            )
          }

          const read = await Sprites.readInventory(account)

          if (!read.answered && read.problem) {
            emit({ ...base, collection: null, errorMessage: read.problem })

            continue
          }

          const collection = buildSpriteCollection(catalog ?? {}, read.inventory)

          if (read.answered) {
            await SpriteHistory.record(
              { accountId: account.accountId, displayName: base.displayName },
              collection,
              { notify: background }
            )
          }

          emit({ ...base, collection })
        } catch (error) {
          RuntimeLog.error('caught:core/sprites.ts (sweep)', error)
          emit({ ...base, collection: null, errorMessage: errorMessage(error) })
        }
      }
    } finally {
      emit({
        kind: 'done',
        sweepId,
        total,
        catalogue: await SpriteHistory.catalogueStatus().catch(() => null),
        catalogueError,
      })

      Sprites.sweep = null

      RuntimeLog.info(
        'core/sprites.ts (sweep)',
        `${background ? 'watch' : 'requested'} sweep of ${total} accounts done`
      )
    }
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

    const data = await Sprites.fetchCatalog(accessToken)

    if (Object.keys(data).length > 0) {
      Sprites.catalog = { data, fetchedAt: Date.now() }

      // Private entries are unreleased; they become news when they ship.
      await SpriteHistory.observeCatalogue(
        Object.entries(data)
          .filter(([, entry]) => !entry?._private)
          .map(([relicId]) => relicId)
      ).catch((error: unknown) => {
        RuntimeLog.error('caught:core/sprites.ts (catalogue history)', error)
      })
    }

    return data
  }

  /**
   * The catalogue at the session's version, following Epic once if it moved.
   *
   * Epic bumps the schema version with the relic format and the old one
   * starts answering 404. Rather than lose summon costs until the next app
   * update, the next few versions are tried once per launch and the first
   * that answers is used for the rest of it. Ownership never depends on
   * this — only costs and new-relic detection do.
   */
  private static async fetchCatalog(accessToken: string) {
    try {
      const response = await getSpriteCatalog({
        accessToken,
        version: Sprites.catalogVersion,
      })

      return response.data ?? {}
    } catch (error) {
      if (statusOf(error) !== 404 || Sprites.versionProbed) {
        throw error
      }

      Sprites.versionProbed = true

      for (const version of spriteModuleVersionCandidates) {
        if (version === Sprites.catalogVersion) {
          continue
        }

        try {
          const response = await getSpriteCatalog({ accessToken, version })
          const data = response.data ?? {}

          if (Object.keys(data).length === 0) {
            continue
          }

          Sprites.catalogVersion = version
          RuntimeLog.info(
            'core/sprites.ts (catalog)',
            `version ${spriteModuleVersion} answered 404; following version ${version} for this session`
          )
          SpriteHistory.setCatalogueVersion(
            version,
            `Epic moved the sprite catalogue to version ${version}; Penny is following it.`
          )

          return data
        } catch (probeError) {
          RuntimeLog.info(
            'core/sprites.ts (catalog)',
            `version ${version} probe: ${errorMessage(probeError)}`
          )
        }
      }

      RuntimeLog.info(
        'core/sprites.ts (catalog)',
        `version ${spriteModuleVersion} answered 404 and no later version answered`
      )
      SpriteHistory.setCatalogueVersion(
        Sprites.catalogVersion,
        'Epic moved the sprite catalogue and Penny could not find the new one, so summon costs are unavailable until Penny updates.'
      )

      throw error
    }
  }

  /**
   * The inventory is best-effort: an account that has never played this
   * season still gets the full catalogue, shown as all-missing, rather than
   * an error page.
   */
  private static async readInventory(
    account: AccountData
  ): Promise<InventoryRead> {
    try {
      /*
       * The locker module is large and only its token helper is needed, so
       * it is loaded on first read rather than with this one — the watch
       * imports this module at startup and should cost nothing until then.
       */
      const { eosToken } = await import('./locker')
      const token = await eosToken(account)

      if (!token) {
        throw new Error('Could not authenticate this account with EOS')
      }

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

      return {
        inventory: response.data ?? null,
        answered: Boolean(response.data),
        problem: null,
      }
    } catch (error) {
      if (statusOf(error) === 404) {
        RuntimeLog.info(
          'core/sprites.ts (inventory)',
          'answered 404 — no relic inventory on this account'
        )

        return { inventory: null, answered: false, problem: null }
      }

      RuntimeLog.error('caught:core/sprites.ts (inventory)', error)

      return { inventory: null, answered: false, problem: errorMessage(error) }
    }
  }

  private static send(channel: ElectronAPIEventKeys, payload: unknown) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}
