import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

export type IconWellSize = 'sm' | 'md' | 'lg'
export type IconWellTone = 'neutral' | 'accent'

/**
 * The tinted square an icon sits in.
 *
 * Ten-plus screens drew their own, and no two agreed: gradient chips, tinted
 * fills with no ring, `rounded-full` circles, a fake inset top-highlight. Two
 * tones and three sizes is the whole vocabulary — neutral for an icon that
 * only labels a row, accent for one that marks the subject of the page.
 *
 * `lg` takes the surface radius rather than the control radius: at 44px a 4px
 * corner reads as a square that failed to round.
 */
export function IconWell({
  children,
  className,
  icon: Icon,
  size = 'md',
  tone = 'neutral',
}: {
  /** An image or glyph, when the thing to show is not a Lucide icon. */
  children?: ReactNode
  className?: string
  icon?: LucideIcon
  size?: IconWellSize
  tone?: IconWellTone
}) {
  const box = {
    sm: 'size-7 rounded-lg',
    md: 'size-9 rounded-lg',
    lg: 'size-11 rounded-xl',
  }[size]
  const glyph = {
    sm: 'size-3.5',
    md: 'size-[1.125rem]',
    lg: 'size-5',
  }[size]

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center ring-1 ring-inset',
        box,
        tone === 'accent'
          ? 'bg-primary/10 text-primary ring-primary/20'
          : 'bg-muted/40 text-muted-foreground ring-border/60',
        className
      )}
    >
      {Icon ? <Icon className={glyph} /> : children}
    </span>
  )
}
