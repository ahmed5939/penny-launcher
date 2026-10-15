import { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useOutpostStore } from '../../../state/stw-operations/outpost'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { toast } from '../../../lib/notifications'

/** The account the store's outpost data belongs to, so a switch clears the last one's. */
let loadedAccountId: string | null = null

export function useOutpostData() {
  const { baseData, errorMessage, infoLoading, loadingZone, summary, zones } =
    useOutpostStore(
      useShallow((state) => ({
        baseData: state.baseData,
        errorMessage: state.errorMessage,
        infoLoading: state.infoLoading,
        loadingZone: state.loadingZone,
        summary: state.summary,
        zones: state.zones,
      }))
    )

  const primaryAccount = usePrimaryAccount()

  const handleRefresh = useCallback(async () => {
    if (!primaryAccount) {
      toast.warning('Select an account first.')
      return
    }

    const store = useOutpostStore.getState()

    if (primaryAccount.accountId !== loadedAccountId) {
      loadedAccountId = primaryAccount.accountId
      useOutpostStore.setState({
        baseData: {},
        errorMessage: null,
        summary: null,
        zones: [],
      })
    }

    store.setInfoLoading(true)

    try {
      const result = await window.electronAPI.requestOutpostInfo(
        primaryAccount
      )
      store.setInfo(result)
    } catch {
      store.setError('Try Refresh to load it again.')
    } finally {
      store.setInfoLoading(false)
    }
  }, [primaryAccount])

  const handleScanBase = useCallback(
    async (zoneId: string, saveFile: string) => {
      if (!primaryAccount) {
        toast.warning('Select an account first.')
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
        toast.error('Could not scan the base. Try again.')
      } finally {
        store.setLoadingZone(null)
      }
    },
    [primaryAccount]
  )

  /**
   * Sequential on purpose — each scan downloads a multi-megabyte .sav, and
   * `loadingZone` is a single slot, so the cards animate one at a time.
   */
  const handleScanAll = useCallback(async () => {
    for (const zone of useOutpostStore.getState().zones) {
      if (zone.saveFile) {
        await handleScanBase(zone.zoneId, zone.saveFile)
      }
    }
  }, [handleScanBase])

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
    handleScanAll,
    handleScanBase,
    infoLoading,
    loadingZone,
    primaryAccount,
    summary,
    zones,
  }
}
