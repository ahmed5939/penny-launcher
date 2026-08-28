import { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useOutpostStore } from '../../../state/stw-operations/outpost'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { toast } from '../../../lib/notifications'

export function useOutpostData() {
  const { baseData, errorMessage, infoLoading, loadingZone, zones } =
    useOutpostStore(
      useShallow((state) => ({
        baseData: state.baseData,
        errorMessage: state.errorMessage,
        infoLoading: state.infoLoading,
        loadingZone: state.loadingZone,
        zones: state.zones,
      }))
    )

  const primaryAccount = usePrimaryAccount()

  const handleRefresh = useCallback(async () => {
    if (!primaryAccount) {
      toast('Select an account first.')
      return
    }

    const store = useOutpostStore.getState()

    store.setInfoLoading(true)

    try {
      const result = await window.electronAPI.requestOutpostInfo(
        primaryAccount
      )
      store.setInfo(result)
    } catch {
      store.setError('Failed to load outpost information.')
    } finally {
      store.setInfoLoading(false)
    }
  }, [primaryAccount])

  const handleScanBase = useCallback(
    async (zoneId: string, saveFile: string) => {
      if (!primaryAccount) {
        toast('Select an account first.')
        return
      }

      const store = useOutpostStore.getState()

      store.setLoadingZone(zoneId)

      try {
        const result = await window.electronAPI.requestOutpostBaseData(
          primaryAccount,
          saveFile
        )
        store.setBaseData(zoneId, result)
      } catch {
        toast('Base scan failed.')
      } finally {
        store.setLoadingZone(null)
      }
    },
    [primaryAccount]
  )

  /**
   * Load once per visit. Re-scanning is the refresh button's job.
   */
  useEffect(() => {
    if (primaryAccount) {
      void handleRefresh()
    }
  }, [primaryAccount?.accountId])

  return {
    baseData,
    errorMessage,
    handleRefresh,
    handleScanBase,
    infoLoading,
    loadingZone,
    primaryAccount,
    zones,
  }
}
