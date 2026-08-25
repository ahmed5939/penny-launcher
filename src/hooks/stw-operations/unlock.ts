import type { SelectOption } from '../../components/ui/third-party/extended/input-tags'

import { useUnlockStore } from '../../state/stw-operations/unlock'
import { useAccountScopeStore } from '../../state/accounts/scope'

export function useGetUnlockData() {
  const tags = useUnlockStore((state) => state.tags)
  // The store's own `accounts` field is gone — the scope answers this now.
  const selectedAccounts = useAccountScopeStore((state) => state.members)

  return {
    selectedAccounts,
    selectedTags: tags,
  }
}

export function useGetUnlockActions() {
  const updateTags = useUnlockStore((state) => state.updateTags)
  // Writes the global scope, so changing the selection here also changes it
  // for every other tool rather than only for this page.
  const updateAccounts = useAccountScopeStore((state) => state.setMembers)

  const rawUnlockUpdateAccounts = (value: Array<string>) => {
    updateAccounts(value)
  }
  const unlockUpdateAccounts = (value: Array<SelectOption>) => {
    updateAccounts(value.map((item) => item.value))
  }

  const rawUnlockUpdateTags = (value: Array<string>) => {
    updateTags(value)
  }
  const unlockUpdateTags = (value: Array<SelectOption>) => {
    updateTags(value.map((item) => item.value))
  }

  return {
    rawUnlockUpdateAccounts,
    rawUnlockUpdateTags,
    unlockUpdateAccounts,
    unlockUpdateTags,
  }
}
