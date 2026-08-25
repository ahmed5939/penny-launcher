import type { SelectOption } from '../../components/ui/third-party/extended/input-tags'
import type { AccountData } from '../../types/accounts'
import type { RedeemCodeAccountNotification } from '../../types/redeem-codes'

import { useShallow } from 'zustand/react/shallow'

import {
  RedeemCodesCodeData,
  RedeemCodesData,
  useRedeemCodesStore,
} from '../../state/management/redeem-code'
import { useAccountScopeStore } from '../../state/accounts/scope'

export function useGetRedeemCodesData() {
  const { codes, isLoading, notifications, tags } = useRedeemCodesStore(
    useShallow((state) => ({
      codes: state.codes,
      isLoading: state.isLoading,
      notifications: state.notifications,
      tags: state.tags,
    }))
  )
  // The store's own `accounts` field is gone — the scope answers this now.
  const selectedAccounts = useAccountScopeStore((state) => state.members)

  return {
    codes,
    isLoading,
    notifications,
    selectedAccounts,
    selectedTags: tags,
  }
}

export function useGetRedeemCodesActions() {
  const {
    setInitialResponse,
    updateCodes,
    updateLoading,
    updateResponse,
    updateTags,
  } = useRedeemCodesStore(
    useShallow((state) => ({
      setInitialResponse: state.setInitialResponse,
      updateCodes: state.updateCodes,
      updateLoading: state.updateLoading,
      updateResponse: state.updateResponse,
      updateTags: state.updateTags,
    }))
  )
  // Writes the global scope, so changing the selection here also changes it
  // for every other tool rather than only for this page.
  const updateAccounts = useAccountScopeStore((state) => state.setMembers)

  const rawRedeemCodesUpdateAccounts = (value: Array<string>) => {
    updateAccounts(value)
  }
  const redeemCodesUpdateAccounts = (value: Array<SelectOption>) => {
    updateAccounts(value.map((item) => item.value))
  }

  const rawRedeemCodesUpdateTags = (value: Array<string>) => {
    updateTags(value)
  }
  const redeemCodesUpdateTags = (value: Array<SelectOption>) => {
    updateTags(value.map((item) => item.value))
  }

  const redeemCodesUpdateCodes = (value: string) => {
    updateCodes(value)
  }
  const redeemCodesUpdateLoading = (value: boolean) => {
    updateLoading(value)
  }

  const redeemCodesClearResponse = () => {
    setInitialResponse({})
  }
  const redeemCodesSetInitialResponse = (
    accounts: Array<AccountData>,
    codes: Record<string, RedeemCodesCodeData>
  ) => {
    setInitialResponse(
      accounts.reduce(
        (accumulator, current) => {
          accumulator[current.accountId] = {
            account: current,
            codes,
          }

          return accumulator
        },
        {} as Record<string, RedeemCodesData>
      )
    )
  }
  const redeemCodesSetNotification = (
    notification: RedeemCodeAccountNotification
  ) => {
    updateResponse(notification.accountId, {
      status: notification.status,
      value: notification.code,
    })
  }

  return {
    rawRedeemCodesUpdateAccounts,
    rawRedeemCodesUpdateTags,
    redeemCodesClearResponse,
    redeemCodesSetInitialResponse,
    redeemCodesSetNotification,
    redeemCodesUpdateAccounts,
    redeemCodesUpdateCodes,
    redeemCodesUpdateLoading,
    redeemCodesUpdateTags,
  }
}
