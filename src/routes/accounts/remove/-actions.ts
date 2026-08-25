
import { useNavigate } from '@tanstack/react-router'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'

import { useGetAutomationActions } from '../../../hooks/stw-operations/automation'
import { useGetAutoPinUrnActions } from '../../../hooks/stw-operations/urns'
import {
  useGetSelectedAccount,
  useRemoveSelectedAccount,
} from '../../../hooks/accounts'

import {
  useClaimRewardsSelectorStore,
  useKickAllPartySelectorStore,
  useLeavePartySelectorStore,
} from '../../../state/stw-operations/party'

import { toast } from '../../../lib/notifications'
import { parseCustomDisplayName } from '../../../lib/utils'

/**
 * Only the party selectors need clearing by hand now.
 *
 * The daily-quests and XP-boosts forms used to be swept here too, because each
 * kept its own copy of the account selection. There is one copy now, and
 * `useAccountListStore.remove` reconciles the scope itself — so removing an
 * account can no longer leave a stale id behind in a tool nobody has opened.
 */
function useClearPartySelectors() {
  const kickAllPartySelector = useKickAllPartySelectorStore(
    useShallow((state) => ({
      accounts: state.value,
      updateAccounts: state.setValue,
    }))
  )
  const claimRewardsSelector = useClaimRewardsSelectorStore(
    useShallow((state) => ({
      accounts: state.value,
      updateAccounts: state.setValue,
    }))
  )
  const leavePartySelector = useLeavePartySelectorStore(
    useShallow((state) => ({
      accounts: state.value,
      updateAccounts: state.setValue,
    }))
  )

  return [kickAllPartySelector, claimRewardsSelector, leavePartySelector]
}

export function useHandleRemove() {
  const { t } = useTranslation(['accounts'], {
    keyPrefix: 'remove-account',
  })

  const navigate = useNavigate()
  const { selected } = useGetSelectedAccount()
  const { removeAccount } = useRemoveSelectedAccount()

  // Clear forms
  const clearPartySelectors = useClearPartySelectors()
  const { removeAccount: removeAccountFromAutoKick } =
    useGetAutomationActions()
  const { removeAccount: removeAccountFromUrns } =
    useGetAutoPinUrnActions()

  const handleRemove = (config?: { defaultRedirect?: boolean }) => {
    if (!selected) {
      return
    }

    clearPartySelectors.forEach((currentForm) => {
      currentForm.updateAccounts(
        currentForm.accounts.filter(
          (option) => option.value !== selected.accountId
        )
      )
    })
    removeAccountFromAutoKick(selected.accountId)
    removeAccountFromUrns(selected.accountId)

    window.electronAPI.autoPinUrnsRemove(selected.accountId)
    window.electronAPI.onRemoveAccount(selected.accountId)

    const total = Object.values(removeAccount(selected.accountId)).length

    toast(
      t('notifications.remove.success', {
        name: parseCustomDisplayName(selected),
      })
    )

    const withRedirect = config?.defaultRedirect ?? true

    if (total <= 0 && withRedirect) {
      navigate({ to: '/' })
    }
  }

  return {
    handleRemove,
  }
}
