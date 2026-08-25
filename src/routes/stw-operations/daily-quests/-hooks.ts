import type { DailyQuestsAccountData } from '../../../types/daily-quests'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'

import { useGetAccounts } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'

export function useDailyQuestsData() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const [isLoading, setIsLoading] = useState(false)
  const [rerollingQuest, setRerollingQuest] = useState<
    | {
        accountId: string
        questId: string
      }
    | null
  >(null)
  const [dailyQuests, setDailyQuests] = useState<
    Array<DailyQuestsAccountData>
  >([])

  const { accountList } = useGetAccounts()
  const {
    areThereAccounts,
    isSelectedEmpty,
    selectedAccounts,

    getAccounts,
  } = useAccountSelectorData()

  const fetchButtonIsDisabled =
    isSelectedEmpty || isLoading || !areThereAccounts
  const rerollIsDisabled = rerollingQuest !== null || isLoading

  useEffect(() => {
    const listener = window.electronAPI.notificationDailyQuests(
      async (value) => {
        setIsLoading(false)
        setDailyQuests(value)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationDailyQuestReroll(
      async (response) => {
        setRerollingQuest(null)

        if (response.success) {
          setDailyQuests((current) =>
            current.map((item) =>
              item.accountId === response.accountId
                ? response.data
                : item
            )
          )

          toast(t('daily-quests.notifications.rerolled'))

          return
        }

        toast(
          response.errorMessage ??
            t('daily-quests.notifications.failed')
        )
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const handleFetch = () => {
    if (fetchButtonIsDisabled) {
      return
    }

    const selectedAccounts = getAccounts()

    if (selectedAccounts.length <= 0) {
      toast(
        t('form.accounts.no-linked', {
          ns: 'general',
        })
      )

      return
    }

    setIsLoading(true)

    window.electronAPI.requestDailyQuests(selectedAccounts)
  }

  const handleReroll = (accountId: string, questId: string) => {
    if (rerollIsDisabled) {
      return
    }

    const account = accountList[accountId]

    if (!account) {
      toast(t('daily-quests.notifications.failed'))

      return
    }

    setRerollingQuest({
      accountId,
      questId,
    })

    window.electronAPI.rerollDailyQuest(account, questId)
  }

  /**
   * The load-gate, removed — quests fetch themselves when the scope changes,
   * so the page has data when you arrive instead of a button.
   */
  const scopeKey = selectedAccounts.join(',')

  useEffect(() => {
    if (scopeKey.length === 0 || isLoading) {
      return
    }

    handleFetch()
  }, [scopeKey])

  return {
    accountList,
    dailyQuests,
    fetchButtonIsDisabled,
    isLoading,
    rerollIsDisabled,
    rerollingQuest,

    handleFetch,
    handleReroll,
  }
}
