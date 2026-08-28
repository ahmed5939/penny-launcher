import type { PlayService, PlayServiceStatus } from './-hooks'

import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useAutomationServices } from './-hooks'

import { cn } from '../../lib/utils'

/**
 * Glanceable automation status.
 *
 * Every chip reports real state: green only when a service is actually
 * listening, amber when an account disconnected or errored, and a plain
 * count when accounts are attached but nothing is running. Nothing here
 * shows a status it cannot back up.
 */
export function AutomationChips() {
  const { t } = useTranslation(['general', 'sidebar'])
  const { services } = useAutomationServices()

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
        {t('home.services.title')}
      </span>

      {services.map((service) => (
        <ServiceChip
          key={service.key}
          service={service}
        />
      ))}
    </div>
  )
}

const statusStyles: Record<PlayServiceStatus, string> = {
  running: 'border-success/40 bg-success/10 text-success',
  issue: 'border-warning/40 bg-warning/10 text-warning',
  configured: 'border-primary/30 bg-primary/10 text-primary',
  off: 'border-border/70 bg-card/50 text-muted-foreground hover:bg-accent/50 hover:text-foreground',
}

const labels: Record<PlayService['key'], string> = {
  'auto-kick': 'sidebar:stw-operations.options.auto-kick',
  'taxi-service': 'sidebar:stw-operations.options.taxi-service',
  'auto-llamas': 'sidebar:stw-operations.options.auto-llamas',
}

function ServiceChip({ service }: { service: PlayService }) {
  const { t } = useTranslation(['general', 'sidebar'])

  const isLive = service.status === 'running'

  return (
    <Link
      to={service.to}
      title={t(`home.services.${service.status}`)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-xs font-medium transition-colors',
        statusStyles[service.status]
      )}
    >
      <span className="relative flex size-1.5 shrink-0">
        {isLive && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />
        )}
        <span
          className={cn(
            'relative inline-flex size-full rounded-full',
            service.status === 'off'
              ? 'bg-muted-foreground/40'
              : 'bg-current'
          )}
        />
      </span>

      {t(labels[service.key])}

      {service.accounts > 0 && (
        <span className="tabular-nums opacity-70">
          {service.accounts}
        </span>
      )}
    </Link>
  )
}
