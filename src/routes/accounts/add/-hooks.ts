import type { MouseEventHandler } from 'react'
import type { AuthCallbackResponseParam } from '../../../types/preload'

import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

import {
  epicGamesAuthorizationCodeURL,
  epicGamesLoginURL,
} from '../../../config/fortnite/links'

import { useAddAccountUpdateSubmittingState } from '../../../hooks/accounts'

import { AddAccountsLoadingsState } from '../../../state/accounts/add'
import { useAccountListStore } from '../../../state/accounts/list'
import { useAccountScopeStore } from '../../../state/accounts/scope'

import { LauncherAuthError } from '../../../lib/validations/schemas/fortnite/auth'
import { toast } from '../../../lib/notifications'

export function useHandlers() {
  const goToAuthorizationCodeURL: MouseEventHandler<HTMLAnchorElement> = (
    event
  ) => {
    event.preventDefault()
    window.electronAPI.openExternalURL(epicGamesAuthorizationCodeURL)
  }
  const goToEpicGamesLogin: MouseEventHandler<HTMLAnchorElement> = (
    event
  ) => {
    event.preventDefault()
    window.electronAPI.openExternalURL(epicGamesLoginURL)
  }

  return {
    goToAuthorizationCodeURL,
    goToEpicGamesLogin,
  }
}

export function useBaseSetupForm({
  fetcher,
  type,
}: {
  fetcher: (
    callback: (response: AuthCallbackResponseParam) => Promise<void>
  ) => {
    removeListener: () => Electron.IpcRenderer
  }
  type: keyof AddAccountsLoadingsState
}) {
  const { t } = useTranslation(['accounts'], {
    keyPrefix: 'general.notifications.new-account',
  })

  const { updateSubmittingState } =
    useAddAccountUpdateSubmittingState(type)
  const register = useAccountListStore((state) => state.register)
  const setPrimary = useAccountScopeStore((state) => state.setPrimary)

  useEffect(() => {
    const listener = fetcher(async ({ data, error }) => {
      if (data) {
        const accountsToArray = Object.values(data.accounts)

        register({
          [data.currentAccount.accountId]: data.currentAccount,
        })

        // Only when this is the first account — otherwise adding one would
        // silently move the scope off whatever the user was working on.
        if (accountsToArray.length <= 1) {
          setPrimary(accountsToArray[0].accountId)
        }

        // window.electronAPI.requestProviderAndAccessToken(
        //   data.currentAccount
        // )

        toast(
          t('success', {
            name: data.currentAccount.displayName,
          })
        )
      } else if (error) {
        const cuystomKeys: Array<string> = [LauncherAuthError.login]

        if (cuystomKeys.includes(error)) {
          toast(t(LauncherAuthError.login))
        } else {
          toast(error ?? t('error'))
        }
      }

      updateSubmittingState(false)
    })

    return () => {
      listener.removeListener()
    }
  }, [])
}

/**
 * One-click migration from Aerial Launcher.
 *
 * The main process reads Aerial's accounts.json (same shape as ours) and
 * links everything it finds; this hook owns the button state and folds the
 * result into the roster.
 */
export function useAerialImport() {
  const [isImporting, setIsImporting] = useState(false)

  const register = useAccountListStore((state) => state.register)
  const setPrimary = useAccountScopeStore((state) => state.setPrimary)

  useEffect(() => {
    const listener = window.electronAPI.responseImportAccountsFromAerial(
      async (response) => {
        setIsImporting(false)

        switch (response.status) {
          case 'success': {
            if (response.accounts) {
              const hadAccounts =
                Object.keys(useAccountListStore.getState().accounts)
                  .length > 0

              register(response.accounts)

              // Same rule as adding one by hand: only claim the scope when
              // there was nothing selected to begin with.
              if (!hadAccounts) {
                const [first] = Object.values(response.accounts)

                if (first) {
                  setPrimary(first.accountId)
                }
              }
            }

            const plural = response.imported === 1 ? '' : 's'

            toast(
              response.skipped > 0
                ? `Imported ${response.imported} account${plural} from Aerial Launcher — ${response.skipped} already linked`
                : `Imported ${response.imported} account${plural} from Aerial Launcher`
            )
            break
          }
          case 'nothing-new':
            toast(
              response.skipped > 0
                ? 'Every Aerial Launcher account is already linked'
                : 'No accounts found in Aerial Launcher'
            )
            break
          case 'no-file':
            toast('No Aerial Launcher data was found on this computer')
            break
          default:
            toast('Could not read the Aerial Launcher accounts file')
        }
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const importFromAerial = () => {
    if (isImporting) {
      return
    }

    setIsImporting(true)
    window.electronAPI.importAccountsFromAerial()
  }

  return { importFromAerial, isImporting }
}
