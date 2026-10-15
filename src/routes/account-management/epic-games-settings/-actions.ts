import type { MouseEventHandler } from 'react'

import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'

import { epicGamesAccountSettingsURL } from '../../../config/fortnite/links'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'
import { parseCustomDisplayName } from '../../../lib/utils'

export function useHandlers() {
  const { t } = useTranslation(['account-management'], {
    keyPrefix: 'epic-settings',
  })

  const [isLoading, setIsLoading] = useState(false)
  const [currentCode, setCurrentCode] = useState<string | undefined>()
  const requestedFor = useRef<string | null>(null)
  const { selected } = useGetSelectedAccount()

  useEffect(() => {
    const listener = window.electronAPI.responseEpicGamesSettings(
      async ({ account, status, code }) => {
        if (account.accountId !== requestedFor.current) {
          return
        }

        requestedFor.current = null
        setIsLoading(false)
        setCurrentCode(code)

        toast[status ? 'success' : 'error'](
          status
            ? t('notifications.success', {
                name: parseCustomDisplayName(account),
              })
            : t('notifications.error', {
                name: parseCustomDisplayName(account),
              }),
          {
            duration: status ? 6000 : undefined,
          }
        )
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const handleGenerateCode = () => {
    if (!selected) {
      return
    }

    setIsLoading(true)
    requestedFor.current = selected.accountId
    window.electronAPI.openEpicGamesSettings(selected)
  }

  const handleOpenURL: MouseEventHandler<HTMLAnchorElement> = (event) => {
    event.preventDefault()

    if (!selected || !currentCode) {
      return
    }

    window.electronAPI.openExternalURL(
      epicGamesAccountSettingsURL(currentCode)
    )
  }

  return {
    currentCode,
    isLoading,

    handleGenerateCode,
    handleOpenURL,
  }
}
