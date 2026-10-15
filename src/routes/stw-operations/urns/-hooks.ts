import type {
  ComboboxOption,
  ComboboxProps,
} from '../../../components/ui/extended/combobox/hooks'
import type { QuestEntry } from '../../../kernel/core/quests'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  useGetAutoPinUrnActions,
  useGetAutoPinUrnData,
} from '../../../hooks/stw-operations/urns'
import { useGetAccounts } from '../../../hooks/accounts'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { getItemRecord, useItemDatabaseStore } from '../../../state/items/database'

import { checkIfCustomDisplayNameIsValid } from '../../../lib/validations/properties'
import { parseCustomDisplayName } from '../../../lib/utils'

type QuestsState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; quests: Array<T> }

export type QuestOption = { active: boolean; name: string; templateId: string }

export type QuestList = QuestsState<QuestOption>

export function useData() {
  useRequestItemDatabase()

  const { accountsArray, accountList } = useGetAccounts()
  const { selectedAccounts } = useGetAutoPinUrnData()
  const { addAccount, removeAccount, updateAccount } =
    useGetAutoPinUrnActions()
  const records = useItemDatabaseStore((state) => state.records)
  const [availableQuests, setAvailableQuests] = useState<
    Record<string, QuestsState<QuestEntry>>
  >({})

  const requestAccountQuests = useCallback(
    (accountId: string) => {
      const account = accountList[accountId]

      if (!account) return

      setAvailableQuests((current) => ({
        ...current,
        [accountId]: { status: 'loading' },
      }))
      window.electronAPI.requestQuests(account)
    },
    [accountList]
  )

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
          requestAccountQuests(accountId)
        })
      }
    )

    window.electronAPI.autoPinUrnsRequestData()

    return () => {
      listener.removeListener()
    }
  }, [accountList, requestAccountQuests])

  useEffect(() => {
    const listener = window.electronAPI.responseQuests(async (response) => {
      setAvailableQuests((current) => ({
        ...current,
        [response.accountId]: response.errorMessage
          ? { status: 'error', message: response.errorMessage }
          : { status: 'ready', quests: response.quests },
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
    requestAccountQuests(accountId)
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

  const questLists = useMemo(() => {
    /* The game's name; the id in words only until the item database loads. */
    const nameOf = (templateId: string) =>
      getItemRecord(records, templateId)?.name ??
      (templateId.split(':').pop() ?? templateId)
        .split(/[_.]/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    /* The bookkeeping quests the Quests page hides too. */
    const isHidden = (templateId: string) => {
      const name = getItemRecord(records, templateId)?.name ?? ''

      return name.startsWith('<') || name.startsWith('(Hidden)')
    }

    return Object.fromEntries(
      Object.entries(availableQuests).map(
        ([accountId, state]): [string, QuestList] => {
          if (state.status !== 'ready') return [accountId, state]

          const pinned = selectedAccounts[accountId] ?? []

          return [
            accountId,
            {
              status: 'ready',
              quests: [
                ...state.quests
                  .filter(
                    (quest) =>
                      !isHidden(quest.templateId) ||
                      pinned.includes(quest.templateId)
                  )
                  .map((quest) => ({
                    active: true,
                    name: nameOf(quest.templateId),
                    templateId: quest.templateId,
                  })),
                ...pinned
                  .filter(
                    (templateId) =>
                      !state.quests.some(
                        (quest) => quest.templateId === templateId
                      )
                  )
                  .map((templateId) => ({
                    active: false,
                    name: nameOf(templateId),
                    templateId,
                  })),
              ].sort((a, b) => a.name.localeCompare(b.name)),
            },
          ]
        }
      )
    )
  }, [availableQuests, records, selectedAccounts])

  return {
    accounts,
    records,
    accountSelectorIsDisabled,
    options,
    selectedAccounts,
    questLists,

    customFilter,
    handleRemoveAccount,
    handleUpdateAccount,
    onSelectItem,
    retry: requestAccountQuests,
  }
}
