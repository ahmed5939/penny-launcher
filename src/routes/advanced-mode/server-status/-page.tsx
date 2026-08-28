import { UpdateIcon } from '@radix-ui/react-icons'
import {
  Activity,
  Bell,
  ChevronDown,
  Gauge,
  MapPin,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { Switch } from '../../../components/ui/switch'
import {
  Callout,
  Chip,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  StatRow,
  StatTile,
  StatusDot,
  StatusPill,
  type StatusTone,
} from '../../../components/page'

import type { EpicComponentStatus } from '../../../kernel/core/server-status'

import { useServerStatusData } from './-hooks'

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
        description="Live health of every Epic Games service, with incident history. Auto-refreshes every 3 minutes."
        status={
          overall ? (
            <StatusPill
              pulse={overall.tone === 'active'}
              tone={overall.tone}
            >
              {overall.label}
            </StatusPill>
          ) : isUnknown ? (
            <StatusPill tone="idle">Unknown</StatusPill>
          ) : isDown ? (
            <StatusPill tone="danger">Down</StatusPill>
          ) : (
            <StatusPill
              pulse
              tone="active"
            >
              Operational
            </StatusPill>
          )
        }
        actions={
          <Button
            className="min-w-32"
            onClick={handleCheck}
            disabled={isLoading}
          >
            {isLoading ? (
              <UpdateIcon className="animate-spin" />
            ) : (
              'Check again'
            )}
          </Button>
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

      {summary && summary.total > 0 && (
        <StatRow className="lg:grid-cols-5">
          <StatTile
            tone="success"
            value={summary.operational}
            label="Operational"
          />
          <StatTile
            tone="warning"
            value={summary.degraded}
            label="Degraded"
          />
          <StatTile
            tone="danger"
            value={summary.partialOutage}
            label="Partial outage"
          />
          <StatTile
            tone="danger"
            value={summary.majorOutage}
            label="Major outage"
          />
          <StatTile
            tone="default"
            value={summary.maintenance}
            label="Maintenance"
          />
        </StatRow>
      )}

      {diagnostics && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Panel className="flex items-center gap-3 p-4">
            <MapPin className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Detected Epic region</p>
              <p className="text-xs text-muted-foreground">
                {[diagnostics.city, diagnostics.subdivision, diagnostics.country]
                  .filter(Boolean)
                  .join(', ') || diagnostics.continent || 'Unavailable'}
              </p>
            </div>
          </Panel>
          <Panel className="flex items-center gap-3 p-4">
            <Gauge className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Epic API latency</p>
              <p className="text-xs text-muted-foreground">
                {diagnostics.latencyMs} ms · {latencyLabel(diagnostics.latencyMs)}
              </p>
            </div>
          </Panel>
        </div>
      )}

      {entries.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <Panel
              className="p-4"
              key={entry.serviceId}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {serviceLabels[entry.serviceId] ?? entry.serviceId}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Game service availability
                  </p>
                </div>
                {entry.status === 'UP' ? (
                  <StatusPill tone="active">Up</StatusPill>
                ) : entry.status === 'DOWN' ? (
                  <StatusPill tone="danger">Down</StatusPill>
                ) : (
                  <StatusPill tone="idle">Unknown</StatusPill>
                )}
              </div>

              {entry.message && (
                <p className="mt-3 border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
                  {entry.message}
                </p>
              )}

              {entry.banned && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  This account is banned from the service.
                </p>
              )}
            </Panel>
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
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
                  icon={ShieldCheck}
                  title={group.name}
                  actions={
                    <StatusPill
                      tone={
                        degraded ? 'danger' : warn ? 'warning' : 'active'
                      }
                      pulse={!degraded && !warn}
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
                <PanelBody className="py-2">
                  <ul className="divide-y divide-border/40">
                    {group.children.map((child) => (
                      <li
                        className="flex items-center justify-between gap-3 py-2"
                        key={child.id}
                      >
                        <span className="min-w-0 truncate text-[0.8125rem] text-foreground/90">
                          {child.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusDot tone={componentTones[child.status]} />
                          <span className="micro-label text-muted-foreground">
                            {componentLabels[child.status]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </PanelBody>
              </Panel>
            )
          })}
        </div>
      )}

      {standalone.length > 0 && (
        <Panel>
          <PanelHeader
            icon={ShieldCheck}
            title="Other Epic services"
            compact
          />
          <PanelBody>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {standalone.map((component) => (
                <div
                  className="flex items-center justify-between gap-3 py-1"
                  key={component.id}
                >
                  <span className="min-w-0 truncate text-[0.8125rem] text-foreground/90">
                    {component.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusDot tone={componentTones[component.status]} />
                    <span className="micro-label text-muted-foreground">
                      {componentLabels[component.status]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </PanelBody>
        </Panel>
      )}

      <IncidentHistory incidents={incidents} />

      {lastCheckedAt && (
        <p className="text-xs text-muted-foreground">
          Last checked {dayjs(lastCheckedAt).format('LT')} · next check in 3
          minutes
        </p>
      )}

      <NotificationRules />
    </>
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
        icon={Wrench}
        title="Incident history"
        description="Unresolved incidents first, plus anything resolved in the last two weeks."
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
          <p className="py-3 text-sm text-muted-foreground">
            No incidents on record. Epic's status page is quiet.
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
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium text-foreground/90">
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
                    <div className="space-y-3 border-l border-border/50 pb-4 pl-4 ml-2">
                      {[...incident.updates].reverse().map((update) => (
                        <div key={update.id}>
                          <p className="micro-label text-muted-foreground">
                            {update.status || 'update'} ·{' '}
                            {dayjs(update.createdAt).format('MMM D, LT')}
                          </p>
                          <p className="mt-1 text-[0.8125rem] leading-relaxed text-foreground/80">
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
    <Panel className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="size-4 text-primary" />
        <p className="text-sm font-semibold">Notification rules</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Rule label="Service goes down" checked={rules.serverDown} onChange={(value) => toggle('serverDown', value)} />
        <Rule label="Service recovers" checked={rules.serverRecovered} onChange={(value) => toggle('serverRecovered', value)} />
        <Rule label="New friend requests" checked={rules.friendRequests} onChange={(value) => toggle('friendRequests', value)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Rules are evaluated whenever server status or the friends list refreshes.
      </p>
    </Panel>
  )
}

function Rule({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-xs">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function latencyLabel(ms: number) {
  if (ms < 100) return 'Excellent'
  if (ms < 250) return 'Good'
  if (ms < 500) return 'Slow'
  return 'Very slow'
}
