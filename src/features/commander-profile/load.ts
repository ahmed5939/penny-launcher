import type { ProfileEntry } from './model'

import { useAccountResource } from '../../components/page'

import { useAccountListStore } from '../../state/accounts/list'

/**
 * The account's profile, read from its own campaign profile. Resolves on the first
 * payload for this account — the main process answers on a broadcast
 * channel, like the vault.
 */
export function loadProfile(accountId: string) {
  const account = useAccountListStore.getState().accounts[accountId]

  if (!account) {
    return Promise.reject(new Error('That account is no longer signed in. Pick another one.'))
  }

  return new Promise<ProfileEntry>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      listener.removeListener()
      reject(new Error('Epic did not return the profile within a minute. Try Refresh.'))
    }, 60_000)
    const listener = window.electronAPI.responseAccountHealth(async (response) => {
      const entry = response[accountId]

      if (!entry) return

      window.clearTimeout(timer)
      listener.removeListener()

      if (entry.errorMessage) {
        reject(new Error('Could not read the profile from Epic. Try Refresh.'))
      } else {
        resolve(entry)
      }
    })

    window.electronAPI.requestAccountHealth([account])
  })
}

/**
 * The selected account's profile. One cache key, so the home screen's
 * commander card and the Profile page share a single read.
 */
export function useProfileResource() {
  return useAccountResource(loadProfile, {
    cacheKey: 'stw.profile',
    fallbackError: 'Could not read the profile. Try Refresh.',
    owner: (entry) => entry.accountId,
  })
}
