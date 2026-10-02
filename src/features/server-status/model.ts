/**
 * Pure model for the Servers page.
 *
 * Two sources answer "can I play right now". Lightswitch is the switch the
 * game itself checks at login, so it decides up or down. Epic's public status
 * page (status.epicgames.com, a Statuspage instance) splits Fortnite into
 * services, covers the rest of Epic and keeps the incident history. This
 * file parses the status page into named types and decides what a Fortnite
 * player sees first. Network and IPC live in `kernel/core/server-status.ts`.
 */

import type { StatusTone } from '../../components/page'

export type ServiceStatus =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'under_maintenance'
  | 'unknown'

export type EpicService = {
  id: string
  name: string
  status: ServiceStatus
}

export type EpicServiceGroup = {
  id: string
  name: string
  services: Array<EpicService>
}

export type EpicIncident = {
  /** What it touched, each with the status page group it sits in. */
  affected: Array<{ group: string | null; id: string; name: string }>
  createdAt: string
  id: string
  /** `none`, `minor`, `major` or `critical`. */
  impact: string
  name: string
  resolvedAt: string | null
  shortlink: string
  /** `investigating`, `identified`, `monitoring` or `resolved`. */
  status: string
  updatedAt: string
  /** Newest first. */
  updates: Array<{ body: string; createdAt: string; id: string; status: string }>
}

export type StatusPage = {
  groups: Array<EpicServiceGroup>
  incidents: Array<EpicIncident>
  /** Services that belong to no group. */
  standalone: Array<EpicService>
}

/** Lightswitch's answer for Fortnite. */
export type FortniteSwitch = {
  maintenanceUri: string | null
  message: string
  status: 'DOWN' | 'UNKNOWN' | 'UP'
}

export type ServerStatusPayload = {
  /** What could not be reached, worded for the page. */
  errors: Array<string>
  fortnite: FortniteSwitch
  statusPage: StatusPage | null
}

/** Incidents older than this are dropped once resolved. */
export const incidentWindowDays = 30

const serviceStatuses: Array<ServiceStatus> = [
  'operational',
  'degraded_performance',
  'partial_outage',
  'major_outage',
  'under_maintenance',
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function parseStatus(value: unknown): ServiceStatus {
  return serviceStatuses.includes(value as ServiceStatus)
    ? (value as ServiceStatus)
    : 'unknown'
}

/**
 * `components` is `components.json`'s `components` and `incidents` is
 * `incidents.json`'s `incidents`, both as Epic sends them. Groups are
 * declared with `group: true` and their members point back via `group_id`;
 * `Anchor` is the page's hidden layout node, not a service. Epic's order is
 * kept.
 */
export function parseStatusPage(
  components: unknown,
  incidents: unknown,
  now = Date.now()
): StatusPage {
  const raw = (Array.isArray(components) ? components : []).map(asRecord)
  const groups = new Map<string, EpicServiceGroup>()
  const standalone: Array<EpicService> = []

  for (const component of raw) {
    const name = asString(component.name)

    if (component.group === true && name !== 'Anchor') {
      groups.set(`${component.id}`, { id: `${component.id}`, name, services: [] })
    }
  }

  for (const component of raw) {
    if (component.group === true) continue

    const service = {
      id: `${component.id}`,
      name: asString(component.name),
      status: parseStatus(component.status),
    }
    const groupId = asString(component.group_id)

    if (!groupId) {
      standalone.push(service)
    } else {
      groups.get(groupId)?.services.push(service)
    }
  }

  const groupNames = new Map([...groups].map(([id, group]) => [id, group.name]))

  return {
    groups: [...groups.values()].filter((group) => group.services.length > 0),
    incidents: parseIncidents(incidents, groupNames, now),
    standalone,
  }
}

/**
 * Everything still open, plus whatever was resolved inside the window, open
 * ones first and then the most recently started.
 */
function parseIncidents(
  raw: unknown,
  groupNames: Map<string, string>,
  now: number
): Array<EpicIncident> {
  const cutoff = now - incidentWindowDays * 24 * 60 * 60 * 1000
  const incidents: Array<EpicIncident> = []

  for (const item of Array.isArray(raw) ? raw : []) {
    const incident = asRecord(item)
    const resolvedAt = asString(incident.resolved_at) || null

    if (resolvedAt !== null && !(Date.parse(resolvedAt) >= cutoff)) continue

    const updates = (Array.isArray(incident.incident_updates)
      ? incident.incident_updates
      : []
    )
      .map(asRecord)
      .map((update) => ({
        body: asString(update.body),
        createdAt: asString(update.created_at),
        id: `${update.id ?? ''}`,
        status: asString(update.status),
      }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

    incidents.push({
      affected: (Array.isArray(incident.components) ? incident.components : [])
        .map(asRecord)
        .map((component) => ({
          group: groupNames.get(asString(component.group_id)) ?? null,
          id: `${component.id ?? ''}`,
          name: asString(component.name),
        })),
      createdAt: asString(incident.created_at),
      id: `${incident.id ?? ''}`,
      impact: asString(incident.impact) || 'none',
      name: asString(incident.name) || 'Incident',
      resolvedAt,
      shortlink: asString(incident.shortlink),
      status: asString(incident.status),
      updatedAt: asString(incident.updated_at),
      updates,
    })
  }

  return incidents.sort((a, b) => {
    if ((a.resolvedAt === null) !== (b.resolvedAt === null)) {
      return a.resolvedAt === null ? -1 : 1
    }

    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

/* ── Fortnite first ─────────────────────────────────────────────────────── */

/** The status page groups that are Fortnite or a mode inside it. */
const fortniteFamily = new Set(['Fortnite', 'LEGO Fortnite', 'Fortnite Festival'])

/**
 * Epic account sign-in sits under Epic Online Services, but no Fortnite
 * login gets past it, so it is listed with Fortnite's own services.
 */
const accountSignIn = {
  group: 'Epic Online Services',
  name: 'Epic Account Services - Authentication',
}

/** Fortnite's services in the order a player meets them, sentence-cased. */
const fortniteServiceOrder: Array<[name: string, label: string]> = [
  ['Login', 'Login'],
  [accountSignIn.name, 'Epic account sign-in'],
  ['Game Services', 'Game services'],
  ['Matchmaking', 'Matchmaking'],
  ['Parties, Friends, and Messaging', 'Parties, friends and messaging'],
  ['Voice Chat', 'Voice chat'],
  ['Item Shop', 'Item Shop'],
  ['Stats and Leaderboards', 'Stats and leaderboards'],
  ['Fortnite Crew', 'Fortnite Crew'],
  ['Website', 'Website'],
]

export type LabelledService = EpicService & { label: string }

/** Fortnite's services plus Epic account sign-in, in play order. */
export function fortniteServices(page: StatusPage): Array<LabelledService> {
  const fortnite = page.groups.find((group) => group.name === 'Fortnite')
  const signIn = page.groups
    .find((group) => group.name === accountSignIn.group)
    ?.services.find((service) => service.name === accountSignIn.name)
  const services = [...(fortnite?.services ?? []), ...(signIn ? [signIn] : [])]
  const rank = (name: string) => {
    const index = fortniteServiceOrder.findIndex(([known]) => known === name)

    return index === -1 ? fortniteServiceOrder.length : index
  }

  return services
    .map((service) => ({
      ...service,
      label:
        fortniteServiceOrder.find(([known]) => known === service.name)?.[1] ??
        service.name,
    }))
    .sort((a, b) => rank(a.name) - rank(b.name))
}

/**
 * Every group but Fortnite's own, Fortnite's modes first, then Epic's order,
 * with the ungrouped services gathered at the end.
 */
export function otherServiceGroups(page: StatusPage): Array<EpicServiceGroup> {
  const others = page.groups.filter((group) => group.name !== 'Fortnite')
  const family = others.filter((group) => fortniteFamily.has(group.name))
  const rest = others.filter((group) => !fortniteFamily.has(group.name))

  return [
    ...family,
    ...rest,
    ...(page.standalone.length > 0
      ? [{ id: 'standalone', name: 'Other', services: page.standalone }]
      : []),
  ]
}

/** Whether an incident touched Fortnite, its modes or Epic sign-in. */
export function isFortniteIncident(incident: EpicIncident) {
  return (
    /fortnite/i.test(incident.name) ||
    incident.affected.some(
      (service) =>
        (service.group !== null && fortniteFamily.has(service.group)) ||
        (service.group === accountSignIn.group &&
          service.name === accountSignIn.name)
    )
  )
}

/** "Fortnite: Login, Matchmaking · Fab". */
export function affectedSummary(incident: EpicIncident) {
  const byGroup = new Map<string, Array<string>>()

  for (const service of incident.affected) {
    const key = service.group ?? ''
    byGroup.set(key, [...(byGroup.get(key) ?? []), service.name])
  }

  return [...byGroup]
    .map(([group, names]) => (group ? `${group}: ${names.join(', ')}` : names.join(', ')))
    .join(' · ')
}

const severity: Record<ServiceStatus, number> = {
  operational: 0,
  unknown: 1,
  under_maintenance: 2,
  degraded_performance: 3,
  partial_outage: 4,
  major_outage: 5,
}

export function worstStatus(services: Array<EpicService>): ServiceStatus {
  return services.reduce<ServiceStatus>(
    (worst, service) =>
      severity[service.status] > severity[worst] ? service.status : worst,
    'operational'
  )
}

export const statusLabels: Record<ServiceStatus, string> = {
  operational: 'Operational',
  degraded_performance: 'Degraded',
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
  under_maintenance: 'Maintenance',
  unknown: 'Unknown',
}

export const statusTones: Record<ServiceStatus, StatusTone> = {
  operational: 'active',
  degraded_performance: 'warning',
  partial_outage: 'danger',
  major_outage: 'danger',
  under_maintenance: 'idle',
  unknown: 'idle',
}

export type Verdict = {
  detail: string
  tone: StatusTone
  title: string
}

const incidentProgress: Record<string, string> = {
  identified: 'Epic has found the cause of',
  investigating: 'Epic is investigating',
  monitoring: 'Epic is monitoring a fix for',
}

/**
 * The answer at the top of the page: is Fortnite up, and if something is
 * wrong, what. Lightswitch decides up or down; the status page says which
 * parts are struggling while the game is up.
 */
export function fortniteVerdict(payload: ServerStatusPayload): Verdict {
  const { fortnite, statusPage } = payload
  const services = statusPage ? fortniteServices(statusPage) : []

  if (fortnite.status === 'UNKNOWN' && statusPage === null) {
    return {
      detail: 'Epic could not be reached. Check your connection, then refresh.',
      title: "Couldn't check Fortnite",
      tone: 'idle',
    }
  }

  if (fortnite.status === 'DOWN') {
    const maintenance =
      /maint/i.test(fortnite.message) ||
      services.some((service) => service.status === 'under_maintenance')

    return {
      detail:
        fortnite.message ||
        (maintenance
          ? 'Epic has taken the game offline for maintenance.'
          : 'Epic is not letting anyone sign in right now.'),
      title: maintenance ? 'Fortnite is down for maintenance' : 'Fortnite is down',
      tone: 'danger',
    }
  }

  const outage = services.filter(
    (service) =>
      service.status === 'partial_outage' || service.status === 'major_outage'
  )
  const degraded = services.filter(
    (service) => service.status === 'degraded_performance'
  )
  const maintenance = services.filter(
    (service) => service.status === 'under_maintenance'
  )

  if (outage.length > 0) {
    return {
      detail:
        outage.length === services.length
          ? 'Every Fortnite service is reporting an outage.'
          : `Trouble with ${listLabels(outage)}. Everything else is running.`,
      title: 'Fortnite is having problems',
      tone: 'danger',
    }
  }

  if (degraded.length + maintenance.length > 0) {
    return {
      detail: [
        degraded.length > 0 &&
          `${listLabels(degraded)} ${degraded.length === 1 ? 'is' : 'are'} slow or failing at times.`,
        maintenance.length > 0 &&
          `${listLabels(maintenance)} ${maintenance.length === 1 ? 'is' : 'are'} under maintenance.`,
      ]
        .filter(Boolean)
        .join(' '),
      title: 'Fortnite is up, with issues',
      tone: 'warning',
    }
  }

  const incident = statusPage?.incidents.find(
    (item) => item.resolvedAt === null && isFortniteIncident(item)
  )

  if (incident) {
    return {
      detail: `${incidentProgress[incident.status] ?? 'Epic is working on'} “${incident.name}”.`,
      title: 'Fortnite is up',
      tone: 'warning',
    }
  }

  return {
    detail:
      statusPage === null
        ? 'The game is letting players in.'
        : 'Every Fortnite service is running normally.',
    title: 'Fortnite is up',
    tone: 'active',
  }
}

/**
 * Whether a fresh check is worth a desktop notification. Only a move between
 * "up" (with or without issues) and "down or failing" counts; a check that
 * could not reach Epic says nothing either way.
 */
export function alertChange(
  previous: Verdict,
  next: Verdict
): 'down' | 'recovered' | null {
  const up = (verdict: Verdict) =>
    verdict.tone === 'active' || verdict.tone === 'warning'

  if (up(previous) && next.tone === 'danger') return 'down'
  if (previous.tone === 'danger' && up(next)) return 'recovered'

  return null
}

/** "23 min", "2 h 10 min", "3 days". */
export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000))

  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)

  if (hours < 48) {
    const rest = minutes % 60

    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
  }

  return `${Math.round(hours / 24)} days`
}

function listLabels(services: Array<LabelledService>) {
  const labels = services.map((service) => service.label)

  return labels.length <= 1
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}
