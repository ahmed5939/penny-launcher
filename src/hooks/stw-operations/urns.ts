import type { AutoPinQuestDataList } from '../../types/urns'

import { useShallow } from 'zustand/react/shallow'

import { useAutoPinUrnDataStore } from '../../state/stw-operations/urns'

import { useGetAccounts } from '../accounts'

export function useGetAutoPinUrnData() {
  const { idsList } = useGetAccounts()
  const { data } = useAutoPinUrnDataStore(
    useShallow((state) => ({
      data: state.data,
    }))
  )
  const selectedAccounts = idsList.reduce((accumulator, accountId) => {
    if (data[accountId] !== undefined) {
      accumulator[accountId] = data[accountId]
    }

    return accumulator
  }, {} as AutoPinQuestDataList)

  return {
    selectedAccounts,
  }
}

export function useGetAutoPinUrnActions() {
  const { addAccount, removeAccount, updateAccount } =
    useAutoPinUrnDataStore(
      useShallow((state) => ({
        addAccount: state.addAccount,
        removeAccount: state.removeAccount,
        updateAccount: state.updateAccount,
      }))
    )

  return {
    addAccount,
    removeAccount,
    updateAccount,
  }
}
