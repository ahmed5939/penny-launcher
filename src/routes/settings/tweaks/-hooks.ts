import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  useFileTweaksStore,
  type PatchKey,
} from '../../../state/settings/file-tweaks'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { toast } from '../../../lib/notifications'

const PATCH_IDS: Array<PatchKey> = ['devBuilds', 'devStairs', 'airStrike']

export function useFileTweaksData() {
  const {
    baseBusy,
    busyTrapGuid,
    patchLoading,
    patchStatuses,
    trapsData,
    trapsError,
    trapsLoading,
    trapStatuses,
    workerPower,
    workerPowerLoading,
    workerPowerMode,
  } = useFileTweaksStore(
    useShallow((state) => ({
      baseBusy: state.baseBusy,
      busyTrapGuid: state.busyTrapGuid,
      patchLoading: state.patchLoading,
      patchStatuses: state.patchStatuses,
      trapsData: state.trapsData,
      trapsError: state.trapsError,
      trapsLoading: state.trapsLoading,
      trapStatuses: state.trapStatuses,
      workerPower: state.workerPower,
      workerPowerLoading: state.workerPowerLoading,
      workerPowerMode: state.workerPowerMode,
    }))
  )

  const primaryAccount = usePrimaryAccount()

  const store = useFileTweaksStore.getState

  /**
   * The key gate — main-process session memory only, so the page asks on
   * every visit and shows the key form until the gate opens.
   */
  const [isLocked, setIsLocked] = useState(true)

  useEffect(() => {
    window.electronAPI
      .fileTweaksLockStatus()
      .then(setIsLocked)
      .catch(() => setIsLocked(true))
  }, [])

  const handleUnlock = useCallback(async (key: string): Promise<boolean> => {
    try {
      const unlocked = await window.electronAPI.fileTweaksUnlock(key)

      setIsLocked(!unlocked)

      return unlocked
    } catch {
      return false
    }
  }, [])

  /**
   * Patches are auto-detected once unlocked, sequentially, because
   * DevStairs and AirStrike share the same multi-GB pakchunk and a
   * parallel pile of full file reads would thrash the disk for no benefit.
   */
  useEffect(() => {
    if (isLocked) {
      return
    }

    let cancelled = false

    const run = async () => {
      for (const key of PATCH_IDS) {
        if (cancelled) return

        const status = await refreshPatchStatus(key)

        if (cancelled) return

        if (status.error && key === 'devBuilds') {
          /**
           * The first probe doubles as the "is the game path valid" check.
           * Silently skipping the rest keeps a mistuned path from spamming
           * three identical errors.
           */
          break
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [isLocked])

  const refreshPatchStatus = useCallback(async (key: PatchKey) => {
    const api = window.electronAPI
    store().setPatchLoading(key)

    try {
      const status = await (key === 'devBuilds'
        ? api.getDevBuildsStatus()
        : key === 'devStairs'
          ? api.getDevStairsStatus()
          : api.getAirStrikeStatus())

      store().setPatchStatus(key, status)
      return status
    } catch {
      const status = {
        activated: false,
        error: 'Could not scan the game files. Check the game folder in Settings.',
        found: false,
      }
      store().setPatchStatus(key, status)
      return status
    } finally {
      store().setPatchLoading(null)
    }
  }, [])

  const handleTogglePatch = useCallback(
    async (key: PatchKey) => {
      const api = window.electronAPI
      store().setPatchLoading(key)

      try {
        const result = await (key === 'devBuilds'
          ? api.toggleDevBuilds()
          : key === 'devStairs'
            ? api.toggleDevStairs()
            : api.toggleAirStrike())

        toast[result.success ? 'success' : 'error'](result.message)

        if (key === 'devStairs') {
          /**
           * Activating DevStairs reverts Dev Builds as a side effect, so the
           * stale badge would lie. Re-probe both.
           */
          await refreshPatchStatus('devBuilds')
        }
      } catch {
        toast.error('Patch failed — the file may be in use. Close Fortnite and retry.')
      } finally {
        await refreshPatchStatus(key)
        store().setPatchLoading(null)
      }
    },
    [refreshPatchStatus]
  )

  const handleLoadTraps = useCallback(async () => {
    store().setTrapsLoading(true)
    store().setTrapsError(null)

    try {
      const data = await window.electronAPI.fetchTrapsData()
      store().setTrapsData(data)
    } catch {
      store().setTrapsError(
        'Could not read the trap database. Check the game folder and try again.'
      )
    } finally {
      store().setTrapsLoading(false)
    }
  }, [])

  const handleApplyTrap = useCallback(
    async (guid: string, heightHex: string) => {
      store().setBusyTrapGuid(guid)

      try {
        const result = await window.electronAPI.applyTrapHeight(
          guid,
          heightHex
        )

        toast[result.success ? 'success' : 'error'](result.message)

        if (result.success) {
          store().patchTrapLocally(guid, heightHex)
        }
      } catch {
        toast.error(
          'Patch failed — the trap data may live in a compressed block.'
        )
      } finally {
        store().setBusyTrapGuid(null)
      }
    },
    []
  )

  const handleRevertTrap = useCallback(async (guid: string) => {
    store().setBusyTrapGuid(guid)

    try {
      const result = await window.electronAPI.revertTrapHeight(guid)
      toast[result.success ? 'success' : 'error'](result.message)

      if (result.success) {
        store().unpatchTrapLocally(guid)
      }
    } catch {
      toast.error('Could not revert the trap. Close Fortnite and try again.')
    } finally {
      store().setBusyTrapGuid(null)
    }
  }, [])

  const handleRevertAllTraps = useCallback(async () => {
    store().setBusyTrapGuid('*')

    try {
      const result = await window.electronAPI.revertAllTrapHeights()
      toast[result.success ? 'success' : 'error'](result.message)

      if (result.success) {
        const data = await window.electronAPI.fetchTrapsData()
        store().setTrapsData(data)
        store().clearTrapStatuses()
      }
    } catch {
      toast.error('Could not revert the traps. Close Fortnite and try again.')
    } finally {
      store().setBusyTrapGuid(null)
    }
  }, [])

  const handleApplyBase = useCallback(async (uuValue: number) => {
    store().setBaseBusy(true)

    try {
      const result = await window.electronAPI.applyBaseHeight(uuValue)
      toast[result.success ? 'success' : 'error'](result.message)

      if (result.success) {
        store().setBaseStatus({
          currentHeight: result.currentHeight ?? '',
          found: true,
          isModified: true,
        })
      }
    } catch {
      toast.error('Could not patch B.A.S.E. Close Fortnite and try again.')
    } finally {
      store().setBaseBusy(false)
    }
  }, [])

  const handleRevertBase = useCallback(async () => {
    store().setBaseBusy(true)

    try {
      const result = await window.electronAPI.revertBaseHeight()
      toast[result.success ? 'success' : 'error'](result.message)

      if (result.success) {
        store().setBaseStatus({
          currentHeight: '74 C2',
          found: true,
          isModified: false,
        })
      }
    } catch {
      toast.error('Could not revert B.A.S.E. Close Fortnite and try again.')
    } finally {
      store().setBaseBusy(false)
    }
  }, [])

  const handleGenerateWorkerPower = useCallback(async () => {
    if (!primaryAccount) {
      toast.warning('Select an account first.')
      return
    }

    store().setWorkerPowerLoading(true)

    try {
      const result = await window.electronAPI.generateWorkerPower(
        primaryAccount,
        store().workerPowerMode
      )
      store().setWorkerPower(result)

      if (!result.success) {
        toast.error(
          result.error ?? 'Could not generate Worker Power. Try again in a moment.'
        )
      }
    } catch {
      toast.error('Could not generate Worker Power. Try again in a moment.')
    } finally {
      store().setWorkerPowerLoading(false)
    }
  }, [primaryAccount])

  const handleWorkerPowerMode = useCallback((mode: 'high' | 'low') => {
    store().setWorkerPowerMode(mode)
    store().setWorkerPower(null)
  }, [])

  return {
    baseBusy,
    busyTrapGuid,
    handleApplyBase,
    handleApplyTrap,
    handleGenerateWorkerPower,
    handleLoadTraps,
    handleRevertAllTraps,
    handleRevertBase,
    handleRevertTrap,
    handleTogglePatch,
    handleUnlock,
    handleWorkerPowerMode,
    isLocked,
    patchLoading,
    patchStatuses,
    primaryAccount,
    refreshPatchStatus,
    trapsData,
    trapsError,
    trapsLoading,
    trapStatuses,
    workerPower,
    workerPowerLoading,
    workerPowerMode,
  }
}
