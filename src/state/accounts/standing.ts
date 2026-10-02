import type { AccountStanding } from '../../kernel/core/account-extras'

import { useEffect } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { useAccountListStore } from './list'

/**
 * Social standing for every linked account. One check covers them all, so
 * this is one store rather than per-account resources; the main process
 * keeps answers for ten minutes, and this side does not ask again sooner
 * unless an account appears that has not been checked.
 */

export type AccountStandingState = {
  accounts: Record<string, AccountStanding>
  isChecking: boolean
  /** When the last full check finished (epoch ms). */
  checkedAt: number | null

  merge: (accounts: Record<string, AccountStanding>, complete: boolean) => void
  setChecking: (value: boolean) => void
}

export const useAccountStandingStore = create<AccountStandingState>()(
  (set) => ({
    accounts: {},
    isChecking: false,
    checkedAt: null,

    merge: (accounts, complete) =>
      set((state) =>
        complete
          ? { accounts, isChecking: false, checkedAt: Date.now() }
          : { accounts: { ...state.accounts, ...accounts } }
      ),
    setChecking: (value) => set({ isChecking: value }),
  })
)

const askAgainAfterMs = 10 * 60 * 1000

/** A check that never answers must not leave the line saying "Checking…". */
const giveUpAfterMs = 2 * 60 * 1000

let listening = false
let giveUpTimer: number | null = null

function listen() {
  if (listening) {
    return
  }

  listening = true
  window.electronAPI.responseAccountStanding(async (response) => {
    if (!response?.accounts || typeof response.accounts !== 'object') {
      return
    }

    if (response.complete && giveUpTimer !== null) {
      window.clearTimeout(giveUpTimer)
      giveUpTimer = null
    }

    useAccountStandingStore
      .getState()
      .merge(response.accounts, Boolean(response.complete))
  })
}

export function requestAccountStanding({ refresh = false } = {}) {
  const state = useAccountStandingStore.getState()
  const linked = useAccountListStore.getState().idsList

  if (state.isChecking || linked.length === 0) {
    return
  }

  const everyoneChecked = linked.every((id) => state.accounts[id])
  const recent =
    state.checkedAt !== null && Date.now() - state.checkedAt < askAgainAfterMs

  if (!refresh && recent && everyoneChecked) {
    return
  }

  listen()
  state.setChecking(true)
  giveUpTimer = window.setTimeout(() => {
    giveUpTimer = null
    useAccountStandingStore.getState().setChecking(false)
  }, giveUpAfterMs)
  window.electronAPI.requestAccountStanding(refresh)
}

/**
 * Every linked account's standing, checked on mount (and again when an
 * account is added). `refresh` re-checks past both caches.
 */
export function useAccountStanding({ enabled = true } = {}) {
  const linkedKey = useAccountListStore((state) => state.idsList.join(','))
  const { accounts, checkedAt, isChecking } = useAccountStandingStore(
    useShallow((state) => ({
      accounts: state.accounts,
      checkedAt: state.checkedAt,
      isChecking: state.isChecking,
    }))
  )

  useEffect(() => {
    if (enabled && linkedKey) {
      requestAccountStanding()
    }
  }, [enabled, linkedKey])

  return {
    accounts,
    checkedAt,
    isChecking,
    refresh: () => requestAccountStanding({ refresh: true }),
  }
}
