import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'

import {
  useGetGiftsInformationActions,
  useGetGiftsInformationData,
} from '../../../hooks/management/gifts-information'
import { useGetAccounts } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'

export function useGiftsInformationData() {
  const { t } = useTranslation(['general'])

  const { accountsArray } = useGetAccounts()
  const { data, isLoading, selectedAccounts } = useGetGiftsInformationData()
  const {
    giftsInformationUpdateData,
    giftsInformationUpdateLoading,
  } = useGetGiftsInformationActions()
  const {
    areThereAccounts,
    isSelectedEmpty,

    getAccounts,
  } = useAccountSelectorData()

  const parsedData = accountsArray
    .filter((account) => data[account.accountId] !== undefined)
    .map((account) => data[account.accountId])

  const isDisabledForm = isSelectedEmpty || isLoading || !areThereAccounts

  useEffect(() => {
    const listener = window.electronAPI.getGiftsInformationNotification(
      async (data) => {
        giftsInformationUpdateLoading(false)
        giftsInformationUpdateData(data)
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

    giftsInformationUpdateLoading(true)
    giftsInformationUpdateData({}, true)

    window.electronAPI.getGiftsInformation(selectedAccounts)
  }

  /**
   * Same load-gate as the V-Bucks page: the summary fetches itself when the
   * scope changes, so the page has data when you arrive.
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
    data: parsedData,

    handleGetInfo,
  }
}
