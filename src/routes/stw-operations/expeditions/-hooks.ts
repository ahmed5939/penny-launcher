import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'

import { useExpeditionsStore } from '../../../state/stw-operations/expeditions'

import { useGetAccounts } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'
import type { ExpeditionActionNotification, ExpeditionSlot } from '../../../kernel/core/expeditions'

export function useExpeditionsData() {
  const { t } = useTranslation(['general'])

  const { accountsArray } = useGetAccounts()
  const { data, isCollecting, isLoading, pending } = useExpeditionsStore(
    useShallow((state) => ({
      data: state.data,
      isCollecting: state.isCollecting,
      isLoading: state.isLoading,
      pending: state.pending,
    }))
  )
  const { updateCollecting, updateData, updateLoading, updatePending } =
    useExpeditionsStore(
      useShallow((state) => ({
        updateCollecting: state.updateCollecting,
        updateData: state.updateData,
        updateLoading: state.updateLoading,
        updatePending: state.updatePending,
      }))
    )
  const {
    accounts,
    areThereAccounts,
    isSelectedEmpty,
    parsedSelectedAccounts,
    selectedAccounts,

    getAccounts,
    updateAccounts: handleUpdateAccounts,
  } = useAccountSelectorData()

  const parsedData = accountsArray
    .filter((account) => data[account.accountId] !== undefined)
    .map((account) => data[account.accountId])

  const totalReady = parsedData.reduce(
    (accumulator, current) =>
      accumulator + current.slots.filter((slot) => slot.state === 'ready').length,
    0
  )
  const totalInFlight = parsedData.reduce(
    (accumulator, current) =>
      accumulator +
      current.slots.filter((slot) => slot.state === 'in-flight').length,
    0
  )
  const totalAvailable = parsedData.reduce(
    (accumulator, current) =>
      accumulator +
      current.slots.filter((slot) => slot.state === 'available').length,
    0
  )

  const isDisabledForm =
    isSelectedEmpty || isLoading || pending.length > 0 || !areThereAccounts
  const isDisabledCollect =
    isDisabledForm || isCollecting || totalReady <= 0

  useEffect(() => {
    const listener = window.electronAPI.responseExpeditions(
      async (response) => {
        updateLoading(false)
        updateData(response)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationExpeditionsCollect(
      async (response) => {
        updateCollecting(false)
        // The run is over, so stop filling the taskbar icon.
        window.electronAPI.setTaskbarProgress(null)

        const collected = response.results.reduce(
          (accumulator, current) => accumulator + current.collected,
          0
        )
        const failed = response.results.filter((item) => item.errorMessage)

        const summary =
          collected > 0
            ? `Collected ${collected} expedition${collected === 1 ? '' : 's'}`
            : 'Nothing was collected'

        toast(summary)

        /**
         * Also as a shell notification: a collect across eight accounts takes
         * long enough that people alt-tab away, and an in-app toast fired at a
         * hidden window tells nobody anything.
         */
        window.electronAPI.sendNativeNotification({
          body:
            failed.length > 0
              ? `${summary}. ${failed.length} account${failed.length === 1 ? '' : 's'} reported an error.`
              : summary,
          title: 'Expeditions',
        })

        if (failed.length > 0) {
          toast(
            `${failed.length} account${failed.length === 1 ? '' : 's'} reported an error: ${failed[0].errorMessage}`
          )
        }

        handleLoad()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [selectedAccounts])

  useEffect(() => {
    const listener = window.electronAPI.notificationExpeditionAction(
      async (response) => {
        updatePending(response.expeditionId, false)
        if (response.errorMessage) {
          toast(response.errorMessage)
        } else {
          const messages: Record<ExpeditionActionNotification['action'], string> = {
            abandon: 'Expedition abandoned',
            collect: 'Expedition collected',
            start: 'Expedition dispatched',
          }
          toast(messages[response.action])
        }
        handleLoad()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [selectedAccounts])

  const handleLoad = () => {
    const currentAccounts = getAccounts()

    if (currentAccounts.length <= 0) {
      toast(t('form.accounts.no-linked'))

      return
    }

    updateLoading(true)
    updateData({}, true)

    window.electronAPI.requestExpeditions(currentAccounts)
  }

  /**
   * The load-gate, removed.
   *
   * This page used to open empty and make you press a button to see anything —
   * a web-form habit that only existed because the page had to ask which
   * accounts it was about. The scope already answers that, so the data can
   * simply be here when you arrive, and again whenever the scope changes.
   *
   * Keyed on the joined ids rather than the array so re-selecting the same
   * accounts in a different order does not refetch.
   */
  const scopeKey = selectedAccounts.join(',')

  useEffect(() => {
    if (scopeKey.length === 0) {
      return
    }

    handleLoad()
  }, [scopeKey])

  /** Keep completion states and countdowns useful while this page stays open. */
  useEffect(() => {
    if (scopeKey.length === 0) return

    const interval = window.setInterval(handleLoad, 60_000)
    return () => window.clearInterval(interval)
  }, [scopeKey])

  const handleCollect = () => {
    if (isDisabledCollect) {
      return
    }

    const currentAccounts = getAccounts()

    if (currentAccounts.length <= 0) {
      toast(t('form.accounts.no-linked'))

      return
    }

    updateCollecting(true)

    /**
     * Indeterminate rather than a percentage: the main process collects the
     * accounts as a batch and reports once at the end, so there is no honest
     * fraction to show. A filled-but-pulsing icon says "working" without
     * inventing progress it does not have.
     */
    window.electronAPI.setTaskbarProgress('indeterminate')

    window.electronAPI.collectExpeditions(currentAccounts)
  }

  const handleAction = (
    accountId: string,
    slot: ExpeditionSlot,
    action: ExpeditionActionNotification['action']
  ) => {
    const account = accountsArray.find((item) => item.accountId === accountId)
    if (!account || pending.includes(slot.itemId)) return

    if (
      action === 'abandon' &&
      !window.confirm('Abandon this expedition? Its current progress will be lost.')
    ) return

    updatePending(slot.itemId, true)
    window.electronAPI.expeditionAction({
      account,
      action,
      expeditionId: slot.itemId,
      expeditionTemplate: slot.templateId,
      itemIds: slot.suggestedHeroIds,
      squadId: slot.squadId ?? undefined,
    })
  }

  return {
    accounts,
    data: parsedData,
    isCollecting,
    isDisabledCollect,
    isDisabledForm,
    isLoading,
    parsedSelectedAccounts,
    pending,
    /** How many accounts the collect button is about to act on. */
    scopeCount: selectedAccounts.length,
    totalInFlight,
    totalAvailable,
    totalReady,

    handleCollect,
    handleAction,
    handleLoad,
    handleUpdateAccounts,
  }
}
