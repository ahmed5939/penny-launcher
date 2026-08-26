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

/**
 * The panel's title strip.
 *
 * `compact` is the strip nine screens wrote out by hand rather than use this
 * one: a single line at the body gutter, wrapping instead of reserving room
 * for a description that is never there.
 *
 * `as` picks the element the title renders as. An `<h2>` takes the Display
 * optical size and negative tracking from the base layer, which is right for a
 * panel that names a section of the page and wrong for one whose title is a
 * piece of data — an account name, a squad label — that should read as body
 * text at the same weight.
 */
export function PanelHeader({
  actions,
  as = 'h2',
  className,
  compact = false,
  description,
  icon: Icon,
  title,
}: {
  actions?: ReactNode
  as?: 'h2' | 'div'
  className?: string
  /** One line at the body gutter, for a strip that only carries a title. */
  compact?: boolean
  description?: ReactNode
  icon?: LucideIcon
  title: ReactNode
}) {
  /*
   * Branched rather than a dynamic `<Title>` tag: TypeScript resolves a union
   * of intrinsic element names to a union of prop types, and what compiles
   * there has moved between releases. Two literal elements never will.
   */
  const titleClassName = cn(
    'font-semibold leading-tight',
    compact ? 'min-w-0 truncate text-[0.8125rem]' : 'text-sm'
  )
  const titleNode =
    as === 'div' ? (
      <div className={titleClassName}>{title}</div>
    ) : (
      <h2 className={titleClassName}>{title}</h2>
    )

  return (
    <header
      className={cn(
        'border-b border-border/60',
        compact
          ? 'flex flex-wrap items-center gap-2 px-4 py-3'
          : 'flex items-start gap-3 px-5 py-4',
        className
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'size-4 shrink-0 text-muted-foreground',
            !compact && 'mt-0.5'
          )}
        />
      )}

      {/*
        A compact strip with nothing under its title puts the title straight
        into the flex row, so a chip passed alongside it wraps with it — which
        is what the nine hand-rolled versions of this strip were doing.
      */}
      {compact && !description ? (
        titleNode
      ) : (
        <div className={cn('min-w-0', compact ? 'shrink' : 'flex-1')}>
          {titleNode}
          {description && (
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}

      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </header>
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
