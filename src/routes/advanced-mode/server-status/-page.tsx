import { UpdateIcon } from '@radix-ui/react-icons'
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
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
        title={
          <span className="flex items-center gap-2">
            {t('advanced-mode.options.server-status')}
            <BetaBadge />
          </span>
        }
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

      {entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={isLoading ? 'Checking services…' : 'No status yet'}
          description="Epic's status service has not answered yet."
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
    </>
  )
}
