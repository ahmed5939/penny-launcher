import type { AccountData } from '../../types/accounts'
import type {
  AccountAvatar,
  AccountAvatarsPayload,
  AccountStanding,
  AccountStandingPayload,
} from '../../features/account-extras/model'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { AccountsManager } from '../startup/accounts'
import { DataDirectory } from '../startup/data-directory'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { peekCosmeticsCatalog, resolveCosmetic } from './locker-catalog'

import {
  avatarBatchSize,
  chunk,
  classifyStanding,
  describeAvatar,
  isEpicAccountId,
  parseAvatarList,
  parseStanding,
  readPersistedAvatar,
} from '../../features/account-extras/model'
import {
  getAccountAvatars,
  getSocialStanding,
} from '../../services/endpoints/account-extras'

/**
 * Avatars and social standing, fetched.
 *
 * Neither is the game's data: the avatar is the outfit Epic shows as an
 * account's picture (one call answers a hundred ids, on any account's
 * token), and standing is the social ban service's list of bans and
 * warnings (one call per account, on its own token). The parsing is pure and
 * lives in `features/account-extras/model.ts`.
 */

export type {
  AccountAvatar,
  AccountAvatarsPayload,
  AccountStanding,
  AccountStandingPayload,
  StandingItem,
  StandingStatus,
} from '../../features/account-extras/model'

type CachedAvatar = AccountAvatar & { fetchedAt: number }

const avatarCacheVersion = 1

/** Outfits change between matches at most; half an hour is plenty fresh. */
const avatarMaxAgeMs = 30 * 60 * 1000

/** Friends' avatars are kept on disk too, but only this many of them. */
const persistedOthersLimit = 300

/** A ban is not issued mid-session often enough to check more than this. */
const standingMaxAgeMs = 10 * 60 * 1000

/** A verified token is reused briefly rather than re-verified per batch. */
const tokenMaxAgeMs = 2 * 60 * 1000

/** The renderer may ask for at most this many ids in one message. */
const avatarRequestLimit = 1000

function errorMessage(error: unknown) {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status

  if (status) {
    return `HTTP ${status}`
  }

  return error instanceof Error ? error.message : 'Unknown error'
}

export class AccountExtras {
  private static avatars = new Map<string, CachedAvatar>()
  private static avatarsLoaded: Promise<void> | null = null
  private static avatarsInFlight = new Set<string>()
  private static avatarWrite: Promise<void> = Promise.resolve()
  private static token: { value: string; at: number } | null = null

  private static standing = new Map<string, AccountStanding>()
  private static standingRun: Promise<void> | null = null

  private static get avatarFilePath() {
    return path.join(
      DataDirectory.getDataDirectoryPath(),
      'account-avatars.json'
    )
  }

  /**
   * What is known is answered at once — from memory, or from disk on the
   * first call, however old — and anything stale is then fetched and
   * answered again batch by batch. The renderer merges every reply, so a
   * friends list fills in as it goes rather than all at the end.
   */
  static async requestAvatars(accountIds: Array<string>) {
    const ids = [
      ...new Set(
        (Array.isArray(accountIds) ? accountIds : []).filter(isEpicAccountId)
      ),
    ].slice(0, avatarRequestLimit)

    if (ids.length === 0) {
      return
    }

    await AccountExtras.loadAvatarFile()

    const now = Date.now()
    const known: Record<string, AccountAvatar> = {}
    const stale: Array<string> = []

    for (const id of ids) {
      const cached = AccountExtras.avatars.get(id)

      if (cached) {
        known[id] = AccountExtras.withoutTime(cached)
      }

      if (
        (!cached || now - cached.fetchedAt > avatarMaxAgeMs) &&
        !AccountExtras.avatarsInFlight.has(id)
      ) {
        stale.push(id)
      }
    }

    if (Object.keys(known).length > 0) {
      AccountExtras.send(ElectronAPIEventKeys.AccountAvatarsResponse, {
        avatars: known,
      } as AccountAvatarsPayload)
    }

    if (stale.length === 0) {
      return
    }

    stale.forEach((id) => AccountExtras.avatarsInFlight.add(id))

    try {
      await AccountExtras.fetchAvatars(stale)
      await AccountExtras.writeAvatarFile()
    } finally {
      stale.forEach((id) => AccountExtras.avatarsInFlight.delete(id))
    }
  }

  private static async fetchAvatars(ids: Array<string>) {
    let accessToken = await AccountExtras.anyAccessToken()

    if (!accessToken) {
      RuntimeLog.info(
        'core/account-extras.ts (avatars)',
        'no linked account could sign in — avatars stay as initials'
      )

      return
    }

    for (const batch of chunk(ids, avatarBatchSize)) {
      try {
        const response = await getAccountAvatars({
          accessToken,
          accountIds: batch,
        }).catch(async (error: unknown) => {
          /*
           * A token reused from a minute ago can have been revoked since —
           * a re-login elsewhere does it — so a 401 gets one fresh token
           * before the batch counts as failed.
           */
          if (
            (error as { response?: { status?: number } }).response?.status !==
            401
          ) {
            throw error
          }

          AccountExtras.token = null
          accessToken = await AccountExtras.anyAccessToken()

          if (!accessToken) {
            throw error
          }

          return getAccountAvatars({ accessToken, accountIds: batch })
        })
        const found = parseAvatarList(response.data)
        const catalog = peekCosmeticsCatalog()
        const fetchedAt = Date.now()
        const avatars: Record<string, AccountAvatar> = {}

        for (const id of batch) {
          // An id the service leaves out has no outfit set: initials.
          const cosmeticId = found.get(id.toLowerCase()) ?? null
          const meta =
            cosmeticId && catalog
              ? resolveCosmetic(catalog, `AthenaCharacter:${cosmeticId}`)
              : null
          const avatar = describeAvatar(
            cosmeticId,
            meta?.resolved ? { name: meta.name, imageUrl: meta.imageUrl } : null,
            AccountExtras.avatars.get(id)
          )

          AccountExtras.avatars.set(id, { ...avatar, fetchedAt })
          avatars[id] = avatar
        }

        AccountExtras.send(ElectronAPIEventKeys.AccountAvatarsResponse, {
          avatars,
        } as AccountAvatarsPayload)
      } catch (error) {
        RuntimeLog.error('caught:core/account-extras.ts (avatars)', error)
      }
    }
  }

  /**
   * Any linked account's token: the avatar service does not care whose.
   * Accounts already known to be signed in are tried first, and ones known
   * to be signed out not at all — verifying those costs two round trips
   * each before failing.
   */
  private static async anyAccessToken() {
    const cached = AccountExtras.token

    if (cached && Date.now() - cached.at < tokenMaxAgeMs) {
      return cached.value
    }

    const accounts = [...AccountsManager.getAccounts().values()]
      .filter((account) => account.authStatus !== 'invalid')
      .sort(
        (a, b) =>
          Number(b.authStatus === 'valid') - Number(a.authStatus === 'valid')
      )

    for (const account of accounts) {
      const value = await Authentication.verifyAccessToken(account).catch(
        () => null
      )

      if (value) {
        AccountExtras.token = { value, at: Date.now() }

        return value
      }
    }

    return null
  }

  private static withoutTime({ cosmeticId, imageUrl, name }: CachedAvatar) {
    return { cosmeticId, imageUrl, name } as AccountAvatar
  }

  private static loadAvatarFile() {
    AccountExtras.avatarsLoaded ??= (async () => {
      try {
        const parsed = JSON.parse(
          await readFile(AccountExtras.avatarFilePath, 'utf8')
        ) as { avatars?: Record<string, unknown>; version?: number }

        if (
          parsed.version !== avatarCacheVersion ||
          !parsed.avatars ||
          typeof parsed.avatars !== 'object'
        ) {
          return
        }

        for (const [id, value] of Object.entries(parsed.avatars)) {
          const entry = readPersistedAvatar(value)

          if (entry && isEpicAccountId(id) && !AccountExtras.avatars.has(id)) {
            AccountExtras.avatars.set(id, entry)
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // First run, or a damaged file: start empty and rewrite it.
      }
    })()

    return AccountExtras.avatarsLoaded
  }

  /**
   * Linked accounts always, so they draw on the next start before any
   * request; friends only up to a cap, newest first, so the file stays
   * small however many friends lists are opened. Writes queue behind each
   * other — two runs finishing together must not interleave one file.
   */
  private static writeAvatarFile() {
    AccountExtras.avatarWrite = AccountExtras.avatarWrite.then(async () => {
      try {
        const linked = new Set(AccountsManager.getAccounts().keys())
        const entries = [...AccountExtras.avatars.entries()]
        const keep = [
          ...entries.filter(([id]) => linked.has(id)),
          ...entries
            .filter(([id]) => !linked.has(id))
            .sort(([, a], [, b]) => b.fetchedAt - a.fetchedAt)
            .slice(0, persistedOthersLimit),
        ]

        await mkdir(DataDirectory.getDataDirectoryPath(), { recursive: true })
        await writeFile(
          AccountExtras.avatarFilePath,
          JSON.stringify({
            version: avatarCacheVersion,
            avatars: Object.fromEntries(keep),
          }),
          { encoding: 'utf8' }
        )
      } catch (error) {
        RuntimeLog.error('caught:core/account-extras.ts (avatar cache)', error)
      }
    })

    return AccountExtras.avatarWrite
  }

  /**
   * Every linked account, one after another on its own token. Each fresh
   * check is answered as it lands; the last reply carries the full set so
   * the renderer can drop accounts that have since been removed. A request
   * that arrives mid-check is answered by the check already running.
   */
  static requestStanding(refresh = false) {
    AccountExtras.standingRun ??= AccountExtras.checkStanding(
      Boolean(refresh)
    ).finally(() => {
      AccountExtras.standingRun = null
    })

    return AccountExtras.standingRun
  }

  private static async checkStanding(refresh: boolean) {
    const accounts: Record<string, AccountStanding> = {}

    for (const account of AccountsManager.getAccounts().values()) {
      const cached = AccountExtras.standing.get(account.accountId)
      const fresh =
        !refresh &&
        cached &&
        cached.status !== 'unknown' &&
        Date.now() - Date.parse(cached.checkedAt) < standingMaxAgeMs

      if (fresh) {
        accounts[account.accountId] = cached

        continue
      }

      const entry = await AccountExtras.checkAccount(account)

      AccountExtras.standing.set(account.accountId, entry)
      accounts[account.accountId] = entry
      AccountExtras.send(ElectronAPIEventKeys.AccountStandingResponse, {
        accounts: { [account.accountId]: entry },
        complete: false,
      } as AccountStandingPayload)
    }

    AccountExtras.send(ElectronAPIEventKeys.AccountStandingResponse, {
      accounts,
      complete: true,
    } as AccountStandingPayload)
  }

  private static async checkAccount(
    account: AccountData
  ): Promise<AccountStanding> {
    const checkedAt = new Date().toISOString()

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return {
          status: 'unknown',
          bans: [],
          warnings: [],
          checkedAt,
          errorMessage:
            'Could not sign in to this account. Add it again, then check again.',
        }
      }

      const response = await getSocialStanding({
        accessToken,
        accountId: account.accountId,
      })
      const { bans, warnings } = parseStanding(response.data)

      /*
       * Logged raw (truncated) because the item shape comes from Epic's
       * GraphQL schema for this service, not from a REST reply: every
       * account this was written against came back clean. The first real
       * ban or warning is the evidence that the two agree.
       */
      if (bans.length > 0 || warnings.length > 0) {
        RuntimeLog.info(
          'core/account-extras.ts (standing)',
          JSON.stringify(response.data).slice(0, 4000)
        )
      }

      return {
        status: classifyStanding(bans, warnings),
        bans,
        warnings,
        checkedAt,
      }
    } catch (error) {
      RuntimeLog.error('caught:core/account-extras.ts (standing)', error)

      return {
        status: 'unknown',
        bans: [],
        warnings: [],
        checkedAt,
        errorMessage: `Could not check standing (${errorMessage(error)}). Try again later.`,
      }
    }
  }

  private static send(channel: ElectronAPIEventKeys, payload: unknown) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}
