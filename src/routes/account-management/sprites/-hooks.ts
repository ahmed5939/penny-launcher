import { useShallow } from 'zustand/react/shallow'
import { useEffect } from 'react'

import { useSpritesStore } from '../../../state/management/sprites'

import { useGetSelectedAccount } from '../../../hooks/accounts'

/**
 * The page's one connection to the main process: ask once per account, keep
 * the answer until the account changes, and let Reload get past both the
 * catalogue cache and the last inventory read.
 */
export function useSpritesPage() {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const { collection, errorMessage, isLoading, loadedFor } = useSpritesStore(
    useShallow((state) => ({
      collection: state.collection,
      errorMessage: state.errorMessage,
      isLoading: state.isLoading,
      loadedFor: state.loadedFor,
    }))
  )
  const { reset, setLoading, setPayload } = useSpritesStore(
    useShallow((state) => ({
      reset: state.reset,
      setLoading: state.setLoading,
      setPayload: state.setPayload,
    }))
  )

  useEffect(() => {
    const listener = window.electronAPI.responseSprites(async (response) => {
      setPayload(response)
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    if (!selected) {
      reset()

      return
    }

    if (loadedFor !== selected.accountId) {
      setLoading(true)
      window.electronAPI.requestSprites(selected)
    }
    /* Keyed on the account id alone — `selected` is a new object each render. */
  }, [accountId])

  const handleReload = () => {
    if (!selected || isLoading) {
      return
    }

    setLoading(true)
    window.electronAPI.requestSprites(selected, true)
  }

  return {
    account: selected,
    collection,
    errorMessage,
    handleReload,
    isLoading,
  }
}
