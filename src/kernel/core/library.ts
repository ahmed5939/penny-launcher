import type { AccountData } from '../../types/accounts'
import type { LibraryRecord, ProfileAccess } from '../../features/library/account'
import type {
  AccountLibraryOverview,
  LibraryOverviewPayload,
} from '../../features/library/collection'
import type {
  CatalogItem,
  CloudSaveDownload,
  CloudSavesDownloadProgress,
  CloudSavesResponse,
  LibraryReply,
  LibraryResponse,
  LibraryStoreResponse,
} from '../../features/library/model'

import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { app, dialog } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { AccountsManager } from '../startup/accounts'
import { DataDirectory } from '../startup/data-directory'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import {
  launcherAppToken,
  responseStatus,
  withLauncherToken,
} from './launcher-token'

import {
  fortniteAppInfo,
  parseLibraryPage,
  parseProfileAccess,
  recordTitles,
} from '../../features/library/account'
import {
  appTitles,
  buildLibrary,
  libraryModes,
  pickArt,
  cloudSaveDownloads,
  cloudSaveLogSample,
  fortniteMainItemId,
  fortniteNamespace,
  normaliseStoreOffers,
  parseCloudSaves,
  parseEntitlements,
  purchaseItemIds,
  safeSaveSegments,
  storeRegion,
  trimCatalogItem,
} from '../../features/library/model'

import { getLibraryItems } from '../../services/endpoints/epic-graphql'
import {
  getCatalogItems,
  getCloudSaves,
  getEntitlements,
  getSignedFile,
  getStoreOffers,
} from '../../services/endpoints/library'
import { getQueryProfileMainProfile } from '../../services/endpoints/mcp'

/**
 * The account's Epic library, as far as Fortnite goes.
 *
 * Four reads, none of them MCP:
 *
 * - *entitlements* — every item the account holds, in every Epic game, as
 *   bare ids (launcher user token);
 * - the *catalogue* — what those ids are, and Fortnite's list of modes
 *   (app-only token, cached on disk for a week: items change with a season
 *   at most);
 * - the *store* — Fortnite's offers with prices for the OS's country (no
 *   token, cached for an hour);
 * - *cloud saves* — the save-sync listing (launcher user token), and on
 *   request a copy of one game's files through their signed links.
 *
 * The join is `buildLibrary` and friends in `features/library/model.ts`.
 * Nothing here writes to the account.
 */

export type {
  CloudSavesDownloadProgress,
  CloudSavesResponse,
  LibraryResponse,
  LibraryStoreResponse,
} from '../../features/library/model'

const entitlementPageSize = 1000

const catalogBatchSize = 50
const catalogCacheVersion = 1
const catalogMaxAgeMs = 7 * 24 * 60 * 60 * 1000
/** An id the catalogue did not know is asked about again sooner. */
const catalogMissingMaxAgeMs = 24 * 60 * 60 * 1000

const storeMaxAgeMs = 60 * 60 * 1000

/** The library and cloud saves load together; one read serves both. */
const recordsMaxAgeMs = 5 * 60 * 1000

/** The library list is paged; no account this was tried on needed a second page. */
const recordsMaxPages = 20

/** Every account's library at once: a new game is rare, ten minutes is fresh. */
const overviewMaxAgeMs = 10 * 60 * 1000

type CatalogCacheEntry = {
  fetchedAt: number
  /** Fetched with its DLC list — only the main item needs one. */
  details: boolean
  item: CatalogItem | null
}

function describe(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (
      error as {
        response?: { status?: number; data?: { errorMessage?: string } }
      }
    ).response

    if (response?.status) {
      return `HTTP ${response.status}`
    }
  }

  return error instanceof Error ? error.message : 'Unknown error'
}

/** "Could not read the entitlements (HTTP 403). Try Refresh." */
function failure(what: string, error: unknown) {
  return new Error(`Could not read ${what} (${describe(error)}). Try Refresh.`, {
    cause: error,
  })
}

/** Accepts a bare array or one wrapped in `elements`, in case the service ever pages that way. */
function rowsOf(data: unknown): Array<unknown> {
  if (Array.isArray(data)) {
    return data
  }

  const elements = (data as { elements?: unknown } | null)?.elements

  return Array.isArray(elements) ? elements : []
}

export class Library {
  private static catalogEntries: Map<string, CatalogCacheEntry> | null = null
  private static catalogLoading: Promise<Map<string, CatalogCacheEntry>> | null = null
  private static catalogWrites: Promise<void> = Promise.resolve()

  private static store: {
    key: string
    data: LibraryStoreResponse
    fetchedAt: number
  } | null = null

  private static records = new Map<
    string,
    { at: number; value: Promise<Array<LibraryRecord>> }
  >()

  private static overview = new Map<string, AccountLibraryOverview>()
  private static overviewRun: Promise<void> | null = null

  static async request(requestId: string, accountId: string, refresh = false) {
    await Library.reply(ElectronAPIEventKeys.LibraryResponse, requestId, () =>
      Library.readLibrary(accountId, refresh)
    )
  }

  static async requestStore(requestId: string, refresh = false) {
    await Library.reply(
      ElectronAPIEventKeys.LibraryStoreResponse,
      requestId,
      () => Library.readStore(refresh)
    )
  }

  static async requestCloudSaves(requestId: string, accountId: string) {
    await Library.reply(
      ElectronAPIEventKeys.CloudSavesResponse,
      requestId,
      () => Library.readCloudSaves(accountId)
    )
  }

  // -------------------------------------------------------------------------
  // Fortnite: entitlements joined with the catalogue
  // -------------------------------------------------------------------------

  /**
   * Entitlements are the page: if they cannot be read there is nothing to
   * show, and the request fails. Everything else only adds to it, so a
   * failure there costs that part, with a warning, never the page:
   *
   * - the catalogue names purchases and lists the modes;
   * - the game's `common_core` profile says whether the account has Save
   *   the World (entitlements cannot — see `features/library/account.ts`);
   * - the launcher's library list names the account's other games;
   * - the store's offers give purchases their store name and art.
   */
  private static async readLibrary(
    accountId: string,
    refresh: boolean
  ): Promise<LibraryResponse> {
    const account = Library.account(accountId)
    const problems: Array<string> = []

    const [entitlements, mainItem, profile, records, offers] = await Promise.all([
      Library.readEntitlements(account),
      Library.mainItem(refresh).catch((error: unknown) => {
        RuntimeLog.error('caught:core/library.ts (catalogue)', error)
        problems.push(`Fortnite's modes could not be read from the catalogue (${describe(error)})`)

        return null
      }),
      Library.readProfileAccess(account).catch((error: unknown) => {
        RuntimeLog.error('caught:core/library.ts (profile)', error)
        problems.push(
          `Save the World access could not be read from the game profile (${describe(error)}), so it is judged from entitlements`
        )

        return null
      }),
      Library.readRecords(account, refresh).catch((error: unknown) => {
        RuntimeLog.error('caught:core/library.ts (library list)', error)
        problems.push(`The account's other Epic games could not be listed (${describe(error)})`)

        return null
      }),
      Library.readStore(false)
        .then((store) => store.offers)
        .catch(() => []),
    ])

    const ids = purchaseItemIds(entitlements, mainItem)
    const catalog = await Library.resolveCatalog(fortniteNamespace, ids, {
      details: false,
      refresh,
    })

    if (catalog.error) {
      problems.push(`Some purchases could not be named (${catalog.error})`)
    }

    const library = buildLibrary(accountId, entitlements, mainItem, catalog.items, {
      offers,
      profile,
      records,
    })
    const { saveTheWorld } = library.fortnite

    RuntimeLog.info(
      'core/library.ts',
      `entitlements=${entitlements.length} fn=${ids.length} resolved=${
        Object.values(catalog.items).filter(Boolean).length
      } modes=${library.fortnite.modes.length} stw=${saveTheWorld.access}/${saveTheWorld.source} ` +
        `founder=${saveTheWorld.founder?.edition ?? (saveTheWorld.founder ? 'yes' : 'no')} games=${
          library.games?.list.length ?? 'unread'
        }`
    )

    return problems.length > 0
      ? { ...library, errorMessage: `${problems.join(' — ')}. Try Refresh.` }
      : library
  }

  /** The game's own record of what the account can play. Its Fortnite token. */
  private static async readProfileAccess(account: AccountData): Promise<ProfileAccess | null> {
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      throw new Error('not signed in')
    }

    const response = await getQueryProfileMainProfile({
      accessToken,
      accountId: account.accountId,
    })

    return parseProfileAccess(response.data)
  }

  /**
   * The account's Epic library list, every page. Kept for a few minutes so
   * the library and the cloud saves — asked for together — read it once.
   */
  private static readRecords(account: AccountData, refresh: boolean) {
    const cached = Library.records.get(account.accountId)

    if (!refresh && cached && Date.now() - cached.at < recordsMaxAgeMs) {
      return cached.value
    }

    const value = withLauncherToken(account, async (accessToken) => {
      const records: Array<LibraryRecord> = []
      let cursor: string | null = null

      for (let page = 0; page < recordsMaxPages; page += 1) {
        const parsed = parseLibraryPage(await getLibraryItems({ accessToken, cursor }))

        records.push(...parsed.records)
        cursor = parsed.nextCursor

        if (!cursor) {
          break
        }
      }

      return records
    })

    Library.records.set(account.accountId, { at: Date.now(), value })
    value.catch(() => Library.records.delete(account.accountId))

    return value
  }

  /**
   * Every linked account's Epic library and game profile, one after another
   * on each one's own tokens — the cross-account Library is built from
   * these. Each fresh read is answered as it lands; the last reply carries
   * the full set. A request mid-check is answered by the check running.
   */
  static requestOverview(refresh = false) {
    Library.overviewRun ??= Library.checkOverview(Boolean(refresh)).finally(() => {
      Library.overviewRun = null
    })

    return Library.overviewRun
  }

  private static async checkOverview(refresh: boolean) {
    const mainItem = await Library.mainItem(false).catch(() => null)
    const fortnite = mainItem ? { art: pickArt(mainItem.keyImages), modes: libraryModes(mainItem) } : null
    const accounts: Record<string, AccountLibraryOverview> = {}

    for (const account of AccountsManager.getAccounts().values()) {
      const cached = Library.overview.get(account.accountId)

      if (
        !refresh &&
        cached?.status === 'ok' &&
        Date.now() - Date.parse(cached.checkedAt) < overviewMaxAgeMs
      ) {
        accounts[account.accountId] = cached

        continue
      }

      const entry = await Library.readOverview(account, refresh)

      Library.overview.set(account.accountId, entry)
      accounts[account.accountId] = entry
      Library.send(ElectronAPIEventKeys.LibraryOverviewResponse, {
        accounts: { [account.accountId]: entry },
        fortnite,
        complete: false,
      } as LibraryOverviewPayload)
    }

    Library.send(ElectronAPIEventKeys.LibraryOverviewResponse, {
      accounts,
      fortnite,
      complete: true,
    } as LibraryOverviewPayload)
  }

  /** The library list is the account's part; the profile only adds to it. */
  private static async readOverview(
    account: AccountData,
    refresh: boolean
  ): Promise<AccountLibraryOverview> {
    const checkedAt = new Date().toISOString()
    const [records, access] = await Promise.all([
      Library.readRecords(account, refresh).catch((error: unknown) => error as Error),
      Library.readProfileAccess(account).catch((error: unknown) => {
        RuntimeLog.error('caught:core/library.ts (overview profile)', error)

        return null
      }),
    ])

    if (records instanceof Error || !Array.isArray(records)) {
      RuntimeLog.error('caught:core/library.ts (overview)', records)

      return {
        status: 'unknown',
        records: [],
        access,
        checkedAt,
        errorMessage: `Could not list this account's games (${describe(records)}). Try Refresh.`,
      }
    }

    return { status: 'ok', records, access, checkedAt }
  }

  /**
   * Fortnite's launcher apps by app id, from the cached catalogue — the
   * names and art for playtime records nothing else names.
   */
  static async fortniteApps() {
    return fortniteAppInfo(await Library.mainItem(false))
  }

  private static async readEntitlements(account: AccountData) {
    const rows = await withLauncherToken(account, async (accessToken) => {
      const all: Array<unknown> = []

      /* Paged until a short page; the cap only guards against a service that never sends one. */
      for (let start = 0; start < 50 * entitlementPageSize; start += entitlementPageSize) {
        const page = await getEntitlements({
          accessToken,
          accountId: account.accountId,
          count: entitlementPageSize,
          start,
        })
        const rows = rowsOf(page.data)

        all.push(...rows)

        if (rows.length < entitlementPageSize) {
          break
        }
      }

      return all
    }).catch((error: unknown) => {
      RuntimeLog.error('caught:core/library.ts (entitlements)', error)

      throw failure("this account's entitlements", error)
    })

    const entitlements = parseEntitlements(rows)

    /*
     * One raw Fortnite entry, logged because the shape was implemented from
     * documentation rather than seen — if ownership reads wrong, this is the
     * line that says why. Entitlements carry no secrets.
     */
    const sample = rows.find(
      (row) => (row as { namespace?: string } | null)?.namespace === fortniteNamespace
    )

    RuntimeLog.info(
      'core/library.ts (entitlements)',
      `rows=${rows.length} parsed=${entitlements.length} sample=${JSON.stringify(sample ?? rows[0] ?? null).slice(0, 800)}`
    )

    return entitlements
  }

  private static async mainItem(refresh: boolean) {
    const result = await Library.resolveCatalog(
      fortniteNamespace,
      [fortniteMainItemId],
      { details: true, refresh }
    )

    if (result.error) {
      throw new Error(result.error)
    }

    return result.items[fortniteMainItemId] ?? null
  }

  /**
   * Catalogue items by id, from the disk cache where it is fresh and in
   * batches of fifty where it is not. A failed batch leaves its ids unnamed
   * (and uncached) rather than failing the others.
   */
  private static async resolveCatalog(
    namespace: string,
    ids: Array<string>,
    { details, refresh }: { details: boolean; refresh: boolean }
  ) {
    const entries = await Library.catalogCache()
    const now = Date.now()
    const key = (id: string) => `${namespace}:${id}`
    const stale = ids.filter((id) => {
      const entry = entries.get(key(id))

      return (
        refresh ||
        !entry ||
        (details && !entry.details) ||
        now - entry.fetchedAt >
          (entry.item ? catalogMaxAgeMs : catalogMissingMaxAgeMs)
      )
    })
    let error: string | null = null

    if (stale.length > 0) {
      const { country } = storeRegion(app.getLocaleCountryCode(), null)
      const batches: Array<Array<string>> = []

      for (let at = 0; at < stale.length; at += catalogBatchSize) {
        batches.push(stale.slice(at, at + catalogBatchSize))
      }

      const fetchBatch = async (batch: Array<string>, fresh = false) => {
        const accessToken = await launcherAppToken({ fresh })

        return getCatalogItems({ accessToken, country, details, ids: batch, namespace })
      }

      for (let at = 0; at < batches.length; at += 4) {
        await Promise.all(
          batches.slice(at, at + 4).map(async (batch) => {
            try {
              const response = await fetchBatch(batch).catch((first: unknown) => {
                if (responseStatus(first) !== 401) {
                  throw first
                }

                return fetchBatch(batch, true)
              })
              const found = response.data ?? {}

              batch.forEach((id) => {
                const item = found[id]

                entries.set(key(id), {
                  fetchedAt: Date.now(),
                  details,
                  item: item && typeof item === 'object' ? trimCatalogItem({ ...item, id }) : null,
                })
              })
            } catch (cause) {
              RuntimeLog.error('caught:core/library.ts (catalogue batch)', cause)
              error ??= describe(cause)
            }
          })
        )
      }

      Library.saveCatalogCache()
    }

    const items: Record<string, CatalogItem | null> = {}

    ids.forEach((id) => {
      const entry = entries.get(key(id))

      if (entry) {
        items[id] = entry.item
      }
    })

    return { items, error }
  }

  private static get catalogFilePath() {
    return path.join(DataDirectory.getDataDirectoryPath(), 'library-catalog.json')
  }

  private static async catalogCache() {
    if (Library.catalogEntries) {
      return Library.catalogEntries
    }

    Library.catalogLoading ??= readFile(Library.catalogFilePath, 'utf8')
      .then((raw) => {
        const parsed = JSON.parse(raw) as {
          version?: number
          entries?: Record<string, CatalogCacheEntry>
        }

        return parsed.version === catalogCacheVersion && parsed.entries
          ? new Map(Object.entries(parsed.entries))
          : new Map<string, CatalogCacheEntry>()
      })
      .catch(() => new Map<string, CatalogCacheEntry>())
      .then((entries) => {
        Library.catalogEntries = entries

        return entries
      })

    return Library.catalogLoading
  }

  /** Writes queue behind each other, so two pages saving at once never interleave. */
  private static saveCatalogCache() {
    const entries = Library.catalogEntries

    if (!entries) {
      return
    }

    Library.catalogWrites = Library.catalogWrites
      .then(async () => {
        await mkdir(DataDirectory.getDataDirectoryPath(), { recursive: true })
        await writeFile(
          Library.catalogFilePath,
          JSON.stringify({
            version: catalogCacheVersion,
            entries: Object.fromEntries(entries),
          }),
          'utf8'
        )
      })
      .catch((error: unknown) => {
        RuntimeLog.error('caught:core/library.ts (catalogue cache)', error)
      })
  }

  // -------------------------------------------------------------------------
  // Store
  // -------------------------------------------------------------------------

  /**
   * One GraphQL query for the whole namespace, priced for the OS's country.
   * A country the store does not sell in comes back with every price null;
   * the US store's prices are shown instead, and the page says whose they
   * are.
   */
  private static async readStore(refresh: boolean): Promise<LibraryStoreResponse> {
    const region = storeRegion(app.getLocaleCountryCode(), app.getSystemLocale())
    const key = `${region.country}:${region.locale}`
    const cached = Library.store

    if (
      !refresh &&
      cached &&
      cached.key === key &&
      Date.now() - cached.fetchedAt < storeMaxAgeMs
    ) {
      return cached.data
    }

    const query = async (country: string) => {
      const response = await getStoreOffers({
        country,
        locale: region.locale,
        namespace: fortniteNamespace,
      }).catch((error: unknown) => {
        RuntimeLog.error('caught:core/library.ts (store)', error)

        throw failure('the Epic Games Store', error)
      })
      const offers = normaliseStoreOffers(response.data)
      const errors = (response.data as { errors?: Array<{ message?: string }> } | null)
        ?.errors

      if (offers.length === 0 && errors?.length) {
        throw new Error(
          `The Epic Games Store refused the request (${errors[0]?.message ?? 'no reason given'}). Try Refresh.`
        )
      }

      return offers
    }

    let country = region.country
    let offers = await query(country)

    if (country !== 'US' && offers.length > 0 && offers.every((offer) => offer.price === null)) {
      country = 'US'
      offers = await query(country)
    }

    const data: LibraryStoreResponse = {
      country,
      offers,
      fetchedAt: new Date().toISOString(),
    }

    Library.store = { key, data, fetchedAt: Date.now() }

    return data
  }

  // -------------------------------------------------------------------------
  // Cloud saves
  // -------------------------------------------------------------------------

  private static async readCloudSaves(accountId: string): Promise<CloudSavesResponse> {
    const account = Library.account(accountId)
    const raw = await withLauncherToken(account, (accessToken) =>
      getCloudSaves({ accessToken, accountId })
    )
      .then((response) => response.data)
      .catch((error: unknown) => {
        /* An account that has never synced a save has no folder to list. */
        if (responseStatus(error) === 404) {
          return { files: {} }
        }

        RuntimeLog.error('caught:core/library.ts (cloud saves)', error)

        throw failure('the cloud saves', error)
      })

    RuntimeLog.info('core/library.ts (cloud saves)', cloudSaveLogSample(raw))

    /*
     * Games are named from the account's library list (read alongside the
     * library, so usually already in hand) and Fortnite's catalogue item for
     * its modes. A game neither knows keeps its app name.
     */
    const [mainItem, records] = await Promise.all([
      Library.mainItem(false).catch(() => null),
      Library.readRecords(account, false).catch(() => []),
    ])
    const parsed = parseCloudSaves(raw, accountId, {
      ...appTitles(mainItem),
      ...recordTitles(records),
    })

    /*
     * Whether the full listing carries download links is not known; the
     * per-game listing is what tools that download saves read. If the first
     * had none, ask the second for each game (a handful at most), so the
     * Download button appears exactly where a download will work.
     */
    if (parsed.games.length > 0 && parsed.games.every((game) => !game.downloadable)) {
      const probes = await Promise.all(
        parsed.games.slice(0, 8).map((game) =>
          Library.gameDownloads(account, game.appName)
            .then((files) => files.length > 0)
            .catch(() => false)
        )
      )

      parsed.games = parsed.games.map((game, index) =>
        probes[index] ? { ...game, downloadable: true } : game
      )
    }

    return { accountId, ...parsed }
  }

  private static async gameDownloads(account: AccountData, appName: string) {
    const response = await withLauncherToken(account, (accessToken) =>
      getCloudSaves({ accessToken, accountId: account.accountId, appName })
    )

    return cloudSaveDownloads(response.data, account.accountId, appName)
  }

  /**
   * A copy of one game's cloud saves in a folder the user picks. The links
   * are asked for fresh — they are signed and expire — and every file name
   * is checked before it touches the disk (`safeSaveSegments`). Files are
   * written as Epic stores them; nothing is uploaded or deleted.
   */
  static async downloadCloudSaves(
    requestId: string,
    accountId: string,
    appName: string
  ) {
    const progress: CloudSavesDownloadProgress = {
      requestId,
      accountId,
      appName,
      status: 'running',
      done: 0,
      total: 0,
      bytes: 0,
      skipped: 0,
      directory: null,
    }
    const send = () =>
      Library.send(ElectronAPIEventKeys.CloudSavesDownloadProgress, {
        ...progress,
      })

    try {
      const account = Library.account(accountId)
      const folderName = safeSaveSegments(appName)

      if (!folderName || folderName.length !== 1) {
        throw new Error("This game's name cannot be used as a folder name.")
      }

      const choice = await dialog.showOpenDialog(MainWindow.instance, {
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Choose where to save a copy of the cloud saves',
      })

      if (choice.canceled || !choice.filePaths[0]) {
        progress.status = 'cancelled'

        return
      }

      let files: Array<CloudSaveDownload> = await Library.gameDownloads(
        account,
        appName
      ).catch(() => [])

      if (files.length === 0) {
        const all = await withLauncherToken(account, (accessToken) =>
          getCloudSaves({ accessToken, accountId })
        ).catch((error: unknown) => {
          throw failure('the cloud saves', error)
        })

        files = cloudSaveDownloads(all.data, accountId, appName)
      }

      if (files.length === 0) {
        throw new Error('Epic did not offer download links for these files. Try again later.')
      }

      const root = path.join(choice.filePaths[0], folderName[0])

      progress.total = files.length
      progress.directory = root
      send()

      for (const file of files) {
        const segments = safeSaveSegments(file.path)
        const target = segments ? path.join(root, ...segments) : null
        const inside = target ? path.relative(root, target) : '..'

        if (!target || inside.startsWith('..') || path.isAbsolute(inside)) {
          progress.skipped += 1
          progress.done += 1
          send()

          continue
        }

        await mkdir(path.dirname(target), { recursive: true })

        const response = await getSignedFile(file.readLink).catch((error: unknown) => {
          throw new Error(`Could not download ${file.path} (${describe(error)}).`, {
            cause: error,
          })
        })

        await pipeline(response.data, createWriteStream(target))

        progress.bytes += (await stat(target)).size
        progress.done += 1
        send()
      }

      progress.status = 'saved'
    } catch (error) {
      RuntimeLog.error('caught:core/library.ts (download)', error)
      progress.status = 'failed'
      progress.errorMessage =
        error instanceof Error ? error.message : 'The download failed.'
    } finally {
      send()
    }
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

  /** IPC carries an account id; the account and its tokens stay here. */
  private static account(accountId: string) {
    const account = AccountsManager.getAccountById(accountId)

    if (!account) {
      throw new Error('This account is no longer linked. Select another in the title bar.')
    }

    return account
  }

  /**
   * Every reply carries the request it answers and either a result or the
   * reason there is none. `secureIpcHandle` would flatten every failure to
   * "Request failed."; this way the page can say which service refused.
   */
  private static async reply<Result>(
    channel: ElectronAPIEventKeys,
    requestId: string,
    run: () => Promise<Result>
  ) {
    const reply: LibraryReply<Result> = { requestId }

    try {
      reply.result = await run()
    } catch (error) {
      RuntimeLog.error(`caught:core/library.ts (${channel})`, error)
      reply.error =
        error instanceof Error && error.message
          ? error.message
          : 'Could not load the library. Try Refresh.'
    }

    Library.send(channel, reply)
  }

  private static send(channel: ElectronAPIEventKeys, payload: unknown) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}
