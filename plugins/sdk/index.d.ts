/** Penny sandbox API v5. All launcher operations cross a permission-checked bridge. */
export type Permission = 'accounts:read' | 'quests:read' | 'settings:read' | 'storage' | 'navigation' | 'notifications' | 'external-links' | 'ui' | 'inventory:read' | 'inventory:recycle' | 'epic-launcher:close' | 'system:read' | 'displays:read' | 'power:read' | 'fortnite:profiles' | 'fortnite:commands' | 'eos:locker:read'
export type Account = { accountId: string; displayName: string; customDisplayName: string }
export type Scope = { primary: Account | null; members: Account[] }
export type Quest = { itemId: string; templateId: string; state: string; pinned: boolean; objectives: Array<{ backendName: string; completed: number }> }
export type InventoryItem = {
  itemId: string; templateId: string
  kind: 'hero' | 'schematic' | 'defender' | 'survivor'
  name: string; subtitle: string | null
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
  tier: number; level: number; quantity: number
  lockedReason: 'favorite' | 'in-use' | null
  personality: string | null; setBonus: string | null; portrait: string | null
  alterations: string[]
}
export type MCPProfileId = 'campaign' | 'athena' | 'common_core' | 'theater0' | 'outpost0' | 'collection_book_people0' | 'collection_book_schematics0'
export type MCPOperation = 'QueryProfile' | 'ClientQuestLogin' | 'SetPinnedQuests' | 'FortRerollDailyQuest' | 'ClaimQuestReward' | 'ClaimMissionAlertRewards' | 'ClaimDifficultyIncreaseRewards' | 'RefreshExpeditions' | 'ClaimCollectedResources' | 'CollectExpedition' | 'StartExpedition' | 'AbandonExpedition' | 'AssignWorkerToSquadBatch' | 'AssignHeroToLoadout' | 'AssignDefenderToLoadout' | 'AssignWeaponToDefender' | 'SetActiveHeroLoadout' | 'ClearHeroLoadout' | 'AssignTeamPerkToLoadout' | 'AssignGadgetToLoadout'
export type GameProfile = {
  accountId: string; profileId: MCPProfileId; filtered: true
  rvn?: number; commandRevision?: number
  items: Record<string, { templateId: string; quantity: number; attributes: Record<string, unknown> }>
  stats: { attributes: Record<string, unknown> }
}
export type MCPCommandResult = { accountId: string; operation: MCPOperation; profileId: MCPProfileId; cancelled: boolean; applied: boolean }
export type Setting = { id: string; label: string } & ({ type: 'text'; default?: string } | { type: 'boolean'; default?: boolean })
export type Controller = { open?: () => unknown; deactivate?: () => unknown }
export type Context = {
  apiVersion: 5
  manifest: { id: string; name: string; version?: string; permissions?: Permission[]; runtime: 'sandbox'; fortnite?: { profiles: MCPProfileId[]; operations: MCPOperation[] } }
  log(message: unknown): Promise<void>
  accounts: {
    list(): Promise<Account[]>
    getScoped(): Promise<Scope>
    /** Read-only authenticated operation. Account must remain in the current scope. */
    quests(accountId: string): Promise<{ accountId: string; quests: Quest[]; rerolls: number; errorMessage?: string }>
  }
  inventory: {
    /** Selected accounts only; at most one read per 10 seconds. No raw profile or credentials. */
    read(accountId: string): Promise<{ accountId: string; items: InventoryItem[] }>
    /** 1–50 unique ids; Penny asks the user to approve the exact items. Run inside a job. */
    recycle(accountId: string, itemIds: string[]): Promise<{ accountId: string; recycled: number; skipped: number; cancelled: boolean }>
  }
  /** Windows only. Force-closes the fixed Epic launcher image; no process-tree termination. */
  epicLauncher: { close(): Promise<{ closed: boolean }> }
  /** Read-only desktop information. Each method requires its own permission and allows one read/second. */
  desktop: {
    system(): Promise<{ platform: string; release: string; architecture: string; totalMemoryBytes: number; availableMemoryBytes: number; uptimeSeconds: number }>
    /** Up to 16 displays. Sizes are device-independent pixels; no hardware IDs or screenshots. */
    displays(): Promise<Array<{ index: number; primary: boolean; width: number; height: number; workAreaWidth: number; workAreaHeight: number; scaleFactor: number }>>
    power(): Promise<{ onBattery: boolean }>
  }
  mcp: {
    /** Host-supported catalog; availability does not grant access. */
    operations(): Promise<Array<{ operation: MCPOperation; profiles: MCPProfileId[]; description: string; permission: 'fortnite:profiles' | 'fortnite:commands'; confirmationRequired: boolean; bodySchema: Record<string, unknown> }>>
    /** Requires fortnite:profiles and declared profile + QueryProfile operation. */
    queryProfile(accountId: string, profileId: MCPProfileId): Promise<GameProfile>
    /** Strict host payload schemas. Writes require fortnite:commands and an Allow once dialog; use a job. */
    request(accountId: string, request: { operation: MCPOperation; profileId: MCPProfileId; body?: Record<string, unknown> }): Promise<GameProfile | MCPCommandResult>
  }
  eos: {
    /** Selected account only; tokens, unknown fields and customizations are never returned. */
    locker(accountId: string): Promise<{ accountId: string; filtered: true; activeLoadoutGroup: { loadouts: Record<string, { shuffleType?: string; loadoutSlots?: Array<{ slotTemplate: string; equippedItemId?: string }> }> } }>
  }
  storage: {
    get(key: string, fallback?: unknown): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<void>
    all(): Promise<Record<string, unknown>>
  }
  settings: { get(): Promise<{ gamePath: string; customProcess: string; userAgent: string }> }
  openRoute(route: string): Promise<void>
  openExternal(url: string): Promise<void>
  notifications: { show(title: string, body: string): Promise<boolean> }
  events: {
    on(name: 'accounts-changed' | 'account-scope-changed' | 'settings-changed' | 'plugin-settings-changed', listener: (payload: unknown) => unknown): () => void
  }
  lifecycle: { signal: AbortSignal; add(cleanup: () => unknown): () => void }
  timers: { every(callback: () => unknown, milliseconds: number): () => void }
  ui: {
    register(contributions: {
      panels?: Array<{ id: string; title: string; body: string }>
      settings?: Setting[]
      actions?: Array<{ id: string; label: string; run: () => unknown }>
    }): Promise<void>
    getSettings(): Promise<Record<string, string | boolean>>
  }
  jobs: {
    /** Resolves after recording success, failure or cancellation; do not await long jobs in Open/actions. */
    run(id: string, label: string, task: (signal: AbortSignal) => Promise<void>): Promise<void>
  }
}
export type Activate = (context: Context) => Controller | void | Promise<Controller | void>
