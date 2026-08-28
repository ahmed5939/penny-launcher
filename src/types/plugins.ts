export type PluginManifest = {
  id: string
  name: string
  description?: string
  version?: string
  author?: string
  category?: string
  /** Documentation file relative to the plugin folder. Defaults to README.md */
  readme?: string
  /** Public source repository shown in the marketplace. */
  repository?: string
  homepage?: string
  /** Entry file relative to the plugin folder. Defaults to main.js */
  entry?: string
}

/** Where an installed add-on came from. */
export type PluginOrigin = 'bundled' | 'remote' | 'local'

export type PluginSource = PluginOrigin

export type PluginTrust = 'bundled' | 'hashed' | 'signed' | 'unsigned' | 'local'

export type PluginStatus = 'active' | 'error' | 'disabled'

export type PluginSummary = {
  id: string
  name: string
  description: string | null
  version: string | null
  source: PluginSource
  origin: PluginOrigin
  status: PluginStatus
  error: string | null
  repository: string | null
  homepage: string | null
  trust: PluginTrust
  enabled: boolean
  updateAvailable: boolean
  /** Whether the plugin exposes a window/action the user can open. */
  canOpen: boolean
}

export type MarketplaceListingSource = 'remote' | 'cache' | 'bundled'

export type MarketplacePlugin = {
  id: string
  name: string
  description: string | null
  version: string | null
  author: string | null
  category: string | null
  homepage: string | null
  repository: string | null
  screenshots: Array<string>
  minLauncherVersion: string | null
  downloadUrl: string | null
  sha256: string | null
  signature: string | null
  readmeUrl: string | null
  bundled: boolean
  listingSource: MarketplaceListingSource
  trust: PluginTrust
  installed: boolean
  installedVersion: string | null
  updateAvailable: boolean
  enabled: boolean
  compatible: boolean
  /** Why Install is unavailable, when it is. */
  blockedReason: string | null
}

export type MarketplaceCatalogStatus = 'live' | 'cache' | 'bundled'

export type MarketplaceSnapshot = {
  allowUnsignedRemote: boolean
  catalogStatus: MarketplaceCatalogStatus
  catalogUrl: string
  fetchedAt: string | null
  plugins: Array<MarketplacePlugin>
  warning: string | null
}

export type MarketplaceSettings = {
  allowUnsignedRemote: boolean
  catalogUrl: string
}

export type PluginActionResult = {
  ok: boolean
  error?: string
}

export type PluginReadmeResult = PluginActionResult & {
  content?: string
}

export type PluginOpenResult = PluginActionResult

export type PluginOriginRecord = {
  catalogUrl?: string
  installedAt?: string
  origin: PluginOrigin
  sha256?: string
  treeHash?: string
  version?: string
}
