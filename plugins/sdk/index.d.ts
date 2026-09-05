/** Penny sandbox API v4. All launcher operations cross a permission-checked bridge. */
export type Permission = 'accounts:read' | 'quests:read' | 'settings:read' | 'storage' | 'navigation' | 'notifications' | 'external-links' | 'ui'
export type Account = { accountId: string; displayName: string; customDisplayName: string }
export type Scope = { primary: Account | null; members: Account[] }
export type Quest = { itemId: string; templateId: string; state: string; pinned: boolean; objectives: Array<{ backendName: string; completed: number }> }
export type Setting = { id: string; label: string } & ({ type: 'text'; default?: string } | { type: 'boolean'; default?: boolean })
export type Controller = { open?: () => unknown; deactivate?: () => unknown }
export type Context = {
  apiVersion: 4
  manifest: { id: string; name: string; version?: string; permissions?: Permission[]; runtime: 'sandbox' }
  log(message: unknown): Promise<void>
  accounts: {
    list(): Promise<Account[]>
    getScoped(): Promise<Scope>
    /** Read-only authenticated operation. Account must remain in the current scope. */
    quests(accountId: string): Promise<{ accountId: string; quests: Quest[]; rerolls: number; errorMessage?: string }>
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
