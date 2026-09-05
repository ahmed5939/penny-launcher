/** User-visible effects an add-on declares in plugin.json. */
export const PLUGIN_CAPABILITIES = [
  'background', 'changes-app-behavior', 'accounts', 'notifications',
  'network', 'filesystem', 'opens-windows',
] as const

export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number]

export const PLUGIN_PERMISSIONS = [
  'accounts:read', 'quests:read', 'settings:read', 'storage', 'navigation',
  'notifications', 'external-links', 'ui',
] as const
export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number]

export type PluginManifest = {
  runtime?: 'sandbox'
  permissions?: PluginPermission[]
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
  status: 'running' | 'error' | 'disabled' | 'review'
  error: string | null
  repository: string | null
  capabilities: Array<PluginCapability>
  /** Whether the plugin exposes a window/action the user can open. */
  canOpen: boolean
  permissions: PluginPermission[]
  safeMode: boolean
  canRollback: boolean
  ui: PluginUI
  jobs: PluginJob[]
  logs: PluginLog[]
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
  permissions: PluginPermission[]
}

export type PluginActionResult = {
  ok: boolean
  error?: string
}

export type PluginReadmeResult = PluginActionResult & {
  content?: string
}

export type PluginOpenResult = PluginActionResult

export type PluginUI = {
  panels: Array<{ id: string; title: string; body: string }>
  actions: Array<{ id: string; label: string }>
  settings: Array<{ id: string; label: string; type: 'text' | 'boolean'; default?: string | boolean }>
}
export type PluginJob = { id: string; label: string; status: 'running' | 'completed' | 'cancelled' | 'error'; error?: string }
export type PluginLog = { time: string; level: 'info' | 'error'; message: string }
export type PluginReview = {
  token: string
  manifest: PluginManifest
  digest: string
  previousVersion: string | null
  addedPermissions: PluginPermission[]
  installed: boolean
  readme: string
}
export type PluginReviewResult = PluginActionResult & { review?: PluginReview }
export type PluginManageRequest =
  | { action: 'disable' | 'enable' | 'reload' | 'rollback' | 'cancel-job'; id: string; jobId?: string }
  | { action: 'safe-mode'; enabled: boolean }
  | { action: 'run-action'; id: string; actionId: string }
  | { action: 'save-settings'; id: string; values: Record<string, string | boolean> }
export type PluginSettingsResult = PluginActionResult & { values?: Record<string, string | boolean> }
