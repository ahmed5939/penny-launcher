import type { AccountData, AccountDataRecord } from '../../types/accounts'

import { create } from 'zustand'

import { useAccountScopeStore } from './scope'

/**
 * The roster, and nothing else.
 *
 * `selected` used to live here too, which made this store a second opinion on
 * a question `state/accounts/scope` now answers for the whole app. Which
 * accounts are in play is not a property of the list.
 */
export type AccountListState = {
  accounts: AccountDataRecord
  idsList: Array<string>

  addOrUpdate: (accountId: string, account: AccountData) => void
  register: (accounts: AccountDataRecord, overwrite?: boolean) => void
  remove: (accountId: string) => AccountDataRecord
}

export const useAccountListStore = create<AccountListState>()(
  (set, get) => ({
    accounts: {},
    idsList: [],

    addOrUpdate: (accountId, account) => {
      const accounts = get().accounts
      const idsList = get().idsList
      const current = accounts[accountId]

      if (current !== undefined) {
        const newIdsList = [...idsList]

        if (!newIdsList.includes(accountId)) {
          newIdsList.push(accountId)
        }

        set({
          accounts: {
            ...accounts,
            [accountId]: {
              ...current,
              ...account,
            },
          },
          idsList: newIdsList,
        })
      }
    },
    register: (accounts, overwrite) => {
      set((state) => {
        const newAccounts = overwrite
          ? accounts
          : {
              ...state.accounts,
              ...accounts,
            }

        return {
          accounts: newAccounts,
          idsList: Object.keys(newAccounts),
        }
      })
    },
    remove: (accountId) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [accountId]: _current, ...accounts } = get().accounts
      const idsList = get()
        .idsList.filter((currentId) => currentId !== accountId)

      set({ accounts, idsList })

      // Drops the removed account out of the scope, and re-seeds the scope if
      // it was the only one in it.
      useAccountScopeStore.getState().reconcile(idsList)

      return accounts
    },
  })
)
