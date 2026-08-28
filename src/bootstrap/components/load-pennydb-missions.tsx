import { useEffect } from 'react'

import { usePennyDBMissionsStore } from '../../state/home/pennydb-missions'

export function LoadPennyDBMissions() {
  const setLoading = usePennyDBMissionsStore((state) => state.setLoading)
  const setResponse = usePennyDBMissionsStore((state) => state.setResponse)

  useEffect(() => {
    const listener = window.electronAPI.responsePennyDBMissions(
      async (response) => {
        setResponse(response)
      }
    )

    setLoading(true)
    window.electronAPI.requestPennyDBMissions()

    return () => {
      listener.removeListener()
    }
  }, [setLoading, setResponse])

  return null
}
