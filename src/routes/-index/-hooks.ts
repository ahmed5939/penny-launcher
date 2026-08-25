import type { DropzoneOptions } from 'react-dropzone'
import type { WorldInfoMission } from '../../types/data/advanced-mode/world-info'
import type { WorldInfoData } from '../../types/services/advanced-mode/world-info'

import { Collection } from '@discordjs/collection'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { AutomationStatusType } from '../../config/constants/automation'

import { useAutomationStore } from '../../state/stw-operations/automation'
import { useAutoLlamaStore } from '../../state/stw-operations/auto/llamas'
import { useTaxiServiceStore } from '../../state/stw-operations/taxi-service'

import {
  useWorldInfo,
  useWorldInfoActions,
} from '../../hooks/advanced-mode/world-info'
import {
  useAlertsDoneDataActions,
  useAlertsDoneLoader,
  useAlertsDoneMarkedSync,
} from '../../hooks/alerts/alerts-done'
import { useAlertsOverviewPaginationInit } from '../../hooks/alerts/overview'
import { usePrimaryAccount } from '../../hooks/accounts/scope'
import { useGetAutomationDataStatus } from '../../hooks/stw-operations/automation'
import { useGetTaxiServiceDataStatus } from '../../hooks/stw-operations/taxi-service'

import { worlInfoParser } from '../../lib/parsers/world-info'
import { worldInfoSchema } from '../../lib/validations/schemas/world-info'
import { toast } from '../../lib/notifications'

export function useAlertItemCounter({
  validationFn,
  data,
  key,
}: {
  data: Collection<string, WorldInfoMission>
  key?: string
  validationFn?: (key: string) => boolean
}) {
  return data.reduce((accumulator, mission) => {
    const alert = mission.ui.alert.rewards.find(
      (reward) =>
        validationFn?.(reward.itemId) ??
        (key !== undefined ? reward.itemId.includes(key) : false),
    )

    accumulator += alert?.quantity ?? 0

    return accumulator
  }, 0)
}

export function useIntersectingElement({ deps }: { deps?: unknown }) {
  const $element = useRef<HTMLHeadingElement>(null)

  useEffect(
    () => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          entry.target.classList.toggle(
            'is-sticky',
            entry.intersectionRatio < 1,
          )
        },
        {
          threshold: [1],
        },
      )

      if ($element.current) {
        observer.observe($element.current)
      }

      return () => {
        observer.disconnect()
      }
    },
    deps !== undefined ? [deps] : [],
  )

  return $element
}

export function useFetchPlayerDataSync() {
  const { data } = useWorldInfo()
  const { updateSearchIsSubmitting } = useAlertsDoneLoader()
  const { updateData } = useAlertsDoneDataActions()
  const { syncCompletedAlerts } = useAlertsDoneMarkedSync()

  useEffect(() => {
    const listener = window.electronAPI.fetchPlayerDataNotification(
      async (response) => {
        if (response.data) {
          const toSync =
            response.data.profileChanges?.profile.stats.attributes.mission_alert_redemption_record?.claimData?.reduce(
              (accumulator, current) => {
                let currentMissionGuid: string | undefined

                data.forEach((missions) => {
                  missions.forEach((mission) => {
                    if (
                      mission.raw.alert?.missionAlertGuid ===
                      current.missionAlertId
                    ) {
                      currentMissionGuid = mission.raw.mission.missionGuid
                    }
                  })
                })

                if (currentMissionGuid) {
                  accumulator[currentMissionGuid] = true
                }

                return accumulator
              },
              {} as Record<string, boolean>,
            ) ?? {}

          syncCompletedAlerts(response.data.lookup.id, toSync)
        }

        updateData(response)
        updateSearchIsSubmitting(false)
      },
    )

    return () => {
      listener.removeListener()
    }
  }, [data])
}

export function useDropzoneConfig() {
  const { i18n, t } = useTranslation(['alerts'])

  const { setWorldInfoData, updateWorldInfoLoading } =
    useWorldInfoActions()
  const { initPagination } = useAlertsOverviewPaginationInit()

  const onDropAccepted: NonNullable<DropzoneOptions['onDropAccepted']> =
    useCallback(
      async (files) => {
        const [currentFile] = files

        if (currentFile) {
          try {
            updateWorldInfoLoading('isReloading', true)

            const blob = new Blob([currentFile], {
              type: 'application/json',
            })
            const result = worldInfoSchema.parse(
              JSON.parse(await blob.text()),
            ) as WorldInfoData
            const { worldInfo } = worlInfoParser(result)

            initPagination(worldInfo.keys().toArray())
            setWorldInfoData(worldInfo)
          } catch (error) {
            toast(t('world-info.notifications.error'), {
              duration: 5000,
            })
          } finally {
            updateWorldInfoLoading('isReloading', false)
          }
        }
      },
      [i18n.language],
    )
  const { getRootProps, isDragActive, isDragAccept, isDragReject } =
    useDropzone({
      onDropAccepted,
      accept: {
        'application/json': ['.json'],
      },
      maxFiles: 1,
      noClick: true,
    })
  const isFileAccepted = !(isDragActive && isDragAccept)
  const isFileRejected = !(isDragActive && isDragReject)

  return {
    isFileAccepted,
    isFileRejected,

    getRootProps,
  }
}

/**
 * `running`  the service is connected and listening right now.
 * `issue`    at least one account disconnected or errored.
 * `configured` accounts are attached to the tool but nothing is listening.
 * `off`      no account uses the tool.
 */
export type PlayServiceStatus = 'running' | 'issue' | 'configured' | 'off'

export type PlayService = {
  accounts: number
  key: 'auto-kick' | 'taxi-service' | 'auto-llamas'
  status: PlayServiceStatus
  to: string
}

function resolveServiceStatus(
  status: AutomationStatusType | null,
  accounts: number
): PlayServiceStatus {
  if (status === AutomationStatusType.ISSUE) {
    return 'issue'
  }

  if (status !== null) {
    return 'running'
  }

  return accounts > 0 ? 'configured' : 'off'
}

/**
 * Live state of the background automations, for the Play screen. Auto-llamas
 * has no listening socket — it only ever reports how many accounts opted in,
 * so it never claims to be "running".
 */
export function useAutomationServices() {
  const { status: autoKickStatus } = useGetAutomationDataStatus()
  const { status: taxiStatus } = useGetTaxiServiceDataStatus()

  const autoKickAccounts = useAutomationStore((state) => state.accounts)
  const taxiAccounts = useTaxiServiceStore((state) => state.accounts)
  const llamaAccounts = useAutoLlamaStore((state) => state.accounts)

  const autoKickTotal = Object.keys(autoKickAccounts).length
  const taxiTotal = Object.keys(taxiAccounts).length
  const llamasTotal = Object.values(llamaAccounts).filter(
    (account) => account.actions['free-llamas']
  ).length

  const services: Array<PlayService> = [
    {
      accounts: autoKickTotal,
      key: 'auto-kick',
      status: resolveServiceStatus(autoKickStatus, autoKickTotal),
      to: '/stw-operations/automation',
    },
    {
      accounts: taxiTotal,
      key: 'taxi-service',
      status: resolveServiceStatus(taxiStatus, taxiTotal),
      to: '/stw-operations/taxi-service',
    },
    {
      accounts: llamasTotal,
      key: 'auto-llamas',
      status: llamasTotal > 0 ? 'configured' : 'off',
      to: '/stw-operations/auto-llamas',
    },
  ]

  return {
    running: services.filter((service) => service.status === 'running')
      .length,
    services,
  }
}

/**
 * How many mission alerts the loaded world info actually contains, so the
 * Play screen can tell "no alerts today" apart from "nothing loaded yet".
 */
export function useAlertsSummary() {
  const { data, isFetching, isReloading } = useWorldInfo()

  const total = useMemo(
    () =>
      data.reduce(
        (accumulator, missions) =>
          accumulator +
          missions.filter(
            (mission) => mission.ui.alert.rewards.length > 0
          ).size,
        0
      ),
    [data]
  )

  return {
    isEmpty: data.size <= 0,
    isLoading: isFetching || isReloading,
    total,
  }
}

export function useFetchAlerts() {
  const { isFetching, isReloading } = useWorldInfo()
  const { updateWorldInfoLoading } = useWorldInfoActions()
  const account = usePrimaryAccount()

  const fetchAlerts = () => {
    if (!account) {
      return
    }

    updateWorldInfoLoading('isReloading', true)
    window.electronAPI.requestHomeWorldInfo(account.accountId)
  }

  return {
    isDisabled: !account || isFetching || isReloading,
    isReloading,

    fetchAlerts,
  }
}
