import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { IconWell } from './icon-well'

import { cn } from '../../lib/utils'

/**
 * What a tool shows before you have given it anything to work on.
 *
 * Previously these screens rendered an empty card, or nothing at all, which
 * left you unsure whether the page had loaded or you had done something
 * wrong. A dashed panel reads as "waiting for input" rather than "broken".
 */
export function EmptyState({
  action,
  className,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  className?: string
  description?: ReactNode
  icon?: LucideIcon
  title: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl',
        'border border-dashed border-border/70 bg-card/30 px-6 py-12 text-center',
        className
      )}
    >
      {Icon && (
        <IconWell
          icon={Icon}
          size="lg"
        />
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-[0.8125rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
