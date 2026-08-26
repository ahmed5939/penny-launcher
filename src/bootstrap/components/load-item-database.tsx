import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useItemDatabaseStore } from '../../state/items/database'

/**
 * Registers the single global response listener. Feature pages request the
 * large database only when one of them is actually opened.
 */
export function LoadItemDatabase() {
  const update = useItemDatabaseStore((state) => state.update)

  useEffect(() => {
    const listener = window.electronAPI.responseItemDatabase(
      async (response) => {
        update(response)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  return null
}

let requestStarted = false

export function useRequestItemDatabase() {
  const { isLoading, total, updateLoading } = useItemDatabaseStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      total: state.total,
      updateLoading: state.updateLoading,
    }))
  )

  useEffect(() => {
    if (requestStarted || isLoading || total > 0) return

    requestStarted = true
    updateLoading(true)
    window.electronAPI.requestItemDatabase()
  }, [isLoading, total, updateLoading])
}
