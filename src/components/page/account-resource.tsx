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
  error: string | null
  loading: boolean
  refresh: () => void
}

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
 */
export function useAccountResource<T>(
  load: (accountId: string) => Promise<T>,
  { deps = [], fallbackError = 'Could not load this page. Refresh to retry.', owner }: {
    deps?: ReadonlyArray<string | number | boolean | null | undefined>
    fallbackError?: string
    /** Reads the account a result belongs to, when the result says. */
    owner?: (result: T) => string | undefined
  } = {}
): AccountResource<T> {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null; loading: boolean }>({ key: null, data: null, error: null, loading: false })
  const [attempt, setAttempt] = useState(0)
  const key = accountId ? [accountId, ...deps].join('\u0000') : null

  useEffect(() => {
    if (!accountId) {
      setState({ key: null, data: null, error: null, loading: false })
      return
    }
    let active = true
    setState((previous) => ({ key, data: previous.key === key ? previous.data : null, error: null, loading: true }))
    load(accountId)
      .then((result) => {
        if (!active) return
        const belongsTo = owner?.(result)
        if (belongsTo && belongsTo !== accountId) return
        setState({ key, data: result, error: null, loading: false })
      })
      .catch((cause: unknown) => {
        if (active) setState({ key, data: null, error: cause instanceof Error && cause.message ? cause.message : fallbackError, loading: false })
      })
    return () => {
      active = false
    }
    // `load`, `owner` and `fallbackError` are read fresh each run on purpose;
    // only the key and an explicit refresh should trigger a fetch.
  }, [key, attempt])

  const refresh = useCallback(() => setAttempt((n) => n + 1), [])
  const current = state.key === key
  return { accountId, data: current ? state.data : null, error: current ? state.error : null, loading: current ? state.loading : Boolean(accountId), refresh }
}

/**
 * The three states every account page has before it has content: no account,
 * failed, loading. Renders `children` only once there is data, and keeps
 * showing the last data during a refresh instead of flashing a spinner.
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
  if (resource.error) {
    return (
      <div role="alert">
        <Callout title={`Could not load ${what}`} tone="danger">{resource.error}</Callout>
      </div>
    )
  }
  if (!resource.data) {
    return (
      <div role="status">
        <EmptyState description={loading?.description ?? 'Reading the account from Epic.'} icon={icon} title={loading?.title ?? `Loading ${what}…`} />
      </div>
    )
  }
  return <>{children(resource.data)}</>
}
