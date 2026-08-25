import { useShallow } from 'zustand/react/shallow'
import { useEffect } from 'react'

import { useServerStatusStore } from '../../../state/advanced-mode/server-status'

export function useServerStatusData() {
  const { entries, errorMessage, isLoading, lastCheckedAt } =
    useServerStatusStore(
      useShallow((state) => ({
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
        setResponse({
          entries: response.entries,
          errorMessage: response.errorMessage,
          checkedAt: Date.now(),
        })
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
    entries,
    errorMessage,
    isDown,
    isLoading,
    isUnknown,
    lastCheckedAt,

    handleCheck,
  }
}
