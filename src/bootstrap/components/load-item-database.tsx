import { useEffect } from 'react'

import { useItemDatabaseStore } from '../../state/items/database'

let consumers = 0
let pending = false
let eviction: ReturnType<typeof setTimeout> | undefined

function request() {
  const state = useItemDatabaseStore.getState()
  if (!consumers || document.hidden || pending || state.total > 0) return
  pending = true
  state.updateLoading(true)
  window.electronAPI.requestItemDatabase()
}

function updateLifetime() {
  if (eviction) clearTimeout(eviction)
  eviction = undefined
  if (consumers > 0 && !document.hidden) {
    request()
  } else {
    eviction = setTimeout(() => {
      eviction = undefined
      useItemDatabaseStore.getState().clear()
    }, 60_000)
  }
}

/** Register before feature pages request data, and pause its lifetime in tray. */
export function LoadItemDatabase() {
  useEffect(() => {
    const listener = window.electronAPI.responseItemDatabase(async (response) => {
      pending = false
      // A response arriving after navigation/minimize must not revive the cache.
      if (consumers > 0 && !document.hidden) {
        useItemDatabaseStore.getState().update(response)
      } else {
        useItemDatabaseStore.getState().clear()
      }
    })
    document.addEventListener('visibilitychange', updateLifetime)
    return () => {
      listener.removeListener()
      document.removeEventListener('visibilitychange', updateLifetime)
      if (eviction) clearTimeout(eviction)
    }
  }, [])
  return null
}

export function useRequestItemDatabase() {
  useEffect(() => {
    consumers += 1
    updateLifetime()
    return () => {
      consumers -= 1
      updateLifetime()
    }
  }, [])
}
