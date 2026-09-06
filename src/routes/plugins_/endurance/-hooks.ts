import type { EnduranceSnapshot } from '../../../kernel/preload-actions/endurance'
import type {
  EnduranceConfig,
  EnduranceEvent,
  EnduranceStatus,
} from '../../../types/endurance'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'

import { useGetSelectedAccount } from '../../../hooks/accounts'

const maxFeedLength = 80

export function useEnduranceData() {
  const { selected } = useGetSelectedAccount()
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<EnduranceSnapshot | null>(null)
  const [feed, setFeed] = useState<Array<EnduranceEvent>>([])
  const statusRef = useRef<EnduranceStatus | null>(null)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const checkPlugin = async () => {
      try {
        const plugins = await window.electronAPI.listPlugins()
        if (active && !plugins.some((plugin) => plugin.id === 'endurance' && plugin.status === 'running' && !plugin.safeMode)) {
          void navigate({ to: '/plugins', replace: true })
          return
        }
      } catch {
        if (active) void navigate({ to: '/plugins', replace: true })
        return
      }
      if (active) timer = setTimeout(checkPlugin, 2000)
    }
    void checkPlugin()
    return () => { active = false; clearTimeout(timer) }
  }, [navigate])

  useEffect(() => {
    window.electronAPI
      .enduranceStatusRequest()
      .then((value) => {
        statusRef.current = value.status
        setSnapshot(value)
      })
      .catch(() => {})

    const listener = window.electronAPI.enduranceNotification(
      async (event) => {
        if (event.type === 'status' && event.status) {
          statusRef.current = event.status
          setSnapshot((current) =>
            current ? { ...current, status: event.status! } : current,
          )
        }

        if (event.type === 'calibration-saved') {
          toast('Point saved.')
          // The config changed in the main process; re-sync it.
          window.electronAPI
            .enduranceStatusRequest()
            .then(setSnapshot)
            .catch(() => {})
        }

        if (
          event.type === 'step' ||
          event.type === 'log' ||
          event.type === 'calibration-saved' ||
          event.type === 'calibration-cancelled'
        ) {
          setFeed((current) =>
            [event, ...current].slice(0, maxFeedLength),
          )
        }
      },
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const updateConfig = useCallback(
    (partial: Partial<EnduranceConfig>) => {
      window.electronAPI
        .enduranceConfigUpdate(partial)
        .then((config) => {
          setSnapshot((current) =>
            current ? { ...current, config } : current,
          )
        })
        .catch(() => {
          toast('The setting could not be saved.')
        })
    },
    [],
  )

  const handleStart = useCallback(() => {
    if (!selected) {
      toast('Select an account in the titlebar first.')

      return
    }

    setFeed([])
    window.electronAPI.enduranceStart(selected)
  }, [selected])

  const handleStop = useCallback(() => {
    window.electronAPI.enduranceStop()
  }, [])

  const handleCalibrate = useCallback((pointId: string) => {
    window.electronAPI.enduranceCalibrateStart(pointId)
  }, [])

  const handleCalibrateCancel = useCallback(() => {
    window.electronAPI.enduranceCalibrateCancel()
  }, [])

  return {
    account: selected,
    feed,
    handleCalibrate,
    handleCalibrateCancel,
    handleStart,
    handleStop,
    snapshot,
    updateConfig,
  }
}
