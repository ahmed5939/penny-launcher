
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'

import { useAccountHealthStore } from '../../../state/management/account-health'

import { useGetAccounts } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'

export function useAccountHealthData() {
  const { t } = useTranslation(['general'])

  const { accountsArray } = useGetAccounts()
  const { data, isLoading } = useAccountHealthStore(
    useShallow((state) => ({
      data: state.data,
      isLoading: state.isLoading,
    }))
  )
  const { updateData, updateLoading } = useAccountHealthStore(
    useShallow((state) => ({
      updateData: state.updateData,
      updateLoading: state.updateLoading,
    }))
  )
  const {
    areThereAccounts,
    isSelectedEmpty,
    selectedAccounts,

    getAccounts,
  } = useAccountSelectorData()

  /** Keep the account order the user set in the sidebar. */
  const parsedData = accountsArray
    .filter((account) => data[account.accountId] !== undefined)
    .map((account) => data[account.accountId])

  const summary = parsedData.reduce(
    (accumulator, current) => {
      accumulator.pending +=
        current.pending.difficultyIncreaseRewards +
        current.pending.missionAlertRewards
      accumulator.powerLevel += current.powerLevel
      accumulator.vaultItems += current.counts.vaultItems

      return accumulator
    },
    { pending: 0, powerLevel: 0, vaultItems: 0 }
  )

  /**
   * Averaged, since summing power levels across accounts is meaningless.
   * Only accounts PennyDB could enrich have a power level at all, so the
   * average is over those — not over every account you selected.
   */
  const enrichedCount = parsedData.filter(
    (entry) => entry.powerLevel > 0
  ).length
  const averagePowerLevel =
    enrichedCount > 0
      ? Math.round((summary.powerLevel / enrichedCount) * 100) / 100
      : 0

  const isDisabledForm = isSelectedEmpty || isLoading || !areThereAccounts

  useEffect(() => {
    const listener = window.electronAPI.responseAccountHealth(
      async (response) => {
        updateLoading(false)
        updateData(response)
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

    const currentAccounts = getAccounts()

    if (currentAccounts.length <= 0) {
      toast(t('form.accounts.no-linked'))

      return
    }

    updateLoading(true)
    updateData({}, true)

    window.electronAPI.requestAccountHealth(currentAccounts)
  }

  /**
   * The load-gate, removed — profiles fetch themselves when the scope
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
    averagePowerLevel,
    data: parsedData,
    isDisabledForm,
    isLoading,
    summary,

    handleGetInfo,
  }
}
