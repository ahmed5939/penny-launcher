import { UpdateIcon } from '@radix-ui/react-icons'
import { Activity, Bell, Gauge, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import { Button } from '../../../components/ui/button'
import { Switch } from '../../../components/ui/switch'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  StatusPill,
} from '../../../components/page'

import { useServerStatusData } from './-hooks'

const serviceLabels: Record<string, string> = {
  Fortnite: 'Fortnite',
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  const {
    diagnostics,
    entries,
    errorMessage,
    handleCheck,
    isDown,
    isLoading,
    isUnknown,
    lastCheckedAt,
  } = useServerStatusData()

  return (
    <>
      <PageHeader
        icon={Activity}
        section={t('advanced-mode.title')}
        title={t('advanced-mode.options.server-status')}
        description="Live availability of the Epic Games services this launcher depends on."
        status={
          isUnknown ? (
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

      {errorMessage && (
        <Callout
          title="Status unavailable"
          tone="warning"
        >
          {errorMessage}
        </Callout>
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

      {entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={isLoading ? 'Checking services…' : errorMessage ? 'Could not reach Epic' : 'No status yet'}
          description={
            errorMessage
              ? errorMessage
              : 'Press Check again to ask Epic whether Fortnite is up.'
          }
        />
      ) : (
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
                    {entry.serviceId}
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

      {lastCheckedAt && (
        <p className="text-xs text-muted-foreground">
          Last checked {dayjs(lastCheckedAt).format('LT')}
        </p>
      )}

      <NotificationRules />
    </>
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
