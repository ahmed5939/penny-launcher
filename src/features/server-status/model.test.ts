import { describe, expect, it } from 'vitest'

import {
  affectedSummary,
  alertChange,
  formatDuration,
  fortniteServices,
  fortniteVerdict,
  isFortniteIncident,
  otherServiceGroups,
  parseStatusPage,
  type ServerStatusPayload,
  type ServiceStatus,
  type StatusPage,
} from './model'

const now = Date.parse('2026-10-02T18:00:00Z')

/** A slice of the real `components.json`, interleaved the way Epic sends it. */
function components(overrides: Record<string, ServiceStatus> = {}) {
  const status = (name: string) => overrides[name] ?? 'operational'

  return [
    { id: 'g-anchor', name: 'Anchor', group: true, status: 'operational' },
    { id: 'g-fn', name: 'Fortnite', group: true, status: 'operational' },
    { id: 'fn-web', name: 'Website', group_id: 'g-fn', status: status('Website') },
    { id: 'rl-login', name: 'Login', group_id: 'g-rl', status: status('RL Login') },
    { id: 'fn-gs', name: 'Game Services', group_id: 'g-fn', status: status('Game Services') },
    { id: 'eos-auth', name: 'Epic Account Services - Authentication', group_id: 'g-eos', status: status('Epic Account Services - Authentication') },
    { id: 'fn-login', name: 'Login', group_id: 'g-fn', status: status('Login') },
    { id: 'g-lego', name: 'LEGO Fortnite', group: true, status: 'operational' },
    { id: 'lego-mm', name: 'Matchmaking', group_id: 'g-lego', status: status('LEGO Matchmaking') },
    { id: 'fn-mm', name: 'Matchmaking', group_id: 'g-fn', status: status('Matchmaking') },
    { id: 'g-rl', name: 'Rocket League', group: true, status: 'operational' },
    { id: 'eos-lobbies', name: 'Lobbies', group_id: 'g-eos', status: 'operational' },
    { id: 'g-eos', name: 'Epic Online Services', group: true, status: 'operational' },
    { id: 'g-empty', name: 'Twinmotion Cloud', group: true, status: 'operational' },
    { id: 'fab', name: 'Fab', status: status('Fab') },
    { id: 'fn-shop', name: 'Item Shop', group_id: 'g-fn', status: status('Item Shop') },
  ]
}

const incidents = [
  {
    id: 'old',
    name: 'Fortnite Matchmaking Issue',
    impact: 'critical',
    status: 'resolved',
    created_at: '2026-06-11T01:35:00Z',
    resolved_at: '2026-06-11T02:24:00Z',
    updated_at: '2026-06-11T02:24:00Z',
    components: [{ id: 'fn-mm', name: 'Matchmaking', group_id: 'g-fn' }],
    incident_updates: [],
  },
  {
    id: 'fab',
    name: 'Trader Verification outage',
    impact: 'major',
    status: 'resolved',
    created_at: '2026-09-16T21:10:00Z',
    resolved_at: '2026-09-18T14:17:00Z',
    updated_at: '2026-09-18T14:17:00Z',
    shortlink: 'https://stspg.io/fab',
    components: [{ id: 'fab', name: 'Fab', group_id: null }],
    incident_updates: [
      { id: 'u1', status: 'investigating', body: 'Broken.', created_at: '2026-09-16T21:10:00Z' },
      { id: 'u2', status: 'resolved', body: 'Fixed.', created_at: '2026-09-18T14:17:00Z' },
    ],
  },
  {
    id: 'login',
    name: 'Login issues on Xbox',
    impact: 'major',
    status: 'resolved',
    created_at: '2026-09-17T15:09:00Z',
    resolved_at: '2026-09-17T15:43:00Z',
    updated_at: '2026-09-17T15:43:00Z',
    components: [
      { id: 'fn-login', name: 'Login', group_id: 'g-fn' },
      { id: 'fn-mm', name: 'Matchmaking', group_id: 'g-fn' },
    ],
    incident_updates: [],
  },
  {
    id: 'open',
    name: 'Stats delayed',
    impact: 'minor',
    status: 'investigating',
    created_at: '2026-10-02T17:30:00Z',
    resolved_at: null,
    updated_at: '2026-10-02T17:30:00Z',
    components: [],
    incident_updates: [],
  },
]

function page(overrides?: Record<string, ServiceStatus>): StatusPage {
  return parseStatusPage(components(overrides), incidents, now)
}

function payload(
  overrides: Partial<ServerStatusPayload> & { services?: Record<string, ServiceStatus> } = {}
): ServerStatusPayload {
  return {
    errors: [],
    fortnite: { maintenanceUri: null, message: '', status: 'UP' },
    statusPage: page(overrides.services),
    ...overrides,
  }
}

describe('parseStatusPage', () => {
  it('nests services under their groups, drops the anchor and empty groups', () => {
    const parsed = page()

    expect(parsed.groups.map((group) => group.name)).toEqual([
      'Fortnite',
      'LEGO Fortnite',
      'Rocket League',
      'Epic Online Services',
    ])
    expect(parsed.groups[0].services.map((service) => service.name)).toEqual([
      'Website',
      'Game Services',
      'Login',
      'Matchmaking',
      'Item Shop',
    ])
    expect(parsed.standalone.map((service) => service.name)).toEqual(['Fab'])
  })

  it('reads an unrecognised status as unknown', () => {
    const parsed = parseStatusPage(
      [{ id: 'x', name: 'Odd', status: 'on_fire' }],
      [],
      now
    )

    expect(parsed.standalone[0].status).toBe('unknown')
  })

  it('keeps open incidents and the last 30 days, open first then newest', () => {
    expect(page().incidents.map((incident) => incident.id)).toEqual([
      'open',
      'login',
      'fab',
    ])
  })

  it('names the group of each affected service and puts updates newest first', () => {
    const fab = page().incidents.find((incident) => incident.id === 'fab')!

    expect(fab.affected).toEqual([{ group: null, id: 'fab', name: 'Fab' }])
    expect(fab.updates.map((update) => update.body)).toEqual(['Fixed.', 'Broken.'])
  })

  it('survives garbage', () => {
    expect(parseStatusPage(null, 'nope', now)).toEqual({
      groups: [],
      incidents: [],
      standalone: [],
    })
  })
})

describe('fortniteServices', () => {
  it('lists Fortnite in play order with Epic sign-in after Login', () => {
    expect(fortniteServices(page()).map((service) => service.label)).toEqual([
      'Login',
      'Epic account sign-in',
      'Game services',
      'Matchmaking',
      'Item Shop',
      'Website',
    ])
  })
})

describe('otherServiceGroups', () => {
  it('leaves Fortnite out, puts its modes first and the ungrouped last', () => {
    expect(otherServiceGroups(page()).map((group) => group.name)).toEqual([
      'LEGO Fortnite',
      'Rocket League',
      'Epic Online Services',
      'Other',
    ])
  })
})

describe('incidents', () => {
  it('counts Fortnite groups, its modes and the name as Fortnite', () => {
    const [open, login, fab] = page().incidents

    expect(isFortniteIncident(login)).toBe(true)
    expect(isFortniteIncident(fab)).toBe(false)
    expect(isFortniteIncident(open)).toBe(false)
    expect(isFortniteIncident({ ...open, name: 'Fortnite stats delayed' })).toBe(true)
  })

  it('summarises what was hit by group', () => {
    const [, login, fab] = page().incidents

    expect(affectedSummary(login)).toBe('Fortnite: Login, Matchmaking')
    expect(affectedSummary(fab)).toBe('Fab')
  })
})

describe('fortniteVerdict', () => {
  it('is up when everything is running', () => {
    expect(fortniteVerdict(payload())).toEqual({
      detail: 'Every Fortnite service is running normally.',
      title: 'Fortnite is up',
      tone: 'active',
    })
  })

  it('ignores trouble elsewhere at Epic', () => {
    expect(
      fortniteVerdict(payload({ services: { Fab: 'major_outage', 'RL Login': 'major_outage' } })).tone
    ).toBe('active')
  })

  it('is down when Lightswitch says so, using its message', () => {
    expect(
      fortniteVerdict(
        payload({
          fortnite: { maintenanceUri: null, message: 'Servers are offline for v32.10.', status: 'DOWN' },
        })
      )
    ).toEqual({
      detail: 'Servers are offline for v32.10.',
      title: 'Fortnite is down',
      tone: 'danger',
    })
  })

  it('calls a down with a service in maintenance a maintenance', () => {
    expect(
      fortniteVerdict(
        payload({
          fortnite: { maintenanceUri: null, message: '', status: 'DOWN' },
          services: { 'Game Services': 'under_maintenance' },
        })
      ).title
    ).toBe('Fortnite is down for maintenance')
  })

  it('names the services in outage', () => {
    expect(
      fortniteVerdict(
        payload({ services: { Login: 'partial_outage', Matchmaking: 'major_outage' } })
      )
    ).toEqual({
      detail: 'Trouble with Login and Matchmaking. Everything else is running.',
      title: 'Fortnite is having problems',
      tone: 'danger',
    })
  })

  it('counts Epic sign-in as part of Fortnite', () => {
    expect(
      fortniteVerdict(
        payload({ services: { 'Epic Account Services - Authentication': 'major_outage' } })
      ).detail
    ).toBe('Trouble with Epic account sign-in. Everything else is running.')
  })

  it('warns about degraded and maintenance services', () => {
    expect(
      fortniteVerdict(
        payload({ services: { Matchmaking: 'degraded_performance', 'Item Shop': 'under_maintenance' } })
      )
    ).toEqual({
      detail: 'Matchmaking is slow or failing at times. Item Shop is under maintenance.',
      title: 'Fortnite is up, with issues',
      tone: 'warning',
    })
  })

  it('mentions an open Fortnite incident while everything reads operational', () => {
    const statusPage = page()
    statusPage.incidents[0] = { ...statusPage.incidents[0], name: 'Fortnite stats delayed' }

    expect(fortniteVerdict(payload({ statusPage }))).toEqual({
      detail: 'Epic is investigating “Fortnite stats delayed”.',
      title: 'Fortnite is up',
      tone: 'warning',
    })
  })

  it('does not guess when nothing could be reached', () => {
    expect(
      fortniteVerdict(
        payload({
          fortnite: { maintenanceUri: null, message: '', status: 'UNKNOWN' },
          statusPage: null,
        })
      ).tone
    ).toBe('idle')
  })
})

describe('alertChange', () => {
  const up = fortniteVerdict(payload())
  const issues = fortniteVerdict(payload({ services: { Matchmaking: 'degraded_performance' } }))
  const down = fortniteVerdict(
    payload({ fortnite: { maintenanceUri: null, message: '', status: 'DOWN' } })
  )
  const unknown = fortniteVerdict(
    payload({ fortnite: { maintenanceUri: null, message: '', status: 'UNKNOWN' }, statusPage: null })
  )

  it('fires on the move between up and down, both ways', () => {
    expect(alertChange(up, down)).toBe('down')
    expect(alertChange(issues, down)).toBe('down')
    expect(alertChange(down, up)).toBe('recovered')
    expect(alertChange(down, issues)).toBe('recovered')
  })

  it('stays quiet otherwise', () => {
    expect(alertChange(up, issues)).toBeNull()
    expect(alertChange(down, down)).toBeNull()
    expect(alertChange(unknown, down)).toBeNull()
    expect(alertChange(down, unknown)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('reads like a person would say it', () => {
    expect(formatDuration(20_000)).toBe('1 min')
    expect(formatDuration(23 * 60_000)).toBe('23 min')
    expect(formatDuration(120 * 60_000)).toBe('2 h')
    expect(formatDuration(130 * 60_000)).toBe('2 h 10 min')
    expect(formatDuration(3 * 24 * 60 * 60_000)).toBe('3 days')
  })
})
