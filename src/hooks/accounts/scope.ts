import type { AccountData } from '../../types/accounts'

import { useShallow } from 'zustand/react/shallow'

import { useAccountScopeStore } from '../../state/accounts/scope'
import { useAccountListStore } from '../../state/accounts/list'

/**
 * The scope itself, plus the actions that change it.
 */
export function useAccountScope() {
  return useAccountScopeStore(
    useShallow((state) => ({
      members: state.members,
      mode: state.mode,
      primary: state.primary,

      reconcile: state.reconcile,
      selectAll: state.selectAll,
      setMembers: state.setMembers,
      setPrimary: state.setPrimary,
      toggleMember: state.toggleMember,
    }))
  )
}

/**
 * The accounts a bulk action would touch, resolved to full account data.
 *
 * Ordered by `idsList` rather than by selection order, so results always come
 * back in the order the accounts appear in the rail — a bulk run that
 * reordered itself according to which box you ticked first would be unreadable
 * across eight accounts.
 */
export function useScopedAccounts(): Array<AccountData> {
  const members = useAccountScopeStore((state) => state.members)
  const { accountList, idsList } = useAccountListStore(
    useShallow((state) => ({
      accountList: state.accounts,
      idsList: state.idsList,
    }))
  )

  const scoped = new Set(members)

  return idsList
    .filter((accountId) => scoped.has(accountId))
    .map((accountId) => accountList[accountId])
    .filter((account): account is AccountData => account !== undefined)
}

/**
 * The subject, for tools that only make sense one account at a time.
 */
export function usePrimaryAccount(): AccountData | null {
  const primary = useAccountScopeStore((state) => state.primary)
  const accountList = useAccountListStore((state) => state.accounts)

  return primary ? (accountList[primary] ?? null) : null
}
