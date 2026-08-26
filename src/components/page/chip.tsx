import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

export type ChipTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'

/**
 * A one-word qualifier attached to something else — a tier, an attribute, a
 * platform, a state.
 *
 * Nine screens hand-rolled this at four sizes and three trackings. It is a
 * caption, so it takes the caption rank (`micro-label`) and nothing louder;
 * the tone class that follows outranks the component class's own colour
 * because utilities are a later cascade layer.
 *
 * `neutral` deliberately has no fill. A chip that carries no decision is a
 * border and grey text, and a page of those stays quiet enough that the one
 * coloured chip on it is worth looking at.
 */
export function Chip({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: ChipTone
}) {
  const toneClass = {
    neutral: 'border-border/70 text-muted-foreground',
    accent: 'border-primary/25 bg-primary/10 text-primary',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/35 bg-warning/10 text-warning',
    danger: 'border-destructive/35 bg-destructive/10 text-destructive',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1',
        'rounded-lg border px-1.5 py-0.5',
        'micro-label',
        toneClass,
        className
      )}
    >
      {children}
    </span>
  )
}
