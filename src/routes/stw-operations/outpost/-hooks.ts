import { useCallback, useLayoutEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useOutpostStore } from '../../../state/stw-operations/outpost'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { toast } from '../../../lib/notifications'

import { createRequestGate } from './-request-gate'

const requests = createRequestGate()

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

    const stillCurrent = requests.begin()
    const store = useOutpostStore.getState()

    store.setInfoLoading(true)

    try {
      const result = await window.electronAPI.requestOutpostInfo(
        primaryAccount
      )

      if (stillCurrent()) {
        store.setInfo(result)
      }
    } catch {
      if (stillCurrent()) {
        store.setError('Try Refresh to load it again.')
      }
    } finally {
      if (stillCurrent()) {
        store.setInfoLoading(false)
      }
    }
  }, [primaryAccount])

  const handleScanBase = useCallback(
    async (zoneId: string, saveFile: string) => {
      if (!primaryAccount) {
        toast.warning('Select an account first.')
        return
      }

      const stillCurrent = requests.begin()
      const store = useOutpostStore.getState()

      store.setLoadingZone(zoneId)

      try {
        const result = await window.electronAPI.requestOutpostBaseData(
          primaryAccount,
          saveFile
        )

        if (stillCurrent()) {
          store.setBaseData(zoneId, result)
        }
      } catch {
        if (stillCurrent()) {
          toast.error('Could not scan the base. Try again.')
        }
      } finally {
        if (stillCurrent()) {
          store.setLoadingZone(null)
        }
      }
    },
    [primaryAccount]
  )

  /**
   * Sequential on purpose — each scan downloads a multi-megabyte .sav, and
   * `loadingZone` is a single slot, so the cards animate one at a time. Stops
   * as soon as the account changes, so the rest of the bases are not read
   * into the next account's page.
   */
  const handleScanAll = useCallback(async () => {
    const stillCurrent = requests.begin()

    for (const zone of useOutpostStore.getState().zones) {
      if (!stillCurrent()) {
        break
      }

      if (zone.saveFile) {
        await handleScanBase(zone.zoneId, zone.saveFile)
      }
    }
  }, [handleScanBase])

  /**
   * Runs before paint, so the previous account's data never shows for a frame.
   * Load once per visit. Re-scanning is the refresh button's job.
   */
  useLayoutEffect(() => {
    if (requests.select(primaryAccount?.accountId ?? null)) {
      useOutpostStore.setState({
        baseData: {},
        errorMessage: null,
        infoLoading: false,
        loadingZone: null,
        summary: null,
        zones: [],
      })
    }

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
