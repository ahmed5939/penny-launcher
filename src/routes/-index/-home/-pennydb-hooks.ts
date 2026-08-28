import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  missionHasPennyDBAlert,
  missionHasPennyDBVBucks,
  pennyDBMissionZones,
  type PennyDBMission,
  type PennyDBMissionsByZone,
  type PennyDBMissionZone,
} from '../../../services/endpoints/pennydb'
import { usePennyDBMissionsStore } from '../../../state/home/pennydb-missions'

export type PennyDBBoardFilter = 'all' | 'alerts' | 'vbucks'

export type PennyDBBoardRow = {
  hasAlert: boolean
  hasVBucks: boolean
  id: string
  mission: PennyDBMission
  zone: PennyDBMissionZone
}

function powerLevelValue(pl: string | undefined) {
  const match = pl?.match(/\d+/)

  return match ? Number(match[0]) : 0
}

function flattenMissions(
  missions: PennyDBMissionsByZone
): Array<PennyDBBoardRow> {
  const rows: Array<PennyDBBoardRow> = []

  for (const zone of pennyDBMissionZones) {
    const list = missions[zone] ?? []

    list.forEach((mission, index) => {
      rows.push({
        hasAlert: missionHasPennyDBAlert(mission),
        hasVBucks: missionHasPennyDBVBucks(mission),
        id: `${zone}-${index}-${mission.pl ?? ''}-${mission.missionType?.name ?? ''}`,
        mission,
        zone,
      })
    })
  }

  return rows
}

function compareBoardRows(left: PennyDBBoardRow, right: PennyDBBoardRow) {
  if (left.hasVBucks !== right.hasVBucks) {
    return left.hasVBucks ? -1 : 1
  }

  if (left.hasAlert !== right.hasAlert) {
    return left.hasAlert ? -1 : 1
  }

  return powerLevelValue(right.mission.pl) - powerLevelValue(left.mission.pl)
}

export function usePennyDBMissionsBoard() {
  const { errorMessage, isLoading, lastUpdatedAt, missions } =
    usePennyDBMissionsStore(
      useShallow((state) => ({
        errorMessage: state.errorMessage,
        isLoading: state.isLoading,
        lastUpdatedAt: state.lastUpdatedAt,
        missions: state.missions,
      }))
    )
  const setLoading = usePennyDBMissionsStore((state) => state.setLoading)

  const rows = useMemo(
    () => flattenMissions(missions).sort(compareBoardRows),
    [missions]
  )

  const alertCount = useMemo(
    () => rows.filter((row) => row.hasAlert).length,
    [rows]
  )
  const vbucksCount = useMemo(
    () => rows.filter((row) => row.hasVBucks).length,
    [rows]
  )

  const refresh = () => {
    setLoading(true)
    window.electronAPI.requestPennyDBMissions()
  }

  return {
    alertCount,
    errorMessage,
    isLoading,
    lastUpdatedAt,
    refresh,
    rows,
    vbucksCount,
  }
}

export function filterPennyDBBoardRows(
  rows: Array<PennyDBBoardRow>,
  zone: PennyDBMissionZone | 'all',
  filter: PennyDBBoardFilter
) {
  return rows.filter((row) => {
    if (zone !== 'all' && row.zone !== zone) {
      return false
    }

    if (filter === 'alerts') {
      return row.hasAlert
    }

    if (filter === 'vbucks') {
      return row.hasVBucks
    }

    return true
  })
}
