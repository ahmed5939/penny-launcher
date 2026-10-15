import type { ReactNode } from 'react'

import { AlertTriangle, CircleCheck, Info, OctagonAlert } from 'lucide-react'

import { cn } from '../../lib/utils'

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger'

const tones: Record<
  CalloutTone,
  { icon: typeof Info; iconClass: string; shell: string; title: string }
> = {
  info: {
    icon: Info,
    iconClass: 'text-primary',
    shell: 'bg-primary/[0.08]',
    title: 'text-foreground',
  },
  success: {
    icon: CircleCheck,
    iconClass: 'text-success',
    shell: 'bg-success/[0.08]',
    title: 'text-foreground',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-warning',
    shell: 'bg-warning/[0.09]',
    title: 'text-foreground',
  },
  danger: {
    icon: OctagonAlert,
    iconClass: 'text-destructive',
    shell: 'bg-destructive/[0.09]',
    title: 'text-foreground',
  },
}

/**
 * Inline notice.
 *
 * A tinted fill one step off the page, with the icon standing on its own, so
 * tone comes from colour. Pass `role="alert"` when the notice appears after an
 * action, so a screen reader announces it.
 */
export function Callout({
  children,
  className,
  role,
  title,
  tone = 'info',
}: {
  children?: ReactNode
  className?: string
  role?: 'alert' | 'status'
  title?: ReactNode
  tone?: CalloutTone
}) {
  const { icon: Icon, iconClass, shell, title: titleClass } = tones[tone]

  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl px-4 py-3.5 text-ui leading-relaxed',
        shell,
        className
      )}
      role={role}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', iconClass)} />
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
