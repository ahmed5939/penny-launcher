import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'

import { VBucksInformationData } from '../../../state/management/vbucks-information'
import { useAccountScopeStore } from '../../../state/accounts/scope'

import {
  useGetVBucksInformationActions,
  useGetVBucksInformationData,
} from '../../../hooks/management/vbucks-information'
import { useGetAccounts } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'
import { parseCustomDisplayName } from '../../../lib/utils'

/**
 * One definition of "how many V-Bucks does this account have", so the banner
 * across the top and the card for a single account cannot disagree. The
 * breakdown already totals every currency the profile carries; the sum over
 * `currency` is only the fallback for payloads stored before it existed.
 */
function accountTotal(data: VBucksInformationData): number {
  return (
    data.breakdown?.total ??
    Object.values(data.currency).reduce(
      (accumulator, current) => accumulator + (current.quantity ?? 0),
      0
    )
  )
}

export function useVBucksInformationData() {
  const { t } = useTranslation(['general'])

  const { accountList, accountsArray } = useGetAccounts()
  const { data, isLoading, selectedAccounts } =
    useGetVBucksInformationData()
  const [requestedIds, setRequestedIds] = useState<Array<string>>([])
  const {
    vbucksInformationUpdateData,
    vbucksInformationUpdateLoading,
  } = useGetVBucksInformationActions()
  const {
    areThereAccounts,
    isSelectedEmpty,

    getAccounts,
  } = useAccountSelectorData()

  const scope = new Set(selectedAccounts)
  const requestedInScope = requestedIds.filter((accountId) =>
    scope.has(accountId)
  )

  const parsedData = accountsArray
    .filter(
      (account) =>
        scope.has(account.accountId) && data[account.accountId] !== undefined
    )
    .map((account) => data[account.accountId])
  const vbucksSummary = parsedData.reduce(
    (accumulator, current) => accumulator + accountTotal(current),
    0
  )

  const isDisabledForm = isSelectedEmpty || isLoading || !areThereAccounts

  /**
   * The main process drops an account that fails rather than reporting it, so
   * a requested account with no balance back is the only sign it failed.
   */
  const failedIds =
    isLoading || isSelectedEmpty
      ? []
      : requestedInScope.filter((accountId) => !data[accountId])
  const failedNames = failedIds.map((accountId) =>
    parseCustomDisplayName(accountList[accountId])
  )

  useEffect(() => {
    const listener = window.electronAPI.getVBucksInformationNotification(
      async (data) => {
        const inScope = new Set(useAccountScopeStore.getState().members)

        vbucksInformationUpdateLoading(false)
        vbucksInformationUpdateData(
          Object.fromEntries(
            Object.entries(data).filter(([accountId]) => inScope.has(accountId))
          )
        )
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const handleGetInfo = () => {
    if (isDisabledForm) {
      return
    }

    const selectedAccounts = getAccounts()

    if (selectedAccounts.length <= 0) {
      toast.warning(t('form.accounts.no-linked'))

      return
    }

    setRequestedIds(selectedAccounts.map((account) => account.accountId))
    vbucksInformationUpdateLoading(true)
    vbucksInformationUpdateData({}, true)

    window.electronAPI.getVBucksInformation(selectedAccounts)
  }

  /**
   * The load-gate, removed — balances fetch themselves when the scope
   * changes, so the page has data when you arrive instead of a button.
   */
  const scopeKey = selectedAccounts.join(',')

  useEffect(() => {
    if (scopeKey.length === 0 || isLoading) {
      return
    }

    handleGetInfo()
  }, [scopeKey])

  return {
    areThereAccounts,
    failedNames,
    isDisabledForm,
    isLoading,
    isSelectedEmpty,
    requestedCount: requestedInScope.length,
    vbucksSummary,
    data: parsedData,

    handleGetInfo,
  }
}

export function useParseAccountInfo({
  data,
}: {
  data: VBucksInformationData
}) {
  const { accountList } = useGetAccounts()

  const account = accountList[data.accountId]
  const total = accountTotal(data)

  const details = Object.entries(data.currency)

  return {
    account,
    breakdown: data.breakdown ?? null,
    details,
    total,
  }
}
