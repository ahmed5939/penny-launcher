
import type { AccountData } from '../../../types/accounts'

import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useGetAutomationActions } from '../../../hooks/stw-operations/automation'
import { useGetAutoPinUrnActions } from '../../../hooks/stw-operations/urns'
import {
  useGetSelectedAccount,
  useRemoveSelectedAccount,
} from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'
import { parseCustomDisplayName } from '../../../lib/utils'

export function useHandleRemove() {
  const { t } = useTranslation(['accounts'], {
    keyPrefix: 'remove-account',
  })

  const navigate = useNavigate()
  const { selected } = useGetSelectedAccount()
  const { removeAccount } = useRemoveSelectedAccount()
  const { removeAccount: removeAccountFromAutoKick } =
    useGetAutomationActions()
  const { removeAccount: removeAccountFromUrns } =
    useGetAutoPinUrnActions()

  const handleRemove = (config?: {
    account?: AccountData
    defaultRedirect?: boolean
  }) => {
    const target = config?.account ?? selected

    if (!target) {
      return
    }
    removeAccountFromAutoKick(target.accountId)
    removeAccountFromUrns(target.accountId)

    window.electronAPI.autoPinUrnsRemove(target.accountId)
    window.electronAPI.onRemoveAccount(target.accountId)

    const total = Object.values(removeAccount(target.accountId)).length

    toast.success(
      t('notifications.remove.success', {
        name: parseCustomDisplayName(target),
      })
    )

    const withRedirect = config?.defaultRedirect ?? true

    if (withRedirect) {
      navigate({ to: total > 0 ? '/account' : '/' })
    }
  }

  return {
    handleRemove,
  }
}
