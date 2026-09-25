import { Activity, Bell, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Switch } from '../../../components/ui/switch'
import {
  Callout,
  Chip,
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  RefreshButton,
  StatusDot,
  StatusPill,
  type StatusTone,
} from '../../../components/page'

import type { EpicComponentStatus } from '../../../kernel/core/server-status'

import { useServerStatusData } from './-hooks'

import { cn } from '../../../lib/utils'

dayjs.extend(relativeTime)

const serviceLabels: Record<string, string> = {
  Fortnite: 'Fortnite',
}

const componentLabels: Record<EpicComponentStatus, string> = {
  operational: 'Operational',
  degraded_performance: 'Degraded',
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
  under_maintenance: 'Maintenance',
  unknown: 'Unknown',
}

const componentTones: Record<EpicComponentStatus, StatusTone> = {
  operational: 'active',
  degraded_performance: 'warning',
  partial_outage: 'danger',
  major_outage: 'danger',
  under_maintenance: 'idle',
  unknown: 'idle',
}

const overallLabels: Record<string, { label: string; tone: StatusTone }> = {
  none: { label: 'All systems operational', tone: 'active' },
  minor: { label: 'Minor degradation', tone: 'warning' },
  major: { label: 'Partial outage', tone: 'danger' },
  critical: { label: 'Major outage', tone: 'danger' },
  maintenance: { label: 'Under maintenance', tone: 'idle' },
  unknown: { label: 'Unknown', tone: 'idle' },
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  const {
    diagnostics,
    entries,
    errorMessage,
    groups,
    incidents,
    page,
    pageError,
    standalone,
    summary,
    handleCheck,
    isDown,
    isLoading,
    isUnknown,
    lastCheckedAt,
  } = useServerStatusData()

  const overall =
    page === null
      ? undefined
      : (overallLabels[page.indicator] ?? overallLabels.unknown)

  return (
    <>
      <PageHeader
        icon={Activity}
        section={t('advanced-mode.title')}
        title={
          <span className="flex items-center gap-2">
            {t('advanced-mode.options.server-status')}
            <BetaBadge />
          </span>
        }
        description="Whether Fortnite is up, the health of every Epic service and recent incidents."
        actions={
          <RefreshButton
            loading={isLoading}
            onClick={handleCheck}
          />
        }
      />

      {(errorMessage || pageError) && (
        <Callout
          title="Status unavailable"
          tone="warning"
        >
          {[errorMessage, pageError].filter(Boolean).join(' · ')}
        </Callout>
      )}

      <NowPanel
        diagnostics={diagnostics}
        entries={entries}
        headline={
          overall ??
          (isUnknown
            ? { label: 'Status unknown', tone: 'idle' }
            : isDown
              ? { label: 'Fortnite is down', tone: 'danger' }
              : { label: 'Fortnite is up', tone: 'active' })
        }
        lastCheckedAt={lastCheckedAt}
        summary={summary}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {groups.length > 0 && (
            <div className="grid items-start gap-6 lg:grid-cols-2">
              {groups.map((group) => {
                const degraded = group.children.some(
                  (child) =>
                    child.status === 'partial_outage' ||
                    child.status === 'major_outage'
                )
                const warn = !degraded && (
                  group.status === 'degraded_performance' ||
                  group.children.some(
                    (child) => child.status === 'degraded_performance'
                  )
                )

                return (
                  <Panel key={group.id}>
                    <PanelHeader
                      title={group.name}
                      actions={
                        <StatusPill
                          tone={
                            degraded ? 'danger' : warn ? 'warning' : 'active'
                          }
                          variant="dot"
                        >
                          {degraded
                            ? 'Issues'
                            : warn
                              ? 'Degraded'
                              : 'Operational'}
                        </StatusPill>
                      }
                      compact
                    />
                    <ul className="px-5 py-2">
                      {group.children.map((child) => (
                        <ComponentLine
                          key={child.id}
                          name={child.name}
                          status={child.status}
                        />
                      ))}
                    </ul>
                  </Panel>
                )
              })}
            </div>
          )}

          {standalone.length > 0 && (
            <Panel>
              <PanelHeader
                title="Other Epic services"
                compact
              />
              <ul className="grid gap-x-8 px-5 py-2 sm:grid-cols-2 lg:grid-cols-3">
                {standalone.map((component) => (
                  <ComponentLine
                    key={component.id}
                    name={component.name}
                    status={component.status}
                  />
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <IncidentHistory incidents={incidents} />
          <NotificationRules />
        </div>
      </div>
    </>
  )
}

/** One component: its name, and its state as a dot and a word. */
function ComponentLine({
  name,
  status,
}: {
  name: string
  status: EpicComponentStatus
}) {
  const quiet = status === 'operational'

  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-ui text-foreground/90">
        {name}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StatusDot tone={componentTones[status]} />
        <span
          className={cn(
            'text-xs',
            quiet ? 'text-muted-foreground' : 'font-medium text-foreground'
          )}
        >
          {componentLabels[status]}
        </span>
      </span>
    </li>
  )
}

type ServerStatus = ReturnType<typeof useServerStatusData>

/**
 * The answer first: is Fortnite up, in one line you can read from across the
 * room, then what backs it — the game service, how many Epic components are
 * healthy, where Epic thinks you are and how fast it answers.
 */
function NowPanel({
  diagnostics,
  entries,
  headline,
  lastCheckedAt,
  summary,
}: {
  diagnostics: ServerStatus['diagnostics']
  entries: ServerStatus['entries']
  headline: { label: string; tone: StatusTone }
  lastCheckedAt: ServerStatus['lastCheckedAt']
  summary: ServerStatus['summary']
}) {
  const issues = summary
    ? summary.degraded + summary.partialOutage + summary.majorOutage
    : 0
  const region = diagnostics
    ? [diagnostics.city, diagnostics.subdivision, diagnostics.country]
        .filter(Boolean)
        .join(', ') ||
      diagnostics.continent ||
      'Unavailable'
    : null

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-x-10 gap-y-4 px-5 py-5">
        <div className="min-w-0 flex-1 basis-72">
          <p
            className={cn(
              'flex items-center gap-3 text-display-sm font-semibold leading-tight',
              headlineText[headline.tone]
            )}
          >
            <StatusDot
              className="size-2.5"
              pulse={headline.tone === 'active'}
              tone={headline.tone}
            />
            {headline.label}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {lastCheckedAt
              ? `Checked ${dayjs(lastCheckedAt).format('LT')} · rechecks every 3 minutes`
              : 'Rechecks every 3 minutes'}
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {entries.map((entry) => (
            <Figure
              key={entry.serviceId}
              label={serviceLabels[entry.serviceId] ?? entry.serviceId}
              tone={
                entry.status === 'UP'
                  ? 'text-success'
                  : entry.status === 'DOWN'
                    ? 'text-destructive'
                    : undefined
              }
              value={
                entry.status === 'UP'
                  ? 'Up'
                  : entry.status === 'DOWN'
                    ? 'Down'
                    : 'Unknown'
              }
            />
          ))}
          {summary && summary.total > 0 && (
            <Figure
              label="Components healthy"
              tone={issues > 0 ? 'text-warning' : undefined}
              value={`${summary.operational} / ${summary.total}`}
            />
          )}
          {diagnostics && (
            <Figure
              label={latencyLabel(diagnostics.latencyMs)}
              value={`${diagnostics.latencyMs} ms`}
            />
          )}
          {region && <Figure label="Epic region" value={region} />}
        </dl>
      </div>

      {entries.some((entry) => entry.message || entry.banned) && (
        <div className="space-y-3 border-t border-border/30 px-5 py-4">
          {entries.map((entry) => (
            <div className="space-y-3" key={entry.serviceId}>
              {entry.message && (
                <p className="text-ui leading-relaxed text-muted-foreground">
                  {entry.message}
                </p>
              )}
              {entry.banned && (
                <Callout tone="danger">
                  This account is banned from the service.
                </Callout>
              )}
            </div>
          ))}
        </div>
      )}

      {summary && issues + summary.maintenance > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/30 px-5 py-2.5 text-xs text-muted-foreground">
          {summary.degraded > 0 && (
            <span className="text-warning">{summary.degraded} degraded</span>
          )}
          {summary.partialOutage > 0 && (
            <span className="text-destructive">
              {summary.partialOutage} partial outage
            </span>
          )}
          {summary.majorOutage > 0 && (
            <span className="text-destructive">
              {summary.majorOutage} major outage
            </span>
          )}
          {summary.maintenance > 0 && (
            <span>{summary.maintenance} in maintenance</span>
          )}
        </p>
      )}
    </Panel>
  )
}

const headlineText: Record<StatusTone, string> = {
  active: 'text-foreground',
  danger: 'text-destructive',
  idle: 'text-foreground',
  warning: 'text-warning',
}

function Figure({
  label,
  tone,
  value,
}: {
  label: string
  tone?: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <dt className="micro-label">{label}</dt>
      <dd className={cn('figure mt-1.5 truncate text-title font-semibold', tone)}>
        {value}
      </dd>
    </div>
  )
}

const impactTones: Record<string, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  critical: { label: 'Critical', tone: 'danger' },
  major: { label: 'Major', tone: 'danger' },
  minor: { label: 'Minor', tone: 'warning' },
  none: { label: 'Info', tone: 'neutral' },
}

function IncidentHistory({
  incidents,
}: {
  incidents: Array<{
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
  }>
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = (id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  return (
    <Panel>
      <PanelHeader
        title="Incidents"
        actions={
          incidents.length > 0 ? (
            <Chip tone="neutral">
              {incidents.filter((incident) => incident.resolvedAt === null).length}{' '}
              active
            </Chip>
          ) : undefined
        }
        compact
      />
      <PanelBody className="py-2">
        {incidents.length === 0 ? (
          <p className="py-3 text-ui text-muted-foreground">
            Nothing in the last two weeks. Epic's status page is quiet.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {incidents.map((incident) => {
              const impact =
                impactTones[incident.impact] ?? impactTones.none
              const isOpen = expanded.has(incident.id)

              return (
                <li key={incident.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                    onClick={() => toggle(incident.id)}
                  >
                    <ChevronDown
                      className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !isOpen && '-rotate-90')}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui font-medium text-foreground/90">
                        {incident.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {dayjs(incident.createdAt).fromNow()} ·{' '}
                        {incident.resolvedAt
                          ? `resolved ${dayjs(incident.resolvedAt).fromNow()}`
                          : 'ongoing'}
                      </span>
                    </span>
                    <Chip tone={impact.tone}>{impact.label}</Chip>
                    {incident.resolvedAt === null && (
                      <StatusPill
                        pulse
                        tone="warning"
                      >
                        Active
                      </StatusPill>
                    )}
                  </button>

                  {isOpen && incident.updates.length > 0 && (
                    <div className="ml-2 space-y-3 border-l border-border/50 pb-4 pl-4">
                      {[...incident.updates].reverse().map((update) => (
                        <div key={update.id}>
                          <p className="micro-label text-muted-foreground">
                            {update.status || 'update'} ·{' '}
                            {dayjs(update.createdAt).format('MMM D, LT')}
                          </p>
                          <p className="mt-1 text-ui leading-relaxed text-foreground/80">
                            {update.body}
                          </p>
                        </div>
                      ))}
                      {incident.shortlink && (
                        <a
                          className="inline-flex text-xs text-primary underline-offset-4 hover:underline"
                          href={incident.shortlink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open on status.epicgames.com
                        </a>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </PanelBody>
    </Panel>
  )
}

type Rules = {
  friendRequests: boolean
  serverDown: boolean
  serverRecovered: boolean
}

const defaultRules: Rules = {
  friendRequests: true,
  serverDown: true,
  serverRecovered: true,
}

function NotificationRules() {
  const [rules, setRules] = useState<Rules>(() => ({
    ...defaultRules,
    ...JSON.parse(localStorage.getItem('penny-notification-rules') ?? '{}'),
  }))

  const toggle = (key: keyof Rules, checked: boolean) => {
    const next = { ...rules, [key]: checked }
    setRules(next)
    localStorage.setItem('penny-notification-rules', JSON.stringify(next))
  }

  return (
    <Panel>
      <PanelHeader
        compact
        icon={Bell}
        title="Notify me when"
      />
      <PanelBody>
        <FieldGroup>
          <Rule label="A service goes down" checked={rules.serverDown} onChange={(value) => toggle('serverDown', value)} />
          <Rule label="A service recovers" checked={rules.serverRecovered} onChange={(value) => toggle('serverRecovered', value)} />
          <Rule label="A friend request arrives" checked={rules.friendRequests} onChange={(value) => toggle('friendRequests', value)} />
        </FieldGroup>
      </PanelBody>
    </Panel>
  )
}

function Rule({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <FieldRow className="py-3" label={label}>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </FieldRow>
  )
}

function latencyLabel(ms: number) {
  if (ms < 100) return 'Excellent'
  if (ms < 250) return 'Good'
  if (ms < 500) return 'Slow'
  return 'Very slow'
}
