import {
  getPennyDBMissions,
  type PennyDBMissionsByZone,
} from '../../services/endpoints/pennydb'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'

export type PennyDBMissionsPayload = {
  errorMessage?: string
  fetchedAt: number
  missions: PennyDBMissionsByZone
}

export class PennyDBMissions {
  static async request() {
    const payload: PennyDBMissionsPayload = {
      fetchedAt: Date.now(),
      missions: {},
    }

    try {
      const response = await getPennyDBMissions()
      payload.missions = response.data?.missions ?? {}
    } catch (error) {
      RuntimeLog.error('caught:core/pennydb-missions.ts', error)
      payload.errorMessage = 'Could not reach Penny DB'
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.HomePennyDBMissionsResponse,
      payload
    )
  }
}
