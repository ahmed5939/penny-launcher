import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * The masthead every tool page opens with.
 *
 * Replaces the breadcrumb trail the app used to carry. A trail was doing two
 * jobs badly: it named the page in 11px grey type, and it offered a way back
 * that the section bar already provides. This says what the page is at a size
 * you can read, and gives the page somewhere to hang its controls.
 */
export function PageHeader({
  actions,
  description,
  icon: Icon,
  section,
  status,
  title,
}: {
  /** Buttons or controls that act on the page as a whole. */
  actions?: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  /** Group this tool belongs to, e.g. "STW Operations". */
  section?: string
  /** Live badge — a running service, a connection state. */
  status?: ReactNode
  title: ReactNode
}) {
  return (
    <header className="relative -mx-1 mb-1 select-none">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {Icon && (
          <span
            className={cn(
              'relative mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl',
              'border border-primary/25 bg-gradient-to-br from-primary/25 to-brand-to/10',
              'text-primary shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.06)]'
            )}
          >
            <Icon className="size-5" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          {section && (
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {section}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-[1.375rem]">
              {title}
            </h1>
            {status}
          </div>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Hairline that fades out rather than cutting the full width. */}
      <div className="mt-5 h-px bg-gradient-to-r from-border via-border/60 to-transparent" />
    </header>
  )
}
