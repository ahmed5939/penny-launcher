import type { WorldInfoData } from '../../../types/services/advanced-mode/world-info'

import { useEffect } from 'react'

import { defaultWorldInfo } from '../../../config/constants/fortnite/world-info'

import {
  useCurrentWorldInfoActions,
  useWorldInfoActions,
} from '../../../hooks/advanced-mode/world-info'
import { useAlertsOverviewPaginationInit } from '../../../hooks/alerts/overview'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'
import { useWorldInfoStore } from '../../../state/advanced-mode/world-info/home/data'

import { toast } from '../../../lib/notifications'
import { worlInfoParser } from '../../../lib/parsers/world-info'
import { worldInfoSchema } from '../../../lib/validations/schemas/world-info'

export function LoadWorldInfoData() {
  const { setData, setIsFetching } = useCurrentWorldInfoActions()
  const account = usePrimaryAccount()

  useEffect(() => {
    const listener = window.electronAPI.responseWorldInfoData(
      async (response) => {
        setData(response.data)
        setIsFetching(false)
      }
    )

    if (account) {
      setIsFetching(true)
      window.electronAPI.requestWorldInfoData(account.accountId)
    }

    return () => {
      listener.removeListener()
    }
  }, [account?.accountId])

  return null
}

/**
 * An empty or invalid reply is a failure. `worldInfo: null` means keep what is
 * already on screen.
 */
export function resolveHomeWorldInfo(response: unknown, hasData: boolean) {
  const parsed = worldInfoSchema.safeParse(response)

  if (parsed.success && parsed.data.theaters.length > 0) {
    return {
      worldInfo: worlInfoParser(parsed.data as WorldInfoData).worldInfo,
      failed: false,
    }
  }

  return {
    worldInfo: hasData
      ? null
      : worlInfoParser(defaultWorldInfo as WorldInfoData).worldInfo,
    failed: true,
  }
}

export function LoadHomeWorldInfo() {
  const { setWorldInfoData, updateWorldInfoLoading } =
    useWorldInfoActions()
  const { initPagination } = useAlertsOverviewPaginationInit()
  const account = usePrimaryAccount()

  useEffect(() => {
    const listener = window.electronAPI.responseHomeWorldInfo(
      async (response) => {
        try {
          const { worldInfo, failed } = resolveHomeWorldInfo(
            response,
            useWorldInfoStore.getState().data.size > 0
          )

          if (failed) {
            toast.error(
              "Could not load today's missions. Check your connection and try Refresh."
            )
          }

          if (worldInfo) {
            initPagination([...worldInfo.keys()])
            setWorldInfoData(worldInfo)
          }
        } finally {
          updateWorldInfoLoading('isFetching', false)
          updateWorldInfoLoading('isReloading', false)
        }
      }
    )

    if (account) {
      updateWorldInfoLoading('isFetching', true)
      window.electronAPI.requestHomeWorldInfo(account.accountId)
    }

    return () => {
      listener.removeListener()
    }
  }, [account?.accountId])

  return null
}
