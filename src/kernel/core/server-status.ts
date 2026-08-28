import type { LightswitchStatus } from '../../services/endpoints/lightswitch'
import axios from 'axios'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'

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

/**
 * The public status page (status.epicgames.com, a Statuspage instance) is the
 * only source that covers every Epic service — Lightswitch alone only knows
 * about Fortnite. Its responses are normalised here into English-named types.
 */
export type EpicComponentStatus =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'under_maintenance'
  | 'unknown'

export type EpicComponent = {
  id: string
  name: string
  status: EpicComponentStatus
}

export type EpicComponentGroup = {
  children: Array<EpicComponent>
  id: string
  name: string
  status: EpicComponentStatus
}

export type EpicIncident = {
  createdAt: string
  id: string
  impact: string
  name: string
  resolvedAt: string | null
  shortlink: string
  status: string
  updates: Array<{
    body: string
    createdAt: string
    id: string
    status: string
  }>
  updatedAt: string
}

export type EpicOverallStatus = {
  description: string
  indicator: string
}

export type EpicStatusSummary = {
  degraded: number
  majorOutage: number
  maintenance: number
  operational: number
  partialOutage: number
  total: number
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
  /** Grouped components — a group header plus the services under it. */
  groups?: Array<EpicComponentGroup>
  incidents?: Array<EpicIncident>
  /** Overall status page indicator, e.g. `none` → all systems operational. */
  page?: EpicOverallStatus
  /** Counts across every component on the status page. */
  summary?: EpicStatusSummary
  /** Services that belong to no group on the status page. */
  standalone?: Array<EpicComponent>
  pageError?: string
}

const statusPageBase = 'https://status.epicgames.com/api/v2'

const componentStatuses: Array<EpicComponentStatus> = [
  'operational',
  'degraded_performance',
  'partial_outage',
  'major_outage',
  'under_maintenance',
]

function parseComponentStatus(value: unknown): EpicComponentStatus {
  return componentStatuses.includes(value as EpicComponentStatus)
    ? (value as EpicComponentStatus)
    : 'unknown'
}

/**
 * Incident history: everything still unresolved, plus resolved incidents from
 * the last two weeks so the page keeps a record once the fire is out. The
 * endpoint returns the most recent incidents first, newest updates last.
 */
function parseIncidents(raw: unknown): Array<EpicIncident> {
  const list = Array.isArray(raw) ? raw : []
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const incidents: Array<EpicIncident> = []

  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue

    const incident = item as Record<string, unknown>
    const resolvedAt = typeof incident.resolved_at === 'string' ? incident.resolved_at : null

    if (resolvedAt !== null) {
      const resolvedTime = Date.parse(resolvedAt)

      if (Number.isNaN(resolvedTime) || resolvedTime < cutoff) {
        continue
      }
    }

    const updates = Array.isArray(incident.incident_updates)
      ? incident.incident_updates.map((update) => {
          const record =
            typeof update === 'object' && update !== null
              ? (update as Record<string, unknown>)
              : {}

          return {
            body: typeof record.body === 'string' ? record.body : '',
            createdAt:
              typeof record.created_at === 'string' ? record.created_at : '',
            id: `${record.id ?? ''}`,
            status: typeof record.status === 'string' ? record.status : '',
          }
        })
      : []

    incidents.push({
      createdAt:
        typeof incident.created_at === 'string' ? incident.created_at : '',
      id: `${incident.id ?? ''}`,
      impact: typeof incident.impact === 'string' ? incident.impact : 'none',
      name: typeof incident.name === 'string' ? incident.name : 'Incident',
      resolvedAt,
      shortlink:
        typeof incident.shortlink === 'string' ? incident.shortlink : '',
      status: typeof incident.status === 'string' ? incident.status : '',
      updatedAt:
        typeof incident.updated_at === 'string' ? incident.updated_at : '',
      updates,
    })

    if (incidents.length >= 12) break
  }

  return incidents.sort((a, b) => {
    // Unresolved first, then most recently touched.
    if ((a.resolvedAt === null) !== (b.resolvedAt === null)) {
      return a.resolvedAt === null ? -1 : 1
    }

    return Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt)
  })
}

async function fetchStatusPage(): Promise<
  Pick<
    ServerStatusPayload,
    'page' | 'groups' | 'standalone' | 'incidents' | 'summary' | 'pageError'
  >
> {
  try {
    const [overall, components, incidents] = await Promise.all([
      axios.get(`${statusPageBase}/status.json`, { timeout: 10_000 }),
      axios.get(`${statusPageBase}/components.json`, { timeout: 10_000 }),
      axios.get(`${statusPageBase}/incidents.json`, { timeout: 10_000 }),
    ])

    const rawComponents: Array<Record<string, unknown>> = Array.isArray(
      components.data?.components
    )
      ? components.data.components
      : []

    // Groups are declared with `group: true` and their members point back via
    // `group_id`. `Anchor` is the page's hidden layout node — not a service.
    const groupMap = new Map<string, EpicComponentGroup>()
    const standalone: Array<EpicComponent> = []
    const allStatuses: Array<EpicComponentStatus> = []

    for (const component of rawComponents) {
      const name = typeof component.name === 'string' ? component.name : ''
      const status = parseComponentStatus(component.status)

      if (component.group === true) {
        if (name === 'Anchor') continue

        groupMap.set(`${component.id}`, {
          children: [],
          id: `${component.id}`,
          name,
          status,
        })
        allStatuses.push(status)
      }
    }

    for (const component of rawComponents) {
      if (component.group === true) continue

      const name = typeof component.name === 'string' ? component.name : ''
      const status = parseComponentStatus(component.status)
      const groupId =
        typeof component.group_id === 'string' ? component.group_id : ''
      const group = groupId ? groupMap.get(groupId) : undefined

      if (group) {
        group.children.push({ id: `${component.id}`, name, status })
      } else if (!groupId) {
        standalone.push({ id: `${component.id}`, name, status })
      }
      allStatuses.push(status)
    }

    const summary: EpicStatusSummary = {
      degraded: 0,
      majorOutage: 0,
      maintenance: 0,
      operational: 0,
      partialOutage: 0,
      total: allStatuses.length,
    }

    for (const status of allStatuses) {
      switch (status) {
        case 'degraded_performance':
          summary.degraded += 1
          break
        case 'partial_outage':
          summary.partialOutage += 1
          break
        case 'major_outage':
          summary.majorOutage += 1
          break
        case 'under_maintenance':
          summary.maintenance += 1
          break
        default:
          summary.operational += 1
      }
    }

    return {
      groups: [...groupMap.values()],
      incidents: parseIncidents(incidents.data?.incidents),
      page: {
        description:
          typeof overall.data?.status?.description === 'string'
            ? overall.data.status.description
            : 'All Systems Operational',
        indicator:
          typeof overall.data?.status?.indicator === 'string'
            ? overall.data.status.indicator
            : 'unknown',
      },
      standalone,
      summary,
    }
    } catch (error) {
      RuntimeLog.error('caught:core/server-status.ts', error)

      return {
        groups: [],
        incidents: [],
        page: undefined,
        standalone: [],
        summary: undefined,
        pageError: 'The Epic Games status page could not be reached',
      }
    }
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

    // The public status page needs no token and no account — it fills in the
    // per-service grid and the incident history Lightswitch knows nothing
    // about. It runs after the token is disposed so its latency cannot be
    // confused with the Lightswitch measurement above.
    Object.assign(
      payload,
      await fetchStatusPage()
    )

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
