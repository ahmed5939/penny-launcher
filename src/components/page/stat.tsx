import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { IconWell } from './icon-well'

import { cn } from '../../lib/utils'

export type StatusTone = 'idle' | 'active' | 'warning' | 'danger'

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
    <div className={cn('panel flex items-start gap-3 px-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        <p className="micro-label">{label}</p>
        <p
          className={cn(
            'figure mt-1.5 text-xl font-bold leading-none',
            toneClass
          )}
        >
          {value}
        </p>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>

      {/*
        Trailing, not inline with the label: a 12px glyph on the label line was
        competing with the caption it sat next to, and the tiles in a row lost
        the shared left edge their labels are supposed to share.
      */}
      {Icon && (
        <IconWell
          icon={Icon}
          size="sm"
        />
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

const statusTones: Record<StatusTone, { dot: string; shell: string }> = {
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
}

/**
 * The dot on its own.
 *
 * Extracted because four files had already re-derived it: two byte-identical
 * `statusDotClass` helpers, a tri-state longhand in the status bar and a
 * two-state one in the account rail. Where the word beside the dot is already
 * on screen — a row's own name, a column heading — the pill is redundant and
 * this is the whole control.
 */
export function StatusDot({
  className,
  pulse,
  tone = 'idle',
}: {
  className?: string
  /** Animate the dot, for genuinely-live states only. */
  pulse?: boolean
  tone?: StatusTone
}) {
  const { dot } = statusTones[tone]

  return (
    <span className={cn('relative flex size-1.5 shrink-0', className)}>
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
  )
}

/**
 * Small live-state badge for the page header — "Running", "Stopped".
 *
 * `variant="dot"` drops the shell and the word, for the case where a row's own
 * label already says which thing is running; the word still ships to assistive
 * tech, so the state is never colour-only.
 */
export function StatusPill({
  children,
  className,
  pulse,
  tone = 'idle',
  variant = 'pill',
}: {
  children: ReactNode
  className?: string
  /** Animate the dot, for genuinely-live states only. */
  pulse?: boolean
  tone?: StatusTone
  variant?: 'pill' | 'dot'
}) {
  const { shell } = statusTones[tone]

  if (variant === 'dot') {
    return (
      <span className={cn('inline-flex items-center', className)}>
        <StatusDot
          pulse={pulse}
          tone={tone}
        />
        <span className="sr-only">{children}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'micro-label',
        shell,
        className
      )}
    >
      <StatusDot
        pulse={pulse}
        tone={tone}
      />
      {children}
    </span>
  )
}

/**
 * The key to a column of dots.
 *
 * A grid of coloured dots is unreadable without one, and the screens that grew
 * a dot column — automation, taxi service — each explained their colours in
 * prose above the table instead. One row of dot-and-word does it in a line.
 */
export function StatusLegend({
  className,
  items,
}: {
  className?: string
  items: Array<{ label: ReactNode; tone: StatusTone }>
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {items.map((item, index) => (
        <li
          className="flex items-center gap-1.5 micro-label"
          key={index}
        >
          <StatusDot tone={item.tone} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
