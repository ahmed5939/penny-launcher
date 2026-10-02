import type { LightswitchStatus } from '../../services/endpoints/lightswitch'
import type {
  FortniteSwitch,
  ServerStatusPayload,
  StatusPage,
} from '../../features/server-status/model'

import axios from 'axios'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'

import { launcherAppClient2 } from '../../config/fortnite/clients'

import { parseStatusPage } from '../../features/server-status/model'
import { getLightswitchStatusBulk } from '../../services/endpoints/lightswitch'
import {
  createAccessTokenUsingClientCredentials,
  killSession,
} from '../../services/endpoints/oauth'

const statusPageBase = 'https://status.epicgames.com/api/v2'

export class ServerStatus {
  static async request() {
    const errors: Array<string> = []
    const [fortnite, statusPage] = await Promise.all([
      ServerStatus.lightswitch().catch((error) => {
        RuntimeLog.error('caught:core/server-status.ts', error)
        errors.push("Couldn't reach Fortnite's login check.")

        return { maintenanceUri: null, message: '', status: 'UNKNOWN' } as const
      }),
      ServerStatus.statusPage().catch((error) => {
        RuntimeLog.error('caught:core/server-status.ts', error)
        errors.push("Couldn't reach Epic's status page.")

        return null
      }),
    ])
    const payload: ServerStatusPayload = { errors, fortnite, statusPage }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ServerStatusResponse,
      payload
    )
  }

  /**
   * Lightswitch rejects anonymous requests, so this borrows the same
   * client-credentials token the game-path detection uses, then disposes of
   * it. No user account is involved — status is not per-account data.
   */
  private static async lightswitch(): Promise<FortniteSwitch> {
    const auth = await createAccessTokenUsingClientCredentials({
      authorization: launcherAppClient2.auth,
    })
    const token = auth.data.access_token

    try {
      const response = await getLightswitchStatusBulk(['Fortnite'], {
        headers: { Authorization: `bearer ${token}` },
      })

      return ServerStatus.parseSwitch(
        response.data.find(
          (item) => item.serviceInstanceId?.toLowerCase() === 'fortnite'
        )
      )
    } finally {
      killSession(token, {
        headers: { Authorization: `bearer ${token}` },
      }).catch(() => {})
    }
  }

  /** The public status page: no token, no account. */
  private static async statusPage(): Promise<StatusPage> {
    const [components, incidents] = await Promise.all([
      axios.get(`${statusPageBase}/components.json`, { timeout: 10_000 }),
      axios.get(`${statusPageBase}/incidents.json`, { timeout: 10_000 }),
    ])

    return parseStatusPage(
      components.data?.components,
      incidents.data?.incidents
    )
  }

  private static parseSwitch(data?: LightswitchStatus): FortniteSwitch {
    if (!data) {
      return { maintenanceUri: null, message: '', status: 'UNKNOWN' }
    }

    return {
      maintenanceUri: data.maintenanceUri ?? null,
      message: data.message ?? '',
      status: data.status === 'UP' ? 'UP' : 'DOWN',
    }
  }
}
