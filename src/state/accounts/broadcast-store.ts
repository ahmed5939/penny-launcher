import { useEffect } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { useAccountListStore } from './list'

/**
 * A store for a read that covers every linked account at once.
 *
 * The main process checks the accounts one after another and answers as
 * each lands, then once more with the full set (`complete`) so accounts
 * removed since drop out. This side asks on mount, again when an account is
 * added, and not again sooner than `askAgainAfterMs` unless refreshed. A
 * check that never finishes stops showing as running after `giveUpAfterMs`.
 *
 * The rest of each reply (anything besides `accounts` and `complete`) is
 * kept as `last`, for reads that also carry data shared by every account.
 */

type Payload<Entry> = { accounts?: Record<string, Entry>; complete?: boolean }

export function createAccountBroadcast<Entry, P extends Payload<Entry> = Payload<Entry>>({
  askAgainAfterMs,
  giveUpAfterMs,
  request,
  subscribe,
}: {
  askAgainAfterMs: number
  giveUpAfterMs: number
  request: (refresh: boolean) => void
  subscribe: (callback: (payload: P) => Promise<void>) => unknown
}) {
  type State = {
    accounts: Record<string, Entry>
    isChecking: boolean
    /** When the last full check finished (epoch ms). */
    checkedAt: number | null
    last: P | null
    merge: (payload: P) => void
    setChecking: (value: boolean) => void
  }

  const useStore = create<State>()((set) => ({
    accounts: {},
    isChecking: false,
    checkedAt: null,
    last: null,

    merge: (payload) =>
      set((state) =>
        payload.complete
          ? { accounts: payload.accounts ?? {}, isChecking: false, checkedAt: Date.now(), last: payload }
          : { accounts: { ...state.accounts, ...payload.accounts }, last: payload }
      ),
    setChecking: (value) => set({ isChecking: value }),
  }))

  let listening = false
  let giveUpTimer: number | null = null

  function listen() {
    if (listening) {
      return
    }

    listening = true
    subscribe(async (payload) => {
      if (!payload?.accounts || typeof payload.accounts !== 'object') {
        return
      }

      if (payload.complete && giveUpTimer !== null) {
        window.clearTimeout(giveUpTimer)
        giveUpTimer = null
      }

      useStore.getState().merge(payload)
    })
  }

  function requestAll({ refresh = false } = {}) {
    const state = useStore.getState()
    const linked = useAccountListStore.getState().idsList

    if (state.isChecking || linked.length === 0) {
      return
    }

    const everyoneRead = linked.every((id) => state.accounts[id])
    const recent = state.checkedAt !== null && Date.now() - state.checkedAt < askAgainAfterMs

    if (!refresh && recent && everyoneRead) {
      return
    }

    listen()
    state.setChecking(true)
    giveUpTimer = window.setTimeout(() => {
      giveUpTimer = null
      useStore.getState().setChecking(false)
    }, giveUpAfterMs)
    request(refresh)
  }

  function useAll({ enabled = true } = {}) {
    const linkedKey = useAccountListStore((state) => state.idsList.join(','))
    const { accounts, checkedAt, isChecking, last } = useStore(
      useShallow((state) => ({
        accounts: state.accounts,
        checkedAt: state.checkedAt,
        isChecking: state.isChecking,
        last: state.last,
      }))
    )

    useEffect(() => {
      if (enabled && linkedKey) {
        requestAll()
      }
    }, [enabled, linkedKey])

    return {
      accounts,
      checkedAt,
      isChecking,
      last,
      refresh: () => requestAll({ refresh: true }),
    }
  }

  return { request: requestAll, use: useAll, useStore }
}
