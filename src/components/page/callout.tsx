import type { ReactNode } from 'react'

import { AlertTriangle, CircleCheck, Info, OctagonAlert } from 'lucide-react'

import { cn } from '../../lib/utils'

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger'

const tones: Record<
  CalloutTone,
  { chip: string; icon: typeof Info; shell: string; title: string }
> = {
  info: {
    chip: 'bg-primary/15 text-primary ring-primary/25',
    icon: Info,
    shell: 'border-primary/25 bg-primary/[0.06]',
    title: 'text-foreground',
  },
  success: {
    chip: 'bg-success/15 text-success ring-success/25',
    icon: CircleCheck,
    shell: 'border-success/25 bg-success/[0.06]',
    title: 'text-foreground',
  },
  warning: {
    chip: 'bg-warning/15 text-warning ring-warning/25',
    icon: AlertTriangle,
    shell: 'border-warning/30 bg-warning/[0.07]',
    title: 'text-foreground',
  },
  danger: {
    chip: 'bg-destructive/15 text-destructive ring-destructive/25',
    icon: OctagonAlert,
    shell: 'border-destructive/30 bg-destructive/[0.07]',
    title: 'text-foreground',
  },
}

/**
 * Inline notice.
 *
 * The old `Alert` was a square-cornered block with a 4px left bar, which read
 * as a validation error whatever it actually said. This is a tinted card with
 * the icon in its own chip, so tone comes from colour and the shape stays
 * consistent with everything else on the page.
 */
export function Callout({
  children,
  className,
  title,
  tone = 'info',
}: {
  children?: ReactNode
  className?: string
  title?: ReactNode
  tone?: CalloutTone
}) {
  const { chip, icon: Icon, shell, title: titleClass } = tones[tone]

  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border px-4 py-3.5 text-[0.8125rem] leading-relaxed',
        shell,
        className
      )}
    >
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset',
          chip
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {title && (
          <p className={cn('font-semibold', titleClass)}>{title}</p>
        )}
        {children && (
          <div className="text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
