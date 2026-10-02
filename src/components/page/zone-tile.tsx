import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * One zone in a row of four — its key art, a progress figure and one pip
 * per step — as a button that picks the zone for the detail under the row.
 * Lay them out in `grid gap-px bg-border/30 sm:grid-cols-2 xl:grid-cols-4`
 * so the hairlines between them come from the gap.
 */
export function ZoneTile({
  art,
  caption,
  name,
  onSelect,
  pips,
  selected,
  total,
  value,
}: {
  /** Zone key art, from `zoneArt`. */
  art: string
  /** One short line under the pips. */
  caption?: ReactNode
  name: string
  onSelect: () => void
  /** One per step, in order; `title` is the pip's tooltip. */
  pips: Array<{ done: boolean; title: string }>
  selected: boolean
  total: number
  value: number
}) {
  const complete = value >= total

  return (
    <button
      aria-pressed={selected}
      className={cn('group relative flex flex-col bg-card text-left transition-colors hover:bg-muted/40', selected && 'bg-primary/[0.06]')}
      onClick={onSelect}
      type="button"
    >
      <span className="relative block h-20 overflow-hidden">
        <img alt="" className="size-full object-cover opacity-80 transition-opacity group-hover:opacity-100" src={art} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <span className="absolute inset-x-4 bottom-2 flex items-end justify-between gap-2">
          <span className="text-title font-bold leading-tight">{name}</span>
          <span className={cn('figure text-xl font-bold leading-none', complete ? 'text-success' : 'text-foreground')}>
            {value}
            <span className="text-xs text-muted-foreground">/{total}</span>
          </span>
        </span>
      </span>
      <span className="block space-y-2 px-4 pb-3.5 pt-2">
        <ol aria-label={`${name} progress`} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${pips.length}, minmax(0, 1fr))` }}>
          {pips.map((pip, index) => (
            <li className={cn('h-1.5 rounded-full', pip.done ? (complete ? 'bg-success' : 'bg-primary') : 'bg-muted')} key={index} title={pip.title} />
          ))}
        </ol>
        {caption && <span className="block truncate text-xs text-muted-foreground">{caption}</span>}
      </span>
      {selected && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
    </button>
  )
}
