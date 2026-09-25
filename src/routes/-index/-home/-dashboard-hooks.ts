import type { AccountData } from '../../../types/accounts'
import type { ExpeditionsEntry } from '../../../kernel/core/expeditions'
import type { QuestsPayload } from '../../../kernel/core/quests'
import type { TimelinePayload } from '../../../kernel/core/timeline'
import type { AutoExpeditionsData } from '../../../kernel/startup/auto-expeditions'
import type { RewardsStatus } from '../../../features/automation-rewards/model'
import type { DailyRerollStatus } from '../../../features/daily-reroll/policy'
import type { VenturesProgress } from '../../../features/ventures/model'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAccountResource } from '../../../components/page'
import { useDocumentVisible } from '../../../hooks/ui/document-visibility'
import { useGetSelectedAccount } from '../../../hooks/accounts'

/**
 * Data for the home dashboard, from IPC the tool pages already use. Nothing
 * here asks the main process for anything new.
 *
 * Home is visited far more often than any tool. `cacheKey` paints the last
 * result at once on the way back; the short TTL below stops that background
 * revalidation from reaching Epic again within a minute. Refresh (the button
 * or F5) always does.
 */

const accountTtlMs = 60_000
const cache = new Map<string, { at: number; value: Promise<unknown> }>()

function cached<T>(key: string, force: boolean, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (!force && hit && Date.now() - hit.at < accountTtlMs) return hit.value as Promise<T>
  const value = load()
  cache.set(key, { at: Date.now(), value })
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key)
  })
  return value
}

type Listener = { removeListener: () => void }

/**
 * Turns one of the older send/on IPC pairs into a promise: subscribe, send,
 * resolve on the first reply `accept` recognises. Replies for other accounts
 * (another page asked too) are ignored rather than taken.
 */
function awaitReply<T>(subscribe: (callback: (reply: T) => Promise<void>) => Listener, send: () => void, accept: (reply: T) => boolean, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const listener = subscribe(async (reply) => {
      if (settled || !accept(reply)) return
      settled = true
      window.clearTimeout(timer)
      listener.removeListener()
      resolve(reply)
    })
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      listener.removeListener()
      reject(new Error(`Epic did not return ${what} in time. Try Refresh.`))
    }, 45_000)
    send()
  })
}

/** `useAccountResource` plus the short per-account cache and a forcing refresh. */
function useCachedAccountResource<T>(name: string, load: (account: AccountData) => Promise<T>, owner?: (result: T) => string | undefined) {
  const { selected } = useGetSelectedAccount()
  const force = useRef(false)
  const account = useRef(selected)
  account.current = selected

  // F5 dispatches this before the resource refetches; make that fetch real.
  useEffect(() => {
    const onRefresh = () => {
      force.current = true
    }
    window.addEventListener('penny:refresh', onRefresh)
    return () => window.removeEventListener('penny:refresh', onRefresh)
  }, [])

  const resource = useAccountResource(
    (accountId) => {
      const current = account.current
      const forced = force.current
      force.current = false
      if (!current || current.accountId !== accountId) return Promise.reject(new Error('The selected account changed. Try Refresh.'))
      return cached(`${name}:${accountId}`, forced, () => load(current))
    },
    { cacheKey: `home.${name}`, owner }
  )

  const { refresh: reload } = resource
  const refresh = useCallback(() => {
    force.current = true
    reload()
  }, [reload])

  return { ...resource, refresh }
}

export function useHomeQuests() {
  return useCachedAccountResource<QuestsPayload>(
    'quests',
    (account) =>
      awaitReply<QuestsPayload>(
        (callback) => window.electronAPI.responseQuests(callback),
        () => window.electronAPI.requestQuests(account),
        (reply) => reply.accountId === account.accountId,
        'your quests'
      ).then((reply) => {
        if (reply.errorMessage) throw new Error(reply.errorMessage)
        return reply
      }),
    (result) => result.accountId
  )
}

export function useHomeExpeditions() {
  return useCachedAccountResource<ExpeditionsEntry>('expeditions', (account) =>
    awaitReply<Record<string, ExpeditionsEntry>>(
      (callback) => window.electronAPI.responseExpeditions(callback),
      () => window.electronAPI.requestExpeditions([account]),
      (reply) => account.accountId in reply,
      'your expeditions'
    ).then((reply) => {
      const entry = reply[account.accountId]
      if (entry.errorMessage) throw new Error(entry.errorMessage)
      return entry
    }),
    (result) => result.accountId
  )
}

export function useHomeVentures() {
  return useCachedAccountResource<VenturesProgress>('ventures', (account) => window.electronAPI.requestVentures(account.accountId), (result) => result.accountId)
}

/**
 * Local settings and history the automations keep for every account. Cheap
 * (no Epic call) and written in the background, so it is polled while the
 * window is visible instead of cached.
 */
function usePolled<T>(load: () => Promise<T>, intervalMs: number) {
  const visible = useDocumentVisible()
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null })

  useEffect(() => {
    if (!visible) return
    let live = true
    const run = () =>
      load()
        .then((data) => {
          if (live) setState({ data, error: null })
        })
        .catch(() => {
          if (live) setState((previous) => ({ data: previous.data, error: 'Could not read automation status.' }))
        })
    void run()
    const interval = window.setInterval(() => void run(), intervalMs)
    return () => {
      live = false
      window.clearInterval(interval)
    }
    // `load` is a stable module-level IPC call at every call site.
  }, [visible, intervalMs])

  return state
}

export function useAutomationRewardsStatus() {
  return usePolled<RewardsStatus>(() => window.electronAPI.getAutomationRewards(), 30_000)
}

export function useDailyRerollStatus() {
  return usePolled<DailyRerollStatus>(() => window.electronAPI.getAutoDailyRerollStatus(), 60_000)
}

export function useAutoExpeditionsStatus() {
  return usePolled<AutoExpeditionsData>(() => window.electronAPI.getAutoExpeditionsStatus() as Promise<AutoExpeditionsData>, 60_000)
}

/** The timeline is cached for a week in the main process; one read per app session is plenty. */
let timelineReply: TimelinePayload | null = null

export function useHomeTimeline() {
  const [data, setData] = useState<TimelinePayload | null>(timelineReply)

  useEffect(() => {
    if (timelineReply) return
    const listener = window.electronAPI.responseTimeline(async (response) => {
      if (!response.errorMessage) timelineReply = response
      setData(response)
    })
    window.electronAPI.requestTimeline()
    return () => {
      listener.removeListener()
    }
  }, [])

  return data
}

/** `Date.now()`, re-read every 30 seconds while the window is visible — enough for minute countdowns. */
export function useMinuteClock() {
  const visible = useDocumentVisible()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!visible) return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [visible])

  return now
}
