import { Activity, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { Switch } from '../../components/ui/switch'
import {
  Callout,
  Chip,
  EmptyState,
  PageHeader,
  Panel,
  PanelFooter,
  PanelHeader,
  RefreshButton,
  Segmented,
  StatusDot,
  StatusPill,
  ToolBadges,
  type StatusTone,
} from '../../components/page'

import { useServerStatusStore } from '../../state/advanced-mode/server-status'
import { useNotificationRulesStore } from '../../state/settings/notification-rules'

import {
  affectedSummary,
  formatDuration,
  fortniteServices,
  fortniteVerdict,
  incidentWindowDays,
  isFortniteIncident,
  otherServiceGroups,
  statusLabels,
  statusTones,
  worstStatus,
  type EpicIncident,
  type EpicServiceGroup,
  type ServerStatusPayload,
  type ServiceStatus,
  type Verdict,
} from './model'
import { recheckMinutes, requestServerStatus } from './sync'

import { cn } from '../../lib/utils'

dayjs.extend(relativeTime)

/**
 * Is Fortnite up, first and in one line; then what backs that answer —
 * Fortnite's own services, what Epic has said about recent trouble, and the
 * rest of Epic folded into one row per product.
 */
export function ServerStatusPage() {
  const { t } = useTranslation(['sidebar'])
  const { checkedAt, isLoading, status } = useServerStatusStore(
    useShallow((state) => ({
      checkedAt: state.checkedAt,
      isLoading: state.isLoading,
      status: state.status,
    }))
  )

  // The shell's sync checks on open and keeps checking while this is mounted.
  useEffect(() => useServerStatusStore.getState().watch(), [])

  return (
    <>
      <PageHeader
        icon={Activity}
        section={t('advanced-mode.title')}
        title={t('advanced-mode.options.server-status')}
        status={<ToolBadges beta />}
        description="Is Fortnite up, and is anything at Epic getting in the way."
        actions={
          <RefreshButton
            loading={isLoading}
            onClick={requestServerStatus}
          />
        }
      />

      {status && status.errors.length > 0 && (
        <Callout tone="warning">
          {status.errors.join(' ')} What's below is from the parts that
          answered.
        </Callout>
      )}

      <FortnitePanel
        checkedAt={checkedAt}
        status={status}
      />

      {status?.statusPage && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <IncidentsPanel incidents={status.statusPage.incidents} />
          <OtherServicesPanel
            groups={otherServiceGroups(status.statusPage)}
          />
        </div>
      )}
    </>
  )
}

const checking: Verdict = {
  detail: 'Asking Epic whether the game is up.',
  title: 'Checking Fortnite…',
  tone: 'idle',
}

const headlineText: Record<StatusTone, string> = {
  active: 'text-foreground',
  danger: 'text-destructive',
  idle: 'text-foreground',
  warning: 'text-warning',
}

function FortnitePanel({
  checkedAt,
  status,
}: {
  checkedAt: number | null
  status: ServerStatusPayload | null
}) {
  const verdict = status ? fortniteVerdict(status) : checking
  const services = status?.statusPage ? fortniteServices(status.statusPage) : []
  const maintenanceUri =
    status?.fortnite.status === 'DOWN' ? status.fortnite.maintenanceUri : null

  return (
    <Panel>
      <div className="px-5 py-5">
        <p
          className={cn(
            'flex items-center gap-3 text-display-sm font-semibold leading-tight',
            headlineText[verdict.tone]
          )}
          role="status"
        >
          <StatusDot
            className="size-2.5"
            pulse={verdict.tone === 'active'}
            tone={verdict.tone}
          />
          {verdict.title}
        </p>
        <p className="mt-1.5 text-ui text-muted-foreground">
          {verdict.detail}
          {maintenanceUri && (
            <>
              {' '}
              <a
                className="text-primary underline-offset-4 hover:underline"
                href={maintenanceUri}
                rel="noreferrer"
                target="_blank"
              >
                Maintenance details
              </a>
            </>
          )}
        </p>
      </div>

      {services.length > 0 && (
        <ul className="grid gap-x-10 border-t border-border/30 px-5 py-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {services.map((service) => (
            <ServiceLine
              key={service.id}
              name={service.label}
              status={service.status}
            />
          ))}
        </ul>
      )}

      <PanelFooter className="gap-x-6 py-2.5">
        <span className="text-xs text-muted-foreground">
          {checkedAt
            ? `Checked ${dayjs(checkedAt).format('LT')} · again every ${recheckMinutes} minutes`
            : 'Not checked yet'}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-2">
          <AlertToggle
            label="Alert me when it goes down"
            rule="serverDown"
          />
          <AlertToggle
            label="Alert me when it's back"
            rule="serverRecovered"
          />
        </span>
      </PanelFooter>
    </Panel>
  )
}

function AlertToggle({
  label,
  rule,
}: {
  label: string
  rule: 'serverDown' | 'serverRecovered'
}) {
  const checked = useNotificationRulesStore((state) => state.rules[rule])
  const setRule = useNotificationRulesStore((state) => state.setRule)

  return (
    <label className="flex items-center gap-2.5 text-xs text-muted-foreground">
      {label}
      <Switch
        checked={checked}
        className="h-5 w-9 [&>span]:size-4 [&>span]:data-[state=checked]:translate-x-4"
        onCheckedChange={(value) => setRule(rule, value)}
      />
    </label>
  )
}

/**
 * One service: a dot and its name, and a word only when something is wrong —
 * thirty "Operational"s say less than one "Degraded".
 */
function ServiceLine({
  name,
  status,
}: {
  name: string
  status: ServiceStatus
}) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <StatusLabel status={status} />
      <span
        className="min-w-0 flex-1 truncate text-ui text-foreground/90"
        title={name}
      >
        {name}
      </span>
      <StatusWord status={status} />
    </li>
  )
}

function StatusLabel({ status }: { status: ServiceStatus }) {
  return (
    <span className="contents">
      <StatusDot tone={statusTones[status]} />
      <span className="sr-only">{statusLabels[status]}</span>
    </span>
  )
}

function StatusWord({ status }: { status: ServiceStatus }) {
  if (status === 'operational') return null

  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 text-xs font-medium',
        statusTones[status] === 'danger'
          ? 'text-destructive'
          : statusTones[status] === 'warning'
            ? 'text-warning'
            : 'text-muted-foreground'
      )}
    >
      {statusLabels[status]}
    </span>
  )
}

/* ── Incidents ──────────────────────────────────────────────────────────── */

type IncidentScope = 'fortnite' | 'epic'

function IncidentsPanel({ incidents }: { incidents: Array<EpicIncident> }) {
  const [scope, setScope] = useState<IncidentScope>('fortnite')
  const shown =
    scope === 'fortnite' ? incidents.filter(isFortniteIncident) : incidents

  return (
    <Panel>
      <PanelHeader
        actions={
          <Segmented
            onChange={setScope}
            options={[
              { label: 'Fortnite', value: 'fortnite' },
              { label: 'All of Epic', value: 'epic' },
            ]}
            value={scope}
          />
        }
        className="h-12 py-0"
        compact
        title="Incidents"
      />

      {shown.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-8"
          title={
            scope === 'fortnite'
              ? `No Fortnite incidents in the last ${incidentWindowDays} days`
              : `No incidents in the last ${incidentWindowDays} days`
          }
        />
      ) : (
        <ul className="divide-y divide-border/40 px-5">
          {shown.map((incident) => (
            <IncidentRow
              incident={incident}
              key={incident.id}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}

const impactChips: Record<string, { label: string; tone: 'danger' | 'warning' }> = {
  critical: { label: 'Critical', tone: 'danger' },
  major: { label: 'Major', tone: 'danger' },
  minor: { label: 'Minor', tone: 'warning' },
}

function IncidentRow({ incident }: { incident: EpicIncident }) {
  const ongoing = incident.resolvedAt === null
  // Ongoing incidents open with their latest update showing.
  const [open, setOpen] = useState(ongoing)
  const impact = impactChips[incident.impact]
  const started = Date.parse(incident.createdAt)
  const duration = formatDuration(
    (ongoing ? Date.now() : Date.parse(incident.resolvedAt!)) - started
  )
  const affected = affectedSummary(incident)

  return (
    <li>
      <button
        aria-expanded={open}
        className="flex w-full items-start gap-3 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ChevronDown
          className={cn(
            'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90'
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-ui font-medium text-foreground/90">
            {incident.name}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {ongoing
              ? `Started ${dayjs(started).fromNow()}`
              : `${dayjs(started).format('MMM D')} · lasted ${duration}`}
            {affected && ` · ${affected}`}
          </span>
        </span>
        {ongoing ? (
          <StatusPill
            pulse
            tone="warning"
          >
            Ongoing
          </StatusPill>
        ) : (
          impact && <Chip tone={impact.tone}>{impact.label}</Chip>
        )}
      </button>

      {open && (
        <div className="mb-3 ml-2 space-y-3 border-l border-border/50 pl-5">
          {incident.updates.map((update) => (
            <div key={update.id}>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {sentenceCase(update.status) || 'Update'}
                </span>
                {' · '}
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
              rel="noreferrer"
              target="_blank"
            >
              Open on status.epicgames.com
            </a>
          )}
        </div>
      )}
    </li>
  )
}

/* ── The rest of Epic ───────────────────────────────────────────────────── */

function OtherServicesPanel({ groups }: { groups: Array<EpicServiceGroup> }) {
  const services = groups.flatMap((group) => group.services)
  const issues = services.filter((service) => service.status !== 'operational')

  return (
    <Panel>
      <PanelHeader
        actions={
          <span
            className={cn(
              'text-xs',
              issues.length > 0 ? 'text-warning' : 'text-muted-foreground'
            )}
          >
            {issues.length === 0
              ? 'All running normally'
              : `${issues.length} of ${services.length} with issues`}
          </span>
        }
        className="h-12 py-0"
        compact
        title="Other Epic services"
      />
      <ul className="divide-y divide-border/40 px-5">
        {groups.map((group) => (
          <GroupRow
            group={group}
            key={group.id}
          />
        ))}
      </ul>
    </Panel>
  )
}

/**
 * A product folded to one line. One with trouble opens by itself, showing
 * only the services in trouble; opening it by hand shows them all.
 */
function GroupRow({ group }: { group: EpicServiceGroup }) {
  const worst = worstStatus(group.services)
  const trouble = group.services.filter(
    (service) => service.status !== 'operational'
  )
  const [toggled, setToggled] = useState<boolean | null>(null)
  const [showAll, setShowAll] = useState(false)
  const open = toggled ?? trouble.length > 0
  const listed = toggled || showAll ? group.services : trouble
  const hidden = group.services.length - listed.length

  return (
    <li>
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-2.5 text-left"
        onClick={() => setToggled(!open)}
        type="button"
      >
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90'
          )}
        />
        <StatusLabel status={worst} />
        <span className="min-w-0 flex-1 truncate text-ui font-medium text-foreground/90">
          {group.name}
        </span>
        <StatusWord status={worst} />
      </button>

      {open && (
        <ul className="pb-2 pl-11">
          {listed.map((service) => (
            <ServiceLine
              key={service.id}
              name={service.name}
              status={service.status}
            />
          ))}
          {hidden > 0 && (
            <li>
              <button
                className="py-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAll(true)}
                type="button"
              >
                {hidden} more running normally
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
