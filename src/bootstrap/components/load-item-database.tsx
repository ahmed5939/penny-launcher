import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useItemDatabaseStore } from '../../state/items/database'

/**
 * Pulls the item database in at startup.
 *
 * It is cached on disk after the first run, so this is usually a file read;
 * the first launch downloads ~13MB in the main process. Nothing waits on it
 * — every screen falls back to decoded template ids until it lands.
 */
export function LoadItemDatabase() {
  const { update, updateLoading } = useItemDatabaseStore(
    useShallow((state) => ({
      update: state.update,
      updateLoading: state.updateLoading,
    }))
  )

  useEffect(() => {
    const listener = window.electronAPI.responseItemDatabase(
      async (response) => {
        update(response)
      }
    )

    updateLoading(true)
    window.electronAPI.requestItemDatabase()

    return () => {
      listener.removeListener()
    }
  }, [])

  return null
}
