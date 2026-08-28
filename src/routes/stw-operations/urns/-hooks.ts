import type {
  ComboboxOption,
  ComboboxProps,
} from '../../../components/ui/extended/combobox/hooks'
import type { QuestEntry } from '../../../kernel/core/quests'

import { useEffect, useMemo, useState } from 'react'

import {
  useGetAutoPinUrnActions,
  useGetAutoPinUrnData,
} from '../../../hooks/stw-operations/urns'
import { useGetAccounts } from '../../../hooks/accounts'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { getItemRecord, useItemDatabaseStore } from '../../../state/items/database'

import { checkIfCustomDisplayNameIsValid } from '../../../lib/validations/properties'
import { parseCustomDisplayName } from '../../../lib/utils'

export function useData() {
  useRequestItemDatabase()

  const { accountsArray, accountList } = useGetAccounts()
  const { selectedAccounts } = useGetAutoPinUrnData()
  const { addAccount, removeAccount, updateAccount } =
    useGetAutoPinUrnActions()
  const records = useItemDatabaseStore((state) => state.records)
  const [availableQuests, setAvailableQuests] = useState<
    Record<string, Array<QuestEntry>>
  >({})

  const options = accountsArray
    .filter((account) => selectedAccounts[account.accountId] === undefined)
    .map((account) => {
      const _keys: Array<string> = [account.displayName]

      if (checkIfCustomDisplayNameIsValid(account.customDisplayName)) {
        _keys.push(account.customDisplayName)
      }

      return {
        keywords: _keys,
        label: parseCustomDisplayName(account),
        value: account.accountId,
      } as ComboboxOption
    })
  const accounts = Object.keys(selectedAccounts)
    .filter((accountId) => accountList[accountId])
    .map((accountId) => accountList[accountId])
  const accountSelectorIsDisabled = options.length <= 0

  useEffect(() => {
    const listener = window.electronAPI.notificationAutoPinUrnsData(
      async (data) => {
        Object.entries(data.quests).forEach(([accountId, templateIds]) => {
          addAccount(accountId)
          templateIds.forEach((templateId) => {
            addAccount(accountId, {
              templateId,
              value: true,
            })
          })
          const account = accountList[accountId]
          if (account) window.electronAPI.requestQuests(account)
        })
      }
    )

    window.electronAPI.autoPinUrnsRequestData()

    return () => {
      listener.removeListener()
    }
  }, [accountList])

  useEffect(() => {
    const listener = window.electronAPI.responseQuests(async (response) => {
      setAvailableQuests((current) => ({
        ...current,
        [response.accountId]: response.quests,
      }))
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  const customFilter: ComboboxProps['customFilter'] = (
    _value,
    search,
    keywords
  ) => {
    const _search = search.toLowerCase().trim()
    const _keys =
      keywords &&
      keywords.some((keyword) =>
        keyword.toLowerCase().trim().includes(_search)
      )

    return _keys ? 1 : 0
  }

  const onSelectItem = (accountId: string) => {
    addAccount(accountId)
    window.electronAPI.autoPinUrnsAdd(accountId)
    const account = accountList[accountId]
    if (account) window.electronAPI.requestQuests(account)
  }

  const handleRemoveAccount = (accountId: string) => () => {
    removeAccount(accountId)
    window.electronAPI.autoPinUrnsRemove(accountId)
  }

  const handleUpdateAccount =
    (accountId: string, templateId: string) =>
    (value: boolean) => {
      updateAccount(accountId, {
        templateId,
        value,
      })
      window.electronAPI.autoPinUrnsUpdate(accountId, templateId, value)
    }

  const questOptions = useMemo(() => {
    return Object.fromEntries(
      Object.entries(availableQuests).map(([accountId, quests]) => [
        accountId,
        [
          ...quests.map((quest) => ({
            name:
              getItemRecord(records, quest.templateId)?.name ??
              (quest.templateId.split(':').pop() ?? quest.templateId)
                .split(/[_.]/)
                .filter(Boolean)
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
            templateId: quest.templateId,
          })),
          ...(selectedAccounts[accountId] ?? [])
            .filter(
              (templateId) =>
                !quests.some((quest) => quest.templateId === templateId)
            )
            .map((templateId) => ({
              name: `${
                getItemRecord(records, templateId)?.name ??
                (templateId.split(':').pop() ?? templateId)
                  .split(/[_.]/)
                  .filter(Boolean)
                  .map(
                    (word) =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                  )
                  .join(' ')
              } (not currently active)`,
              templateId,
            })),
        ]
          .sort((a, b) => a.name.localeCompare(b.name)),
      ])
    )
  }, [availableQuests, records, selectedAccounts])

  return {
    accounts,
    accountSelectorIsDisabled,
    options,
    selectedAccounts,
    questOptions,

    customFilter,
    handleRemoveAccount,
    handleUpdateAccount,
    onSelectItem,
  }
}
