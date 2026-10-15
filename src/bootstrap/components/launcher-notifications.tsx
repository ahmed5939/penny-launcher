import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { LauncherNotificationCallbackResponseParam } from '../../types/preload'

import { toast } from '../../lib/notifications'
import { parseCustomDisplayName } from '../../lib/utils'

type Translate = (key: string, options: { name: string }) => string

export function launcherNotificationMessage(
  data: LauncherNotificationCallbackResponseParam,
  t: Translate
) {
  const name = parseCustomDisplayName(data.account)

  if (data.status) {
    return t('launch-game.notifications.success', { name })
  }

  if (data.reason === 'missing-install') {
    return t('launch-game.notifications.missing', { name })
  }

  if (data.reason === 'signed-out') {
    return `Could not launch with ${name}: its sign-in has expired. Re-add the account, then launch again.`
  }

  return t('launch-game.notifications.error', { name })
}

/**
 * Toasts the result of launching the game.
 *
 * This listener used to be a side effect of the titlebar calling
 * `useHandlers` for its window buttons — so when those buttons became the
 * system's, the toast silently went with them. Launching is triggered from
 * the home hero, not the titlebar, so it belongs with the other app-wide
 * listeners rather than hanging off whichever component happened to mount.
 */
export function LauncherNotifications() {
  const { t } = useTranslation(['general'])

  useEffect(() => {
    const listener = window.electronAPI.onNotificationLauncher(
      async (data) => {
        toast[data.status ? 'success' : 'error'](
          launcherNotificationMessage(data, t)
        )
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [t])

  return null
}
