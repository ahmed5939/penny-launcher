import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'

import { VBucksInformationData } from '../../../state/management/vbucks-information'

import {
  useGetVBucksInformationActions,
  useGetVBucksInformationData,
} from '../../../hooks/management/vbucks-information'
import { useGetAccounts } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'

export function useVBucksInformationData() {
  const { t } = useTranslation(['general'])

  const { accountsArray } = useGetAccounts()
  const { data, isLoading, selectedAccounts } =
    useGetVBucksInformationData()
  const {
    vbucksInformationUpdateData,
    vbucksInformationUpdateLoading,
  } = useGetVBucksInformationActions()
  const {
    areThereAccounts,
    isSelectedEmpty,

    getAccounts,
  } = useAccountSelectorData()

  const parsedData = accountsArray
    .filter((account) => data[account.accountId] !== undefined)
    .map((account) => data[account.accountId])
  const vbucksSummary = parsedData.reduce((accumulator, current) => {
    const total = Object.values(current.currency).reduce(
      (currencyAccumulator, currencyCurrent) => {
        currencyAccumulator += currencyCurrent.quantity ?? 0

        return currencyAccumulator
      },
      0
    )

    accumulator += total ?? 0

    return accumulator
  }, 0)

  const isDisabledForm = isSelectedEmpty || isLoading || !areThereAccounts

  useEffect(() => {
    const listener = window.electronAPI.getVBucksInformationNotification(
      async (data) => {
        vbucksInformationUpdateLoading(false)
        vbucksInformationUpdateData(data)
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
      toast(t('form.accounts.no-linked'))

      return
    }

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
    isDisabledForm,
    isLoading,
    isSelectedEmpty,
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
  const total = Object.values(data.currency).reduce(
    (currencyAccumulator, currencyCurrent) => {
      currencyAccumulator += currencyCurrent.quantity ?? 0

      return currencyAccumulator
    },
    0
  )

  const details = Object.entries(data.currency)

  return {
    account,
    details,
    total,
  }
}
