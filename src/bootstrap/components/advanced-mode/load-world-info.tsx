import type { WorldInfoData } from '../../../types/services/advanced-mode/world-info'

import { useEffect } from 'react'

import { defaultWorldInfo } from '../../../config/constants/fortnite/world-info'

import {
  useCurrentWorldInfoActions,
  useWorldInfoActions,
} from '../../../hooks/advanced-mode/world-info'
import { useAlertsOverviewPaginationInit } from '../../../hooks/alerts/overview'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

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

export function LoadHomeWorldInfo() {
  const { setWorldInfoData, updateWorldInfoLoading } =
    useWorldInfoActions()
  const { initPagination } = useAlertsOverviewPaginationInit()
  const account = usePrimaryAccount()

  useEffect(() => {
    const listener = window.electronAPI.responseHomeWorldInfo(
      async (response) => {
        try {
          const result = worldInfoSchema.parse(response) as WorldInfoData
          const { worldInfo } = worlInfoParser(result)

          initPagination([...worldInfo.keys()])
          setWorldInfoData(worldInfo)

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          const { worldInfo } = worlInfoParser(
            defaultWorldInfo as WorldInfoData
          )

          setWorldInfoData(worldInfo)
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
