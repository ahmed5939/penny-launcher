import { useShallow } from 'zustand/react/shallow'

import type { SelectOption } from '../../components/ui/third-party/extended/input-tags'

import {
  useVBucksInformationStore,
  VBucksInformationState,
} from '../../state/management/vbucks-information'
import { useAccountScopeStore } from '../../state/accounts/scope'

export function useGetVBucksInformationData() {
  const { data, isLoading, tags } = useVBucksInformationStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      data: state.data,
      tags: state.tags,
    }))
  )
  // The store's own `accounts` field is gone — the scope answers this now.
  const selectedAccounts = useAccountScopeStore((state) => state.members)

  return {
    isLoading,
    data,
    selectedAccounts,
    selectedTags: tags,
  }
}

export function useGetVBucksInformationActions() {
  const { updateData, updateLoading, updateTags } =
    useVBucksInformationStore(
      useShallow((state) => ({
        updateData: state.updateData,
        updateLoading: state.updateLoading,
        updateTags: state.updateTags,
      }))
    )
  // Writes the global scope, so changing the selection here also changes it
  // for every other tool rather than only for this page.
  const updateAccounts = useAccountScopeStore((state) => state.setMembers)

  const rawVBucksInformationUpdateAccounts = (value: Array<string>) => {
    updateAccounts(value)
  }
  const vbucksInformationUpdateAccounts = (value: Array<SelectOption>) => {
    updateAccounts(value.map((item) => item.value))
  }

  const rawVBucksInformationUpdateTags = (value: Array<string>) => {
    updateTags(value)
  }
  const vbucksInformationUpdateTags = (value: Array<SelectOption>) => {
    updateTags(value.map((item) => item.value))
  }

  const vbucksInformationUpdateData = (
    value: VBucksInformationState['data'],
    reset?: boolean
  ) => {
    updateData(value, reset)
  }

  const vbucksInformationUpdateLoading = (value: boolean) => {
    updateLoading(value)
  }

  return {
    rawVBucksInformationUpdateAccounts,
    rawVBucksInformationUpdateTags,
    vbucksInformationUpdateAccounts,
    vbucksInformationUpdateData,
    vbucksInformationUpdateLoading,
    vbucksInformationUpdateTags,
  }
}
