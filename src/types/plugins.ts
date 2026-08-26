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
  /** Entry file relative to the plugin folder. Defaults to main.js */
  entry?: string
}

export type PluginSource = 'user'

export type PluginSummary = {
  id: string
  name: string
  description: string | null
  version: string | null
  source: PluginSource
  status: 'active' | 'error'
  error: string | null
  repository: string | null
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
