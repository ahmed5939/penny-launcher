import { useShallow } from 'zustand/react/shallow'

import {
  useGiftsInformationStore,
  GiftsInformationState,
} from '../../state/management/gifts-information'
import { useAccountScopeStore } from '../../state/accounts/scope'

export function useGetGiftsInformationData() {
  const { data, isLoading } = useGiftsInformationStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      data: state.data,
    }))
  )
  // The store has no accounts field of its own — the scope answers this.
  const selectedAccounts = useAccountScopeStore((state) => state.members)

  return {
    isLoading,
    data,
    selectedAccounts,
  }
}

export function useGetGiftsInformationActions() {
  const { updateData, updateLoading } = useGiftsInformationStore(
    useShallow((state) => ({
      updateData: state.updateData,
      updateLoading: state.updateLoading,
    }))
  )

  const giftsInformationUpdateData = (
    value: GiftsInformationState['data'],
    reset?: boolean
  ) => {
    updateData(value, reset)
  }

  const giftsInformationUpdateLoading = (value: boolean) => {
    updateLoading(value)
  }

  return {
    giftsInformationUpdateData,
    giftsInformationUpdateLoading,
  }
}
