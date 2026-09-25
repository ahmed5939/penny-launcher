import type { LoadoutsPayload } from '../../../kernel/core/loadouts'

import { useAccountListStore } from '../../../state/accounts/list'

/**
 * The loadouts payload, as a promise. Like the vault, the main process
 * answers on a broadcast channel — and re-sends it after every edit — so this
 * resolves on the first payload for this account.
 */
export function requestLoadouts(accountId: string) {
  const account = useAccountListStore.getState().accounts[accountId]

  if (!account) {
    return Promise.reject(
      new Error('That account is no longer signed in. Pick another one.')
    )
  }

  return new Promise<LoadoutsPayload>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      listener.removeListener()
      reject(new Error('Epic did not return the loadouts within a minute. Try Refresh.'))
    }, 60_000)
    const listener = window.electronAPI.responseLoadouts(async (response) => {
      if (response.accountId !== accountId) {
        return
      }

      window.clearTimeout(timer)
      listener.removeListener()
      resolve(response)
    })

    window.electronAPI.requestLoadouts(account)
  })
}
