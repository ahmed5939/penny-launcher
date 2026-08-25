import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * A single number with its label. Put several in a `StatRow` to get the
 * summary strip most of these tools were missing.
 */
export function StatTile({
  className,
  hint,
  icon: Icon,
  label,
  tone = 'default',
  value,
}: {
  className?: string
  hint?: ReactNode
  icon?: LucideIcon
  label: ReactNode
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  value: ReactNode
}) {
  const toneClass = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
  }[tone]

  return (
    <div className={cn('panel px-4 py-3', className)}>
      <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {Icon && <Icon className="size-3" />}
        {label}
      </div>
      <p
        className={cn(
          'mt-1.5 text-xl font-bold leading-none tabular-nums',
          toneClass
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export function StatRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Small live-state badge for the page header — "Running", "Stopped".
 */
export function StatusPill({
  children,
  pulse,
  tone = 'idle',
}: {
  children: ReactNode
  /** Animate the dot, for genuinely-live states only. */
  pulse?: boolean
  tone?: 'idle' | 'active' | 'warning' | 'danger'
}) {
  const { dot, shell } = {
    idle: {
      dot: 'bg-muted-foreground',
      shell: 'border-border/70 text-muted-foreground',
    },
    active: { dot: 'bg-success', shell: 'border-success/40 text-success' },
    warning: { dot: 'bg-warning', shell: 'border-warning/40 text-warning' },
    danger: {
      dot: 'bg-destructive',
      shell: 'border-destructive/40 text-destructive',
    },
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-[0.6875rem] font-semibold uppercase tracking-wider',
        shell
      )}
    >
      <span className="relative flex size-1.5">
        {pulse && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-75',
              dot
            )}
          />
        )}
        <span
          className={cn('relative inline-flex size-full rounded-full', dot)}
        />
      </span>
      {children}
    </span>
  )
}
