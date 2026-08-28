/**
 * Remote add-on catalog.
 *
 * Penny DB hosts the live listing so new plugins can appear without a
 * launcher rebuild. The URL is configurable; this is the factory default.
 */
export const defaultMarketplaceCatalogUrl =
  'https://pennydb.net/api/marketplace'

export const marketplaceSchemaVersion = 1

/** Catalog JSON is metadata, not packages. Two megabytes is generous. */
export const marketplaceCatalogMaxBytes = 2_000_000

export const marketplaceCatalogTimeoutMs = 15_000

/** Cached catalog is kept even when stale — better than an empty store. */
export const marketplaceCatalogMemoryTtlMs = 5 * 60 * 1000

export const marketplaceArchiveMaxBytes = 25 * 1024 * 1024

export const marketplaceArchiveMaxUncompressedBytes = 80 * 1024 * 1024

export const marketplaceArchiveMaxFiles = 1_000

export const marketplaceReadmeMaxBytes = 200_000

/**
 * Optional Ed25519 public keys (SPKI PEM) that may sign a listing's SHA-256
 * digest. Empty until Penny DB starts signing packages — a matching `sha256`
 * remains the practical integrity check. Adding a key here is enough; no
 * launcher protocol change is required.
 */
export const marketplacePublicKeys: Array<string> = []

export const pluginOriginFileName = '.penny-origin.json'

export const pluginIdPattern = /^[a-z0-9-]{1,64}$/
