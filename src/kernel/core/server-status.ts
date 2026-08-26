import type { LightswitchStatus } from '../../services/endpoints/lightswitch'
import axios from 'axios'

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
  diagnostics?: {
    city: string | null
    continent: string | null
    country: string | null
    latencyMs: number
    subdivision: string | null
  }
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

      const latencyStartedAt = Date.now()
      const response = await getLightswitchStatusBulk(trackedServiceIds, {
        headers: {
          Authorization: `bearer ${token}`,
        },
      })
      const latencyMs = Date.now() - latencyStartedAt

      const region = await axios
        .get<{
          city?: { names?: { en?: string } }
          continent?: { code?: string; names?: { en?: string } }
          country?: { iso_code?: string; names?: { en?: string } }
          subdivisions?: Array<{ names?: { en?: string } }>
        }>('https://ip-data-service-prod.ecbc.live.use1a.on.epicgames.com/region', {
          headers: { Authorization: `bearer ${token}` },
          timeout: 10_000,
        })
        .catch(() => null)

      payload.diagnostics = {
        city: region?.data.city?.names?.en ?? null,
        continent:
          region?.data.continent?.names?.en ??
          region?.data.continent?.code ??
          null,
        country:
          region?.data.country?.names?.en ??
          region?.data.country?.iso_code ??
          null,
        latencyMs,
        subdivision: region?.data.subdivisions?.[0]?.names?.en ?? null,
      }

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
