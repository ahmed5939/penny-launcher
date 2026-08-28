import { verify } from 'node:crypto'

import {
  marketplacePublicKeys,
  marketplaceSchemaVersion,
  pluginIdPattern,
} from '../config/constants/marketplace'
import type {
  MarketplaceListingSource,
  MarketplacePlugin,
  PluginOrigin,
  PluginOriginRecord,
  PluginTrust,
} from '../types/plugins'

export type NormalizedListing = {
  author: string | null
  bundled: boolean
  category: string | null
  description: string | null
  downloadUrl: string | null
  homepage: string | null
  id: string
  minLauncherVersion: string | null
  name: string
  readmeUrl: string | null
  repository: string | null
  screenshots: Array<string>
  sha256: string | null
  signature: string | null
  version: string | null
}

export type ParsedCatalog = {
  generatedAt: string | null
  plugins: Array<NormalizedListing>
  schemaVersion: number
}

const screenshotHosts = new Set([
  'pennydb.net',
  'www.pennydb.net',
  'pennydb.plingindigo.org',
  'raw.githubusercontent.com',
])

export function isValidPluginId(value: unknown): value is string {
  return typeof value === 'string' && pluginIdPattern.test(value)
}

export function parseVersionParts(value: string): [number, number, number] {
  const core = value.trim().replace(/^v/i, '').split(/[-+]/)[0] ?? '0'
  const parts = core.split('.').map((part) => {
    const parsed = Number.parseInt(part, 10)

    return Number.isFinite(parsed) ? parsed : 0
  })

  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersionParts(left)
  const b = parseVersionParts(right)

  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }

  return 0
}

export function isVersionNewer(
  candidate: string | null | undefined,
  current: string | null | undefined
): boolean {
  if (!candidate) return false
  if (!current) return true

  return compareVersions(candidate, current) > 0
}

export function launcherMeetsMinimum(
  minVersion: string | null | undefined,
  launcherVersion: string
): boolean {
  if (!minVersion) return true

  return compareVersions(launcherVersion, minVersion) >= 0
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function asHttpsUrl(value: unknown, catalogUrl?: string): string | null {
  const raw = asTrimmedString(value)

  if (!raw) return null

  try {
    const resolved = new URL(raw, catalogUrl)

    if (resolved.protocol !== 'https:' || resolved.username || resolved.password) {
      return null
    }

    return resolved.toString()
  } catch {
    return null
  }
}

function asSha256(value: unknown): string | null {
  const raw = asTrimmedString(value)?.replace(/^sha256-/i, '').toLowerCase()

  return raw && /^[0-9a-f]{64}$/.test(raw) ? raw : null
}

function collectScreenshots(value: unknown, catalogUrl?: string) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => asHttpsUrl(item, catalogUrl))
    .filter((item): item is string => {
      if (!item) return false

      try {
        return screenshotHosts.has(new URL(item).hostname)
      } catch {
        return false
      }
    })
    .slice(0, 8)
}

function normalizeListing(
  raw: unknown,
  catalogUrl?: string
): NormalizedListing | null {
  if (!raw || typeof raw !== 'object') return null

  const record = raw as Record<string, unknown>
  const download =
    record.download && typeof record.download === 'object'
      ? (record.download as Record<string, unknown>)
      : null
  const integrity =
    record.integrity && typeof record.integrity === 'object'
      ? (record.integrity as Record<string, unknown>)
      : null
  const id = asTrimmedString(record.id)
  const name = asTrimmedString(record.name)

  if (!isValidPluginId(id) || !name) return null

  return {
    author: asTrimmedString(record.author),
    bundled: record.bundled === true,
    category: asTrimmedString(record.category),
    description: asTrimmedString(record.description),
    downloadUrl:
      asHttpsUrl(download?.url ?? record.downloadUrl ?? record.url, catalogUrl) ??
      (typeof record.download === 'string'
        ? asHttpsUrl(record.download, catalogUrl)
        : null),
    homepage: asHttpsUrl(record.homepage, catalogUrl),
    id,
    minLauncherVersion: asTrimmedString(record.minLauncherVersion),
    name,
    readmeUrl: asHttpsUrl(record.readmeUrl ?? record.readme, catalogUrl),
    repository: asHttpsUrl(record.repository, catalogUrl),
    screenshots: collectScreenshots(record.screenshots, catalogUrl),
    sha256: asSha256(
      download?.sha256 ??
        integrity?.sha256 ??
        record.sha256 ??
        record.hash
    ),
    signature: asTrimmedString(download?.signature ?? integrity?.signature ?? record.signature),
    version: asTrimmedString(record.version),
  }
}

/**
 * Accepts the documented `{ schemaVersion, plugins }` document, a raw array,
 * or `{ marketplace: [...] }` so Penny DB can host whichever shape is
 * convenient. Invalid entries are skipped rather than failing the catalog.
 */
export function parseMarketplaceCatalog(
  raw: unknown,
  catalogUrl?: string
): ParsedCatalog {
  if (raw == null) {
    throw new Error('Catalog is empty.')
  }

  if (typeof raw === 'string') {
    throw new Error('Catalog was not JSON.')
  }

  const document = Array.isArray(raw)
    ? { plugins: raw, schemaVersion: marketplaceSchemaVersion }
    : (raw as Record<string, unknown>)
  const pluginsRaw = Array.isArray(document.plugins)
    ? document.plugins
    : Array.isArray(document.marketplace)
      ? document.marketplace
      : Array.isArray(document.addons)
        ? document.addons
        : null

  if (!pluginsRaw) {
    throw new Error('Catalog is missing a plugins array.')
  }

  const schemaVersion =
    typeof document.schemaVersion === 'number' &&
    Number.isFinite(document.schemaVersion)
      ? document.schemaVersion
      : marketplaceSchemaVersion

  return {
    generatedAt: asTrimmedString(document.generatedAt),
    plugins: pluginsRaw
      .map((item) => normalizeListing(item, catalogUrl))
      .filter((item): item is NormalizedListing => item !== null),
    schemaVersion,
  }
}

/**
 * Remote listings overlay bundled ones by id, but a plugin that ships in
 * `plugins/marketplace/` keeps `bundled: true` so it still installs offline.
 */
export function mergeCatalogs(
  remote: Array<NormalizedListing> | null,
  bundled: Array<NormalizedListing>
): Array<NormalizedListing> {
  const byId = new Map<string, NormalizedListing>()

  for (const listing of bundled) {
    byId.set(listing.id, { ...listing, bundled: true })
  }

  if (remote) {
    for (const listing of remote) {
      const existing = byId.get(listing.id)

      byId.set(
        listing.id,
        existing?.bundled ? { ...listing, bundled: true } : listing
      )
    }
  }

  return [...byId.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

export function listingTrust(listing: NormalizedListing): PluginTrust {
  if (listing.signature && listing.sha256 && marketplacePublicKeys.length > 0) {
    return verifyListingSignature(listing.sha256, listing.signature)
      ? 'signed'
      : 'unsigned'
  }

  if (listing.sha256) return 'hashed'
  if (listing.bundled && !listing.downloadUrl) return 'bundled'

  return listing.downloadUrl ? 'unsigned' : 'bundled'
}

export function verifyListingSignature(
  sha256: string,
  signature: string,
  publicKeys: Array<string> = marketplacePublicKeys
): boolean {
  if (publicKeys.length === 0) return false

  const digest = Uint8Array.from(Buffer.from(sha256, 'hex'))
  const blob = Uint8Array.from(Buffer.from(signature, 'base64'))

  if (digest.length !== 32 || blob.length === 0) return false

  return publicKeys.some((key) => {
    try {
      return verify(null, digest, key, blob)
    } catch {
      return false
    }
  })
}

export function canInstallListing(
  listing: NormalizedListing,
  options: {
    allowUnsignedRemote: boolean
    launcherVersion: string
  }
): { ok: true } | { ok: false; reason: string } {
  if (!launcherMeetsMinimum(listing.minLauncherVersion, options.launcherVersion)) {
    return {
      ok: false,
      reason: `Needs Penny ${listing.minLauncherVersion} or newer.`,
    }
  }

  if (listing.bundled) return { ok: true }

  if (!listing.downloadUrl) {
    return { ok: false, reason: 'This listing has no download and is not bundled.' }
  }

  const trust = listingTrust(listing)

  if (trust === 'unsigned' && !options.allowUnsignedRemote) {
    return {
      ok: false,
      reason: 'Unsigned remote add-on. Enable unsigned remote add-ons to install it.',
    }
  }

  if (trust === 'unsigned' && listing.signature && marketplacePublicKeys.length > 0) {
    return { ok: false, reason: 'Catalog signature did not match a trusted key.' }
  }

  return { ok: true }
}

export function matchesSearch(
  listing: {
    author: string | null
    category: string | null
    description: string | null
    id: string
    name: string
  },
  query: string
): boolean {
  const needle = query.trim().toLowerCase()

  if (!needle) return true

  return [listing.id, listing.name, listing.description, listing.author, listing.category]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle))
}

export function parseOriginRecord(raw: unknown): PluginOriginRecord | null {
  if (!raw || typeof raw !== 'object') return null

  const record = raw as Record<string, unknown>
  const origin = record.origin

  if (origin !== 'bundled' && origin !== 'remote' && origin !== 'local') {
    return null
  }

  return {
    catalogUrl: asTrimmedString(record.catalogUrl) ?? undefined,
    installedAt: asTrimmedString(record.installedAt) ?? undefined,
    origin,
    sha256: asSha256(record.sha256) ?? undefined,
    treeHash: asSha256(record.treeHash) ?? undefined,
    version: asTrimmedString(record.version) ?? undefined,
  }
}

/**
 * Admission control before `require()`. This is not a sandbox — plugins still
 * run in Electron main with full Node — but unsigned remote code does not
 * execute unless the user opted in, and a hash mismatch refuses to load.
 */
export function shouldExecutePlugin(options: {
  allowUnsignedRemote: boolean
  disabled: boolean
  origin: PluginOrigin
  sha256: string | null
  treeHashMatches: boolean | null
}): { error: string | null; execute: boolean; status: 'active' | 'disabled' | 'error' } {
  if (options.disabled) {
    return { error: null, execute: false, status: 'disabled' }
  }

  if (options.origin === 'remote' && !options.sha256 && !options.allowUnsignedRemote) {
    return {
      error:
        'Unsigned remote add-on blocked. Enable unsigned remote add-ons to run it.',
      execute: false,
      status: 'error',
    }
  }

  if (options.origin === 'remote' && options.treeHashMatches === false) {
    return {
      error: 'Add-on files no longer match the hash recorded at install.',
      execute: false,
      status: 'error',
    }
  }

  return { error: null, execute: true, status: 'active' }
}

export function originTrust(
  origin: PluginOrigin,
  sha256: string | null
): PluginTrust {
  if (origin === 'bundled') return 'bundled'
  if (origin === 'local') return 'local'
  if (sha256) return 'hashed'

  return 'unsigned'
}

export function toMarketplacePlugin(
  listing: NormalizedListing,
  options: {
    allowUnsignedRemote: boolean
    enabled: boolean
    installedVersion: string | null
    launcherVersion: string
    listingSource: MarketplaceListingSource
  }
): MarketplacePlugin {
  const install = canInstallListing(listing, {
    allowUnsignedRemote: options.allowUnsignedRemote,
    launcherVersion: options.launcherVersion,
  })
  const installed = options.installedVersion !== null
  const updateAvailable =
    installed && isVersionNewer(listing.version, options.installedVersion)

  return {
    author: listing.author,
    blockedReason: install.ok ? null : install.reason,
    bundled: listing.bundled,
    category: listing.category,
    compatible: launcherMeetsMinimum(
      listing.minLauncherVersion,
      options.launcherVersion
    ),
    description: listing.description,
    downloadUrl: listing.downloadUrl,
    enabled: options.enabled,
    homepage: listing.homepage,
    id: listing.id,
    installed,
    installedVersion: options.installedVersion,
    listingSource: listing.bundled && options.listingSource !== 'remote'
      ? 'bundled'
      : options.listingSource,
    minLauncherVersion: listing.minLauncherVersion,
    name: listing.name,
    readmeUrl: listing.readmeUrl,
    repository: listing.repository,
    screenshots: listing.screenshots,
    sha256: listing.sha256,
    signature: listing.signature,
    trust: listingTrust(listing),
    updateAvailable,
    version: listing.version,
  }
}
