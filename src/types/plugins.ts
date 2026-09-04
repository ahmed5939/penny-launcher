/** User-visible effects an add-on declares in plugin.json. */
export type PluginCapability = 'background' | 'changes-app-behavior'

export type PluginManifest = {
  id: string
  name: string
  description?: string
  version?: string
  author?: string
  category?: string
  /** Effects shown to the user before installation. */
  capabilities?: Array<PluginCapability>
  /** Documentation file relative to the plugin folder. Defaults to README.md */
  readme?: string
  /** Public source repository shown in the marketplace. */
  repository?: string
  /** Entry file relative to the plugin folder. Defaults to main.js */
  entry?: string
  /**
   * Minimum plugin API version the add-on needs (see PLUGIN_API_VERSION).
   * Omitted means "any" — the original three-member context is enough.
   */
  apiVersion?: number
}

/** Account fields plugins may see. Never tokens, device ids or secrets. */
export type PluginAccountInfo = {
  accountId: string
  displayName: string
  customDisplayName: string
}

/** The renderer's account scope, as raw ids. */
export type PluginAccountScopeIds = {
  primary: string | null
  members: Array<string>
}

/** The renderer's account scope, resolved to visible account info. */
export type PluginAccountScope = {
  primary: PluginAccountInfo | null
  members: Array<PluginAccountInfo>
}

/** Settings plugins may read — a stable subset, not the raw settings file. */
export type PluginSettings = {
  /** Directory containing the Fortnite Win64 binaries. */
  gamePath: string
  /** Process name the launcher watches for (e.g. the game executable). */
  customProcess: string
  /** User agent the launcher presents to Epic services. */
  userAgent: string
}

export type PluginEventName =
  | 'accounts-changed'
  | 'account-scope-changed'
  | 'settings-changed'

export type PluginSource = 'user'

export type PluginSummary = {
  id: string
  name: string
  description: string | null
  version: string | null
  source: PluginSource
  status: 'running' | 'error'
  error: string | null
  repository: string | null
  capabilities: Array<PluginCapability>
  /** Whether the plugin exposes a window/action the user can open. */
  canOpen: boolean
}

export type MarketplacePlugin = {
  id: string
  name: string
  description: string | null
  version: string | null
  author: string | null
  category: string | null
  repository: string | null
  capabilities: Array<PluginCapability>
  installed: boolean
}

export type PluginActionResult = {
  ok: boolean
  error?: string
}

export type PluginReadmeResult = PluginActionResult & {
  content?: string
}

export type PluginOpenResult = PluginActionResult
