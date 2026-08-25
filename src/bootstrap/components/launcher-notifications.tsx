import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { toast } from '../../lib/notifications'
import { parseCustomDisplayName } from '../../lib/utils'

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
        toast(
          t(
            `launch-game.notifications.${data.status ? 'success' : 'error'}`,
            {
              name: parseCustomDisplayName(data.account),
            }
          )
        )
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [t])

  return null
}
