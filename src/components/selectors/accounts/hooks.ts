import type {
  SelectCustomFilter,
  SelectOption,
} from '../../../components/ui/third-party/extended/input-tags'

import { defaultColor } from '../../../config/constants/colors'

import { useAccountScope } from '../../../hooks/accounts/scope'
import { useGetAccounts } from '../../../hooks/accounts'

import { checkIfCustomDisplayNameIsValid } from '../../../lib/validations/properties'
import { parseCustomDisplayName } from '../../../lib/utils'

/**
 * Adapter between the global account scope and the tools that act on it.
 *
 * This used to take a `selectedAccounts` array, which every page supplied
 * from its own store — the mechanism by which the titlebar's choice failed to
 * reach any of them. It now reads the scope directly, so a tool gets the
 * right accounts by doing nothing at all.
 */
export function useAccountSelectorData() {
  const { accountList, accountsArray, idsList } = useGetAccounts()
  const { members: selectedAccounts, setMembers } = useAccountScope()

  const areThereAccounts = accountsArray.length > 0
  const accounts: Array<SelectOption> = accountsArray.map((account) => {
    const label = parseCustomDisplayName(account)

    return {
      label,
      color: defaultColor,
      value: account.accountId,
    }
  })

  const parsedSelectedAccounts: Array<SelectOption> = selectedAccounts
    .map((accountId): SelectOption | null => {
      const selected = accounts.find((item) => item.value === accountId)

      if (!selected) {
        return null
      }

      return {
        color: defaultColor,
        label: selected.label,
        value: selected.value,
      }
    })
    .filter((item): item is SelectOption => item !== null)

  const isSelectedEmpty = parsedSelectedAccounts.length === 0

  const getAccounts = () => {
    const selectedIds = new Set(
      parsedSelectedAccounts.map(({ value }) => value)
    )

    // Iterate `idsList` so the result keeps the user's account ordering.
    return idsList
      .filter((accountId) => selectedIds.has(accountId))
      .map((accountId) => accountList[accountId])
      .filter((account) => account !== undefined)
  }

  /**
   * Writing back through the same adapter means a tool's picker and the rail
   * can never disagree — there is only one array.
   */
  const updateAccounts = (value: Array<SelectOption>) => {
    setMembers(value.map((item) => item.value))
  }

  return {
    accounts,
    areThereAccounts,
    isSelectedEmpty,
    parsedSelectedAccounts,
    selectedAccounts,

    getAccounts,
    updateAccounts,
  }
}

export function useAccountsInputTagsCustomFilter() {
  const { accountList } = useGetAccounts()

  const filter: SelectCustomFilter = (option, input) => {
    const currentItem = accountList[option.value]

    if (currentItem) {
      const _search = input.toLowerCase().trim()
      const keywords: Array<string> = [currentItem.displayName]

      if (checkIfCustomDisplayNameIsValid(currentItem.customDisplayName)) {
        keywords.push(currentItem.customDisplayName)
      }

      return keywords.some((keyword) =>
        keyword.toLowerCase().trim().includes(_search)
      )
    }

    return false
  }

  return {
    filter,
  }
}
