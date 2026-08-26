import type { LucideIcon } from 'lucide-react'

import { Plus } from 'lucide-react'

import { cn } from '../../lib/utils'

export type EmptySlotSize = 'sm' | 'lg'

/**
 * A hole in a grid you can fill — an unassigned squad seat, a free loadout
 * slot.
 *
 * Loadouts and Squads carried byte-identical copies of this. Dashed, not
 * solid: a solid border would make an empty slot look like an item that had
 * failed to load, where a dashed one reads as a space kept open for you.
 *
 * The label is a caption, and at these sizes it is the only text in the box,
 * so it takes the caption rank rather than a fourth ten-pixel recipe.
 */
export function EmptySlot({
  className,
  icon: Icon = Plus,
  label,
  onClick,
  size = 'sm',
}: {
  className?: string
  /**
   * Beyond the spec's signature: Squads marks its lead seat with a crown, and
   * without this the second of the two copies could not be absorbed.
   */
  icon?: LucideIcon
  label?: string
  onClick?: () => void
  size?: EmptySlotSize
}) {
  return (
    <button
      className={cn(
        'grid shrink-0 place-items-center gap-1 rounded-lg border-2 border-dashed',
        'border-border/60 text-muted-foreground transition-colors',
        'hover:border-primary/50 hover:text-primary',
        size === 'lg' ? 'size-32' : 'size-16',
        className
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      {label && <span className="micro-label">{label}</span>}
    </button>
  )
}
