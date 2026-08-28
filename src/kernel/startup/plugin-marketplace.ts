import type { MarketplaceSettings } from '../../types/plugins'
import type { NormalizedListing, ParsedCatalog } from '../plugin-catalog'

import axios, { isAxiosError } from 'axios'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import {
  defaultMarketplaceCatalogUrl,
  marketplaceArchiveMaxBytes,
  marketplaceCatalogMaxBytes,
  marketplaceCatalogMemoryTtlMs,
  marketplaceCatalogTimeoutMs,
  marketplaceReadmeMaxBytes,
} from '../../config/constants/marketplace'
import { parseSecureExternalUrl } from '../security'
import { parseMarketplaceCatalog } from '../plugin-catalog'
import { DataDirectory } from './data-directory'

type MarketplaceStateFile = MarketplaceSettings & {
  disabled: Array<string>
}

type CatalogCacheFile = {
  catalog: unknown
  fetchedAt: string
  url: string
}

type RemoteCatalogResult = {
  catalog: ParsedCatalog | null
  fetchedAt: string | null
  status: 'live' | 'cache' | 'bundled'
  warning: string | null
}

let memoryCatalog: {
  at: number
  result: RemoteCatalogResult
  url: string
} | null = null

const inflight = new Map<string, Promise<RemoteCatalogResult>>()

function cachePath() {
  return path.join(DataDirectory.getDataDirectoryPath(), 'marketplace-cache.json')
}

function statePath() {
  return path.join(DataDirectory.getDataDirectoryPath(), 'plugin-state.json')
}

export function shippedCatalogPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'plugins', 'marketplace.json')
    : path.join(app.getAppPath(), 'plugins', 'marketplace.json')
}

function normalizeCatalogUrl(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) return defaultMarketplaceCatalogUrl

  const parsed = parseSecureExternalUrl(trimmed)

  if (!parsed) {
    throw new Error('Catalog URL must be HTTPS without credentials.')
  }

  return parsed.toString()
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export class MarketplaceClient {
  static async getState(): Promise<MarketplaceStateFile> {
    const stored = await readJsonFile<Partial<MarketplaceStateFile>>(statePath())
    const disabled = Array.isArray(stored?.disabled)
      ? stored.disabled.filter((id) => typeof id === 'string')
      : []

    let catalogUrl = defaultMarketplaceCatalogUrl

    try {
      catalogUrl = normalizeCatalogUrl(stored?.catalogUrl)
    } catch {
      catalogUrl = defaultMarketplaceCatalogUrl
    }

    return {
      allowUnsignedRemote: stored?.allowUnsignedRemote === true,
      catalogUrl,
      disabled,
    }
  }

  static async updateState(
    patch: Partial<Pick<MarketplaceStateFile, 'allowUnsignedRemote' | 'catalogUrl' | 'disabled'>>
  ) {
    const current = await MarketplaceClient.getState()
    const next: MarketplaceStateFile = {
      allowUnsignedRemote:
        patch.allowUnsignedRemote ?? current.allowUnsignedRemote,
      catalogUrl:
        patch.catalogUrl !== undefined
          ? normalizeCatalogUrl(patch.catalogUrl)
          : current.catalogUrl,
      disabled: patch.disabled ?? current.disabled,
    }

    await writeJsonFile(statePath(), next)
    memoryCatalog = null

    return next
  }

  static async readShippedCatalog(): Promise<Array<NormalizedListing>> {
    const raw = await readJsonFile<unknown>(shippedCatalogPath())

    if (!raw) return []

    try {
      return parseMarketplaceCatalog(raw, defaultMarketplaceCatalogUrl).plugins
    } catch {
      return []
    }
  }

  static async fetchRemote(options: {
    force?: boolean
    url: string
  }): Promise<RemoteCatalogResult> {
    const url = normalizeCatalogUrl(options.url)
    const key = `${options.force ? 'force' : 'get'}:${url}`
    const pending = inflight.get(key)

    if (pending) return pending

    const run = MarketplaceClient.fetchRemoteUncached(options, url).finally(() => {
      inflight.delete(key)
    })

    inflight.set(key, run)

    return run
  }

  private static async fetchRemoteUncached(
    options: { force?: boolean },
    url: string
  ): Promise<RemoteCatalogResult> {
    const now = Date.now()

    if (
      !options.force &&
      memoryCatalog &&
      memoryCatalog.url === url &&
      now - memoryCatalog.at < marketplaceCatalogMemoryTtlMs
    ) {
      return memoryCatalog.result
    }

    try {
      const response = await axios.get<unknown>(url, {
        headers: { Accept: 'application/json' },
        maxContentLength: marketplaceCatalogMaxBytes,
        maxRedirects: 3,
        timeout: marketplaceCatalogTimeoutMs,
        validateStatus: (status) => status >= 200 && status < 300,
      })
      const payload =
        typeof response.data === 'string'
          ? (JSON.parse(response.data) as unknown)
          : response.data
      const catalog = parseMarketplaceCatalog(payload, url)
      const fetchedAt = new Date().toISOString()
      const result: RemoteCatalogResult = {
        catalog,
        fetchedAt,
        status: 'live',
        warning: null,
      }

      await writeJsonFile(cachePath(), {
        catalog: payload,
        fetchedAt,
        url,
      } satisfies CatalogCacheFile)

      memoryCatalog = { at: now, result, url }

      return result
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined
      const cached = await readJsonFile<CatalogCacheFile>(cachePath())

      if (cached?.url === url && cached.catalog) {
        try {
          const result: RemoteCatalogResult = {
            catalog: parseMarketplaceCatalog(cached.catalog, url),
            fetchedAt: cached.fetchedAt,
            status: 'cache',
            warning:
              'Penny DB is unreachable. Showing the last catalog that downloaded successfully.',
          }

          memoryCatalog = { at: now, result, url }

          return result
        } catch {
          // Fall through to bundled-only.
        }
      }

      const result: RemoteCatalogResult = {
        catalog: null,
        fetchedAt: null,
        status: 'bundled',
        warning:
          status === 404
            ? 'Penny DB has no marketplace catalog yet. Showing bundled add-ons shipped with Penny.'
            : 'Penny DB is unreachable. Showing bundled add-ons shipped with Penny.',
      }

      memoryCatalog = { at: now, result, url }

      return result
    }
  }

  static async downloadArchive(url: string) {
    const parsed = parseSecureExternalUrl(url)

    if (!parsed) {
      throw new Error('Add-on downloads must be HTTPS without credentials.')
    }

    const response = await axios.get<ArrayBuffer>(parsed.toString(), {
      maxBodyLength: marketplaceArchiveMaxBytes,
      maxContentLength: marketplaceArchiveMaxBytes,
      maxRedirects: 3,
      responseType: 'arraybuffer',
      timeout: 60_000,
      validateStatus: (status) => status >= 200 && status < 300,
    })
    const buffer = new Uint8Array(Buffer.from(response.data))

    if (buffer.byteLength > marketplaceArchiveMaxBytes) {
      throw new Error('Add-on archive is larger than the 25 MB limit.')
    }

    return buffer
  }

  static async fetchText(url: string) {
    const parsed = parseSecureExternalUrl(url)

    if (!parsed) {
      throw new Error('Documentation URLs must be HTTPS without credentials.')
    }

    const response = await axios.get<string>(parsed.toString(), {
      maxContentLength: marketplaceReadmeMaxBytes,
      maxRedirects: 3,
      responseType: 'text',
      timeout: marketplaceCatalogTimeoutMs,
      validateStatus: (status) => status >= 200 && status < 300,
    })

    return typeof response.data === 'string' ? response.data : String(response.data)
  }
}
