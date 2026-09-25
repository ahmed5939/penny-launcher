import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import cannyValleyArt from '../../../assets/images/zones/canny-valley.webp'
import plankertonArt from '../../../assets/images/zones/plankerton.webp'
import stonewoodArt from '../../../assets/images/zones/stonewood.webp'
import twinePeaksArt from '../../../assets/images/zones/twine-peaks.webp'

/** The game's own zone key art, for Home's launcher banner. */
export const zoneArt = {
  stonewood: stonewoodArt,
  plankerton: plankertonArt,
  'canny-valley': cannyValleyArt,
  'twine-peaks': twinePeaksArt,
} as const

export type ZoneArt = keyof typeof zoneArt

/**
 * The title row every tool page opens with.
 *
 * Compact on purpose. A full-bleed art banner on every page spent a third
 * of a short window on a dark smear before any content; a game client's
 * inner pages open on their content, with the title, status and actions on
 * one line and a single line of description under it. Key art is kept for
 * Home, where it is the point.
 *
 * `icon`, `section` and `art` are accepted for the call sites that pass
 * them; the nav already shows the icon and section.
 */
export function PageHeader({
  actions,
  description,
  status,
  title,
}: {
  /** Buttons or controls that act on the page as a whole. */
  actions?: ReactNode
  art?: ZoneArt
  description?: ReactNode
  icon?: LucideIcon
  section?: string
  /** Live badge — a running service, a connection state. */
  status?: ReactNode
  title: ReactNode
}) {
  return (
    <header className="flex select-none flex-wrap items-center gap-x-6 gap-y-2 pb-1">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-display-sm font-bold leading-tight tracking-tight">
            {title}
          </h1>
          {status}
        </div>
        {description && (
          <p className="mt-1 line-clamp-2 max-w-3xl text-ui leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
