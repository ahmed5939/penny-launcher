import type { LightswitchStatus } from '../../services/endpoints/lightswitch'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'

import { launcherAppClient2 } from '../../config/fortnite/clients'

import { getLightswitchStatusBulk } from '../../services/endpoints/lightswitch'
import {
  createAccessTokenUsingClientCredentials,
  killSession,
} from '../../services/endpoints/oauth'

/**
 * `Fortnite` is the only service instance Lightswitch actually exposes —
 * `launcher`, `orion` and friends all answer `service_instance.not_found`.
 * Kept as a list because the bulk endpoint takes one, and so adding a real
 * id later needs no other change.
 */
export const trackedServiceIds = ['Fortnite']

export type ServerStatusEntry = {
  allowedActions: Array<string>
  banned: boolean
  maintenanceUri: string | null
  message: string
  serviceId: string
  status: 'DOWN' | 'UNKNOWN' | 'UP'
}

export type ServerStatusPayload = {
  entries: Array<ServerStatusEntry>
  errorMessage?: string
}

export class ServerStatus {
  /**
   * Lightswitch rejects anonymous requests, so this borrows the same
   * client-credentials token the game-path detection uses, then disposes of
   * it. No user account is involved — status is not per-account data.
   */
  static async request() {
    const payload: ServerStatusPayload = { entries: [] }
    let token: string | null = null

    try {
      const auth = await createAccessTokenUsingClientCredentials({
        authorization: launcherAppClient2.auth,
      })

      token = auth.data.access_token

      const response = await getLightswitchStatusBulk(trackedServiceIds, {
        headers: {
          Authorization: `bearer ${token}`,
        },
      })

      payload.entries = trackedServiceIds.map((serviceId) => {
        const match = response.data.find(
          (item) =>
            item.serviceInstanceId?.toLowerCase() ===
            serviceId.toLowerCase()
        )

        return ServerStatus.parseEntry(serviceId, match)
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      payload.errorMessage = 'Could not reach the Epic Games status service'
      payload.entries = trackedServiceIds.map((serviceId) =>
        ServerStatus.parseEntry(serviceId)
      )
    }

    if (token !== null) {
      killSession(token, {
        headers: {
          Authorization: `bearer ${token}`,
        },
      }).catch(() => {})
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ServerStatusResponse,
      payload
    )
  }

  private static parseEntry(
    serviceId: string,
    data?: LightswitchStatus
  ): ServerStatusEntry {
    if (!data) {
      return {
        allowedActions: [],
        banned: false,
        maintenanceUri: null,
        message: '',
        serviceId,
        status: 'UNKNOWN',
      }
    }

    return {
      allowedActions: data.allowedActions.map((action) => `${action}`),
      banned: data.banned ?? false,
      maintenanceUri: data.maintenanceUri ?? null,
      message: data.message ?? '',
      serviceId,
      status: data.status === 'UP' ? 'UP' : 'DOWN',
    }
  }
}
