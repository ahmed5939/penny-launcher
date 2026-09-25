
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

  const handleRemove = (config?: { defaultRedirect?: boolean }) => {
    if (!selected) {
      return
    }
    removeAccountFromAutoKick(selected.accountId)
    removeAccountFromUrns(selected.accountId)

    window.electronAPI.autoPinUrnsRemove(selected.accountId)
    window.electronAPI.onRemoveAccount(selected.accountId)

    const total = Object.values(removeAccount(selected.accountId)).length

    toast.success(
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
