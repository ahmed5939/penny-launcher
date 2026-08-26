import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * A divider inside a panel that says what the rows under it are.
 *
 * `PanelHeader` names the panel; this names a section within it, so it takes
 * the section rank in words rather than a second `<h2>` at body size. Sits at
 * the panel's own gutter with no top border — the strip it opens is the thing
 * below it, not a card of its own.
 */
export function PanelSectionHeader({
  actions,
  className,
  title,
}: {
  actions?: ReactNode
  className?: string
  title: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5',
        className
      )}
    >
      <h3 className="section-label">{title}</h3>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
