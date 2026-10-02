import type { ReactNode } from 'react'

import { ChevronRight } from 'lucide-react'

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
 *
 * With `onClick` the row is a button that opens the thing's detail: it
 * takes focus and Enter, lights on hover, and ends in a chevron.
 */
export function ListRow({
  caption,
  className,
  figure,
  name,
  onClick,
  well,
}: {
  /** The greyscale second line — a type, a platform, a duration. */
  caption?: ReactNode
  className?: string
  /** The number this row is ranked by. Already formatted for the locale. */
  figure?: ReactNode
  name: ReactNode
  /** Makes the row a button, for rows that open something. */
  onClick?: () => void
  /** An `IconWell`, a `RewardWell`, or an image. */
  well?: ReactNode
}) {
  const content = (
    <>
      {well}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui font-medium leading-tight text-foreground/90">
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
    </>
  )

  if (!onClick) {
    return <li className={cn('flex items-center gap-3 py-2', className)}>{content}</li>
  }

  return (
    <li className={className}>
      <button
        className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:outline-none"
        type="button"
        onClick={onClick}
      >
        {content}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </button>
    </li>
  )
}
