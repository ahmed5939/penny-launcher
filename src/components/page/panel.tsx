import type { LucideIcon } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * The page-level content container.
 *
 * Deliberately not the shadcn `Card`: no heavy border, no centred column, and
 * the footer is a tinted strip rather than more of the same surface. Panels
 * are meant to sit side by side in a grid, which is the main thing the old
 * single-column card stack could not do.
 */
export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn('panel overflow-hidden', className)}
      {...props}
    />
  )
}

export function PanelHeader({
  actions,
  className,
  description,
  icon: Icon,
  title,
}: {
  actions?: ReactNode
  className?: string
  description?: ReactNode
  icon?: LucideIcon
  title: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b border-border/60 px-5 py-4',
        className
      )}
    >
      {Icon && (
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold leading-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}

export function PanelBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-5 py-4', className)}
      {...props}
    />
  )
}

/**
 * Action strip. Sits on a darker surface so the buttons read as the panel's
 * conclusion instead of one more row of content.
 */
export function PanelFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-border/60 bg-surface/60 px-5 py-3.5',
        className
      )}
      {...props}
    />
  )
}
