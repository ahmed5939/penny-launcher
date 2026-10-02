import type { AccountAvatar } from '../../kernel/core/account-extras'

import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * Avatars by account id, for linked accounts and anyone else on screen.
 *
 * Every `<AccountAvatar>` asks for its own id, so a friends list of three
 * hundred rows would be three hundred asks. They are gathered for a moment
 * and sent as one message instead; the main process splits that into calls
 * of a hundred and caches the answers, and an id asked for recently is not
 * asked for again.
 */

export type AccountAvatarsState = {
  avatars: Record<string, AccountAvatar>

  merge: (avatars: Record<string, AccountAvatar>) => void
}

export const useAccountAvatarsStore = create<AccountAvatarsState>()((set) => ({
  avatars: {},

  merge: (avatars) =>
    set((state) => ({ avatars: { ...state.avatars, ...avatars } })),
}))

/** Matches the main process's cache: asking sooner only gets the same answer. */
const askAgainAfterMs = 30 * 60 * 1000

/** An ask that got no answer at all (no token yet, a network blip) retries sooner. */
const askUnansweredAfterMs = 60 * 1000

/** Long enough for a list's rows to mount, short enough not to be seen. */
const gatherForMs = 120

const askedAt = new Map<string, number>()
const queue = new Set<string>()
let flushTimer: number | null = null
let listening = false

function listen() {
  if (listening) {
    return
  }

  listening = true
  window.electronAPI.responseAccountAvatars(async (response) => {
    if (response?.avatars && typeof response.avatars === 'object') {
      useAccountAvatarsStore.getState().merge(response.avatars)
    }
  })
}

function flush() {
  flushTimer = null

  const ids = [...queue]

  queue.clear()

  if (ids.length === 0) {
    return
  }

  listen()
  window.electronAPI.requestAccountAvatars(ids)
}

/** Queue ids for the next batch. Safe to call on every render. */
export function requestAccountAvatars(accountIds: ReadonlyArray<string>) {
  const now = Date.now()
  const known = useAccountAvatarsStore.getState().avatars

  for (const accountId of accountIds) {
    const last = askedAt.get(accountId)
    const wait = known[accountId] ? askAgainAfterMs : askUnansweredAfterMs

    if (!accountId || (last !== undefined && now - last < wait)) {
      continue
    }

    askedAt.set(accountId, now)
    queue.add(accountId)
  }

  if (queue.size > 0 && flushTimer === null) {
    flushTimer = window.setTimeout(flush, gatherForMs)
  }
}

/**
 * One account's avatar, or null while unknown or when it has none. Asks for
 * it on mount unless `enabled` is false — the component holds it back until
 * the avatar is near the viewport.
 */
export function useAccountAvatar(
  accountId: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const avatar = useAccountAvatarsStore((state) =>
    accountId ? state.avatars[accountId] : undefined
  )

  useEffect(() => {
    if (accountId && enabled) {
      requestAccountAvatars([accountId])
    }
  }, [accountId, enabled])

  return avatar ?? null
}
