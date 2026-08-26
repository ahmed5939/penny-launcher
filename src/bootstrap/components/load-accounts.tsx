import type { AccountData } from '../../types/accounts'

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useAccountListStore } from '../../state/accounts/list'
import { useAccountScopeStore } from '../../state/accounts/scope'

export function LoadAccounts() {
  const { addOrUpdate, register } = useAccountListStore(
    useShallow((state) => ({
      addOrUpdate: state.addOrUpdate,
      register: state.register,
    }))
  )
  const reconcile = useAccountScopeStore((state) => state.reconcile)

  useEffect(() => {
    const accountsLoaderListener = window.electronAPI.onAccountsLoaded(
      async (accounts) => {
        register(accounts)

        /**
         * Reconcile rather than "select the first account": the scope was
         * restored from the previous session before this fired, and blindly
         * overwriting it would undo that on every launch. This only steps in
         * when the saved scope points at accounts that no longer exist.
         */
        reconcile(Object.keys(accounts))
      }
    )

    window.electronAPI.requestAccounts()

    return () => {
      accountsLoaderListener.removeListener()
    }
  }, [])

  useEffect(() => {
    const syncAccessTokenListener = window.electronAPI.syncAccountData(
      async ({ accountId, data }) => {
        addOrUpdate(accountId, data as AccountData)
      }
    )

    return () => {
      syncAccessTokenListener.removeListener()
    }
  }, [addOrUpdate])

  return null
}
