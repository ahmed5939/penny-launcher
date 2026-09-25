import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { useCallback, useEffect, useState } from 'react'

import { Callout } from './callout'
import { EmptyState } from './empty-state'

import { useGetSelectedAccount } from '../../hooks/accounts'

export type AccountResource<T> = {
  accountId: string | null
  /** Only ever the selected account's data — never a previous account's late reply. */
  data: T | null
  /**
   * Set when the last load failed. With `data` still present this means a
   * refresh failed and the page is showing older data.
   */
  error: string | null
  /** True while a load is in flight — including a background refresh with data on screen. */
  loading: boolean
  refresh: () => void
  /** When `data` was loaded (epoch ms), or null when there is none. */
  updatedAt?: number | null
}

type Deps = ReadonlyArray<string | number | boolean | null | undefined>

// ---------------------------------------------------------------------------
// Stale-while-revalidate cache
// ---------------------------------------------------------------------------

/** How many results survive navigation. Oldest-used entries go first. */
export const ACCOUNT_RESOURCE_CACHE_LIMIT = 50

type CacheEntry = { accountId: string; data: unknown; updatedAt: number }

// A Map iterates in insertion order, so re-inserting on use makes it an LRU.
const cache = new Map<string, CacheEntry>()

export function accountResourceCacheId(cacheKey: string, accountId: string, deps: Deps = []) {
  return [cacheKey, accountId, ...deps.map(String)].join('\u0000')
}

/** Read without touching recency — safe to call during render. */
export function peekAccountResourceCache<T>(id: string, accountId: string): { data: T; updatedAt: number } | undefined {
  const entry = cache.get(id)
  // The account id is part of the key already; checking it again means a
  // key collision can never show one account's data under another.
  if (!entry || entry.accountId !== accountId) return undefined
  return { data: entry.data as T, updatedAt: entry.updatedAt }
}

export function writeAccountResourceCache(id: string, accountId: string, data: unknown, updatedAt: number) {
  cache.delete(id)
  cache.set(id, { accountId, data, updatedAt })
  while (cache.size > ACCOUNT_RESOURCE_CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

function touchAccountResourceCache(id: string) {
  const entry = cache.get(id)
  if (!entry) return
  cache.delete(id)
  cache.set(id, entry)
}

/** Drop cached results — one account's (e.g. on sign-out) or all of them. */
export function clearAccountResourceCache(accountId?: string) {
  if (accountId === undefined) {
    cache.clear()
    return
  }
  for (const [id, entry] of cache) {
    if (entry.accountId === accountId) cache.delete(id)
  }
}

export function accountResourceCacheSize() {
  return cache.size
}

// ---------------------------------------------------------------------------
// F5 / Ctrl+R
// ---------------------------------------------------------------------------

const refreshers = new Set<() => void>()

function onRefreshEvent(event: Event) {
  if (refreshers.size === 0) return
  // Tell the keyboard handler the page handled it, so the router
  // invalidation fallback does not run as well.
  event.preventDefault()
  for (const refresh of [...refreshers]) refresh()
}

/** Run `refresh` on every `penny:refresh` window event until unsubscribed. */
export function subscribeToRefreshEvent(refresh: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  if (refreshers.size === 0) window.addEventListener('penny:refresh', onRefreshEvent)
  refreshers.add(refresh)
  return () => {
    refreshers.delete(refresh)
    if (refreshers.size === 0) window.removeEventListener('penny:refresh', onRefreshEvent)
  }
}

// ---------------------------------------------------------------------------
// State transitions (pure, so they can be tested without a DOM)
// ---------------------------------------------------------------------------

export type ResourceState<T> = {
  key: string | null
  data: T | null
  error: string | null
  loading: boolean
  updatedAt: number | null
}

export const emptyResourceState: ResourceState<never> = { key: null, data: null, error: null, loading: false, updatedAt: null }

/** A load starts: keep this key's data (or the cached copy) on screen. */
export function resourceLoadStarted<T>(
  previous: ResourceState<T>,
  key: string,
  cached?: { data: T; updatedAt: number }
): ResourceState<T> {
  if (previous.key === key && previous.data !== null) {
    return { ...previous, error: null, loading: true }
  }
  return { key, data: cached?.data ?? null, error: null, loading: true, updatedAt: cached?.updatedAt ?? null }
}

export function resourceLoadSucceeded<T>(key: string, data: T, updatedAt: number): ResourceState<T> {
  return { key, data, error: null, loading: false, updatedAt }
}

/** A load failed: a refresh failure keeps the data it was refreshing. */
export function resourceLoadFailed<T>(previous: ResourceState<T>, key: string, error: string): ResourceState<T> {
  const same = previous.key === key
  return { key, data: same ? previous.data : null, error, loading: false, updatedAt: same ? previous.updatedAt : null }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Read something for the selected account, the one way every tool does it.
 *
 * - Keyed on the account id only, so a token refresh or a display-name change
 *   re-renders without refetching.
 * - Switching account clears the old data immediately and drops any reply
 *   that arrives for the previous one — five screens had this guard written
 *   by hand, and it is the bug that shows one account's inventory under
 *   another's name.
 * - `deps` are extra inputs that should also refetch (a backpack/storage
 *   switch). Keep them primitive.
 * - `cacheKey` opts into stale-while-revalidate: coming back to a page shows
 *   the last result for this account at once and refetches behind it.
 * - A failed refresh keeps the data on screen and reports the error beside it.
 * - F5 / Ctrl+R refreshes every mounted resource.
 */
export function useAccountResource<T>(
  load: (accountId: string) => Promise<T>,
  { cacheKey, deps = [], fallbackError = 'Could not load this page. Refresh to retry.', owner }: {
    /**
     * Unique name for this data ("stw.backpack"). When set, results are cached
     * per account and deps and shown instantly on the next mount while a
     * fresh copy loads in the background.
     */
    cacheKey?: string
    deps?: Deps
    fallbackError?: string
    /** Reads the account a result belongs to, when the result says. */
    owner?: (result: T) => string | undefined
  } = {}
): AccountResource<T> {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null
  const key = accountId ? [accountId, ...deps].join('\u0000') : null
  const cacheId = accountId && cacheKey ? accountResourceCacheId(cacheKey, accountId, deps) : null
  const [state, setState] = useState<ResourceState<T>>(emptyResourceState)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!accountId || !key) {
      setState(emptyResourceState)
      return
    }
    let active = true
    const cached = cacheId ? peekAccountResourceCache<T>(cacheId, accountId) : undefined
    if (cacheId) touchAccountResourceCache(cacheId)
    setState((previous) => resourceLoadStarted(previous, key, cached))
    load(accountId)
      .then((result) => {
        if (!active) return
        const belongsTo = owner?.(result)
        if (belongsTo && belongsTo !== accountId) return
        const now = Date.now()
        if (cacheId) writeAccountResourceCache(cacheId, accountId, result, now)
        setState(resourceLoadSucceeded(key, result, now))
      })
      .catch((cause: unknown) => {
        if (!active) return
        const message = cause instanceof Error && cause.message ? cause.message : fallbackError
        setState((previous) => resourceLoadFailed(previous, key, message))
      })
    return () => {
      active = false
    }
    // `load`, `owner` and `fallbackError` are read fresh each run on purpose;
    // only the key and an explicit refresh should trigger a fetch.
  }, [key, attempt])

  const refresh = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!accountId) return
    return subscribeToRefreshEvent(refresh)
  }, [accountId, refresh])

  if (state.key === key) {
    return { accountId, data: state.data, error: state.error, loading: state.loading, refresh, updatedAt: state.updatedAt }
  }
  // First render after mount or a key change, before the effect has run:
  // show the cached copy straight away rather than a loading frame.
  const cached = cacheId && accountId ? peekAccountResourceCache<T>(cacheId, accountId) : undefined
  return { accountId, data: cached?.data ?? null, error: null, loading: Boolean(accountId), refresh, updatedAt: cached?.updatedAt ?? null }
}

function formatTime(epoch: number) {
  return new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * The three states every account page has before it has content: no account,
 * failed, loading. Renders `children` only once there is data, and keeps
 * showing the last data during a refresh instead of flashing a spinner. A
 * failed refresh keeps the data and adds a compact warning above it.
 */
export function AccountResourceGate<T>({
  children,
  icon,
  loading,
  resource,
  what,
}: {
  children: (data: T) => ReactNode
  icon: LucideIcon
  /** Say what is actually happening when it is slow enough to read. */
  loading?: { title: string; description: string }
  resource: AccountResource<T>
  /** Lower-case noun for the messages: "the backpack", "Ventures progress". */
  what: string
}) {
  if (!resource.accountId) {
    return <EmptyState description={`Select an account in the title bar to see ${what}.`} icon={icon} title="Choose an account" />
  }
  if (resource.data !== null && resource.data !== undefined) {
    if (!resource.error) return <>{children(resource.data)}</>
    const from = resource.updatedAt ? `showing data from ${formatTime(resource.updatedAt)}` : 'showing earlier data'
    return (
      <>
        <div role="alert">
          <Callout className="py-2.5" tone="warning">
            Couldn't refresh — {from}. {resource.error}
          </Callout>
        </div>
        {children(resource.data)}
      </>
    )
  }
  if (resource.error) {
    return (
      <div role="alert">
        <Callout title={`Could not load ${what}`} tone="danger">{resource.error}</Callout>
      </div>
    )
  }
  return (
    <div role="status">
      <EmptyState description={loading?.description ?? 'Reading the account from Epic.'} icon={icon} title={loading?.title ?? `Loading ${what}…`} />
    </div>
  )
}
