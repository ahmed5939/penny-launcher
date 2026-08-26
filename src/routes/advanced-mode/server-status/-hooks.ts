import { useShallow } from 'zustand/react/shallow'
import { useEffect } from 'react'

import { useServerStatusStore } from '../../../state/advanced-mode/server-status'

export function useServerStatusData() {
  const { diagnostics, entries, errorMessage, isLoading, lastCheckedAt } =
    useServerStatusStore(
      useShallow((state) => ({
        diagnostics: state.diagnostics,
        entries: state.entries,
        errorMessage: state.errorMessage,
        isLoading: state.isLoading,
        lastCheckedAt: state.lastCheckedAt,
      }))
    )
  const { setLoading, setResponse } = useServerStatusStore(
    useShallow((state) => ({
      setLoading: state.setLoading,
      setResponse: state.setResponse,
    }))
  )

  useEffect(() => {
    const listener = window.electronAPI.responseServerStatus(
      async (response) => {
        const previousEntries = useServerStatusStore.getState().entries
        setResponse({
          diagnostics: response.diagnostics,
          entries: response.entries,
          errorMessage: response.errorMessage,
          checkedAt: Date.now(),
        })
        const rules = JSON.parse(
          localStorage.getItem('penny-notification-rules') ?? '{}'
        ) as { serverDown?: boolean; serverRecovered?: boolean }
        const wasDown = previousEntries.some((entry) => entry.status === 'DOWN')
        const nowDown = response.entries.some((entry) => entry.status === 'DOWN')
        if (previousEntries.length > 0 && !wasDown && nowDown && rules.serverDown !== false) {
          window.electronAPI.sendNativeNotification({ title: 'Epic service interruption', body: 'Fortnite is reporting a service outage.' })
        }
        if (previousEntries.length > 0 && wasDown && !nowDown && rules.serverRecovered !== false) {
          window.electronAPI.sendNativeNotification({ title: 'Epic services recovered', body: 'Fortnite is operational again.' })
        }
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  /**
   * Check on open. Nobody lands here to then press a button to find out
   * whether the servers are up.
   */
  useEffect(() => {
    handleCheck()
  }, [])

  const handleCheck = () => {
    setLoading(true)
    window.electronAPI.requestServerStatus()
  }

  const isDown = entries.some((entry) => entry.status === 'DOWN')
  const isUnknown =
    entries.length === 0 || entries.every((entry) => entry.status === 'UNKNOWN')

  return {
    diagnostics,
    entries,
    errorMessage,
    isDown,
    isLoading,
    isUnknown,
    lastCheckedAt,

    handleCheck,
  }
}
