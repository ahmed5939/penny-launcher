import { useEffect } from 'react'

import { useServerStatusStore } from '../../state/advanced-mode/server-status'
import { useNotificationRulesStore } from '../../state/settings/notification-rules'

import { alertChange, fortniteVerdict, type Verdict } from './model'

/** How often Epic is asked while anyone is listening. */
export const recheckMinutes = 3

/** A check younger than this is shown as is when the page opens. */
const freshFor = 30 * 1000

export function requestServerStatus() {
  useServerStatusStore.getState().setLoading(true)
  window.electronAPI.requestServerStatus()
}

/**
 * Mounted once by the shell. Keeps the status fresh while the Servers page is
 * open, and in the background while a down or recovered alert is on — an
 * alert that only fired with the page open would be no alert at all.
 */
export function useServerStatusSync() {
  const watching = useServerStatusStore((state) => state.viewers > 0)
  const alerting = useNotificationRulesStore(
    (state) => state.rules.serverDown || state.rules.serverRecovered
  )

  useEffect(() => {
    // Compared against the last check that reached Epic, so one failed check
    // between up and down does not swallow the alert.
    let lastKnown: Verdict | null = null

    const listener = window.electronAPI.responseServerStatus(async (status) => {
      useServerStatusStore.getState().setResponse(status, Date.now())

      const next = fortniteVerdict(status)

      if (next.tone === 'idle') return

      const change = lastKnown === null ? null : alertChange(lastKnown, next)
      const { rules } = useNotificationRulesStore.getState()

      lastKnown = next

      if (change === 'down' && rules.serverDown) {
        window.electronAPI.sendNativeNotification({
          body: next.detail,
          title: next.title,
        })
      }

      if (change === 'recovered' && rules.serverRecovered) {
        window.electronAPI.sendNativeNotification({
          body: next.detail,
          title: 'Fortnite is back up',
        })
      }
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    if (!watching && !alerting) return

    const { checkedAt } = useServerStatusStore.getState()

    if (checkedAt === null || Date.now() - checkedAt > freshFor) {
      requestServerStatus()
    }

    const interval = setInterval(requestServerStatus, recheckMinutes * 60 * 1000)

    return () => {
      clearInterval(interval)
    }
  }, [watching, alerting])
}
