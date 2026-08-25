import type { SelectOption } from '../../components/ui/third-party/extended/input-tags'

import { useDailyQuestsStore } from '../../state/stw-operations/daily-quests'
import { useAccountScopeStore } from '../../state/accounts/scope'

export function useGetDailyQuestsData() {
  const tags = useDailyQuestsStore((state) => state.tags)
  // The store's own `accounts` field is gone — the scope answers this now.
  const selectedAccounts = useAccountScopeStore((state) => state.members)

  return {
    selectedAccounts,
    selectedTags: tags,
  }
}

export function useGetDailyQuestsActions() {
  const updateTags = useDailyQuestsStore((state) => state.updateTags)
  // Writes the global scope, so changing the selection here also changes it
  // for every other tool rather than only for this page.
  const updateAccounts = useAccountScopeStore((state) => state.setMembers)

  const rawDailyQuestsUpdateAccounts = (value: Array<string>) => {
    updateAccounts(value)
  }
  const dailyQuestsUpdateAccounts = (value: Array<SelectOption>) => {
    updateAccounts(value.map((item) => item.value))
  }

  const rawDailyQuestsUpdateTags = (value: Array<string>) => {
    updateTags(value)
  }
  const dailyQuestsUpdateTags = (value: Array<SelectOption>) => {
    updateTags(value.map((item) => item.value))
  }

  return {
    rawDailyQuestsUpdateAccounts,
    rawDailyQuestsUpdateTags,
    dailyQuestsUpdateAccounts,
    dailyQuestsUpdateTags,
  }
}
