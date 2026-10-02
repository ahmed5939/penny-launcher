import type {
  SpriteAccountSummary,
  SpriteHistoryPayload,
} from '../../kernel/core/sprite-history-model'

import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * The sprite change log and each account's last-known sprite state.
 *
 * Loaded once when the shell mounts and kept current by the main process,
 * which pushes the whole payload after every change — so the account
 * switcher's equipped-sprite badge, the hub tile and the History tab all
 * read the same copy and none of them has to ask again.
 */

type SpriteHistoryState = {
  payload: SpriteHistoryPayload | null
  setPayload: (payload: SpriteHistoryPayload) => void
  /** Optimistic, so the switch does not flick back while the write lands. */
  setWatch: (enabled: boolean, intervalMinutes: number) => void
}

export const useSpriteHistoryStore = create<SpriteHistoryState>()((set) => ({
  payload: null,
  setPayload: (payload) => set({ payload }),
  setWatch: (enabled, intervalMinutes) => {
    set((state) =>
      state.payload
        ? { payload: { ...state.payload, watch: { enabled, intervalMinutes } } }
        : state
    )
    window.electronAPI.setSpritesWatch(enabled, intervalMinutes)
  },
}))

let requested = false

/**
 * Listen for pushes while mounted, and ask for the payload the first time
 * any caller mounts. Safe to call from more than one place.
 */
export function useSpriteHistorySync() {
  const setPayload = useSpriteHistoryStore((state) => state.setPayload)

  useEffect(() => {
    const listener = window.electronAPI.responseSpritesHistory(
      async (payload) => {
        setPayload(payload)
      }
    )

    if (!requested) {
      requested = true
      window.electronAPI.requestSpritesHistory()
    }

    return () => {
      listener.removeListener()
    }
  }, [])
}

/** The last-known equipped sprite of an account; null when unknown. */
export function useEquippedSprite(
  accountId: string | null | undefined
): SpriteAccountSummary['equipped'] {
  return useSpriteHistoryStore((state) =>
    accountId ? (state.payload?.accounts[accountId]?.equipped ?? null) : null
  )
}
