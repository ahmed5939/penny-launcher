import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * A named thing with a number beside it.
 *
 * `RewardLine` in the missions UI is this shape with rewards hard-coded into
 * it; four other screens wanted the same row for expeditions, currencies,
 * inventory stacks and history entries, and wrote it out again each time.
 *
 * Stacked in a `<ul>` the figures form a rail down the right edge, so a
 * ranking becomes a shape you can see rather than six numbers you have to
 * read. Renders an `<li>`, so it always needs a list around it.
 */
export function ListRow({
  caption,
  className,
  figure,
  name,
  well,
}: {
  /** The greyscale second line — a type, a platform, a duration. */
  caption?: ReactNode
  className?: string
  /** The number this row is ranked by. Already formatted for the locale. */
  figure?: ReactNode
  name: ReactNode
  /** An `IconWell`, a `RewardWell`, or an image. */
  well?: ReactNode
}) {
  return (
    <li className={cn('flex items-center gap-3 py-2', className)}>
      {well}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium leading-tight text-foreground/90">
          {name}
        </span>
        {caption && (
          <span className="mt-0.5 block truncate text-xs leading-tight text-muted-foreground">
            {caption}
          </span>
        )}
      </span>

      {figure !== undefined && figure !== null && (
        <span className="figure shrink-0 text-sm font-bold text-foreground/90">
          {figure}
        </span>
      )}
    </li>
  )
}
