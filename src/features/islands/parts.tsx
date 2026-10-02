import type { PickerOption } from '../../components/page'
import type { IslandCard } from './model'

import { useState } from 'react'
import { Star, TreePalm, Users } from 'lucide-react'

import { Picker } from '../../components/page'

import { formatDelta, formatPlayers, isCreatorIslandCode } from './model'
import { thresholdSteps } from './watchlist'

import { cn } from '../../lib/utils'

/**
 * What the Islands page draws more than once: an island's art, its player
 * count, the watch star and the alert picker.
 */

/** Anything a card, a watch row or the dialog knows about an island. */
export type IslandRef = Pick<IslandCard, 'code' | 'title' | 'imageUrl' | 'url'> &
  Partial<Pick<IslandCard, 'ccu' | 'ageRating' | 'delta1h' | 'heroImageUrl' | 'creator'>>

/** Landscape key art, or the page's own glyph when there is none or it fails. */
export function IslandArt({ className, src }: { className?: string; src: string | null }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span className={cn('grid size-full place-items-center bg-muted/40 text-muted-foreground/60', className)}>
        <TreePalm aria-hidden className="size-6" />
      </span>
    )
  }

  return (
    <img
      alt=""
      className={cn('size-full object-cover', className)}
      decoding="async"
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={src}
    />
  )
}

/** A count, or "—" for an island that hides it. Never 0 for unknown. */
export function PlayerFigure({ ccu, className }: { ccu: number | null | undefined; className?: string }) {
  if (ccu === null || ccu === undefined) {
    return (
      <span className={cn('figure', className)} title="This island hides its player count">
        <span aria-hidden>—</span>
        <span className="sr-only">hidden</span>
      </span>
    )
  }

  return <span className={cn('figure', className)}>{formatPlayers(ccu)}</span>
}

/** "+120" over the last hour; green only when it is up. */
export function TrendFigure({ className, value }: { className?: string; value: number }) {
  return (
    <span className={cn('figure font-semibold', value > 0 ? 'text-success' : 'text-muted-foreground', className)} title="Change over the last hour">
      {formatDelta(value)}
      <span className="sr-only"> in the last hour</span>
    </span>
  )
}

export function WatchStar({
  className,
  onToggle,
  title,
  watched,
}: {
  className?: string
  onToggle: () => void
  title: string
  watched: boolean
}) {
  const label = watched ? `Stop watching ${title}` : `Watch ${title}`

  return (
    <button
      aria-label={label}
      aria-pressed={watched}
      className={cn(
        'grid size-7 place-items-center rounded-md bg-background/80 transition-colors hover:bg-background',
        watched ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        className
      )}
      onClick={onToggle}
      title={label}
      type="button"
    >
      <Star className={cn('size-4', watched && 'fill-current')} />
    </button>
  )
}

/**
 * A card in the Discover grid: the art leads, the title and live count sit
 * under it. The card opens the island; the star is its own button beside
 * it rather than inside it, so both take focus.
 */
export function IslandTile({
  island,
  onOpen,
  onToggleWatch,
  watched,
}: {
  island: IslandCard
  onOpen: () => void
  onToggleWatch: () => void
  watched: boolean
}) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-lg bg-card/70 transition-colors hover:bg-accent/30">
      <button className="block w-full text-left" onClick={onOpen} title={island.title} type="button">
        <span className="relative block aspect-video overflow-hidden">
          <IslandArt className="transition-transform duration-200 ease-out group-hover:scale-[1.03]" src={island.imageUrl} />
          {island.ageRating && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-background/80 px-1.5 py-0.5 text-3xs font-semibold leading-none text-foreground/90">
              {island.ageRating}
            </span>
          )}
        </span>
        <span className="block px-3 pb-3 pt-2.5">
          <span className="line-clamp-2 min-h-[2lh] text-ui font-semibold leading-snug">{island.title}</span>
          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users aria-hidden className="size-3.5" />
            <PlayerFigure ccu={island.ccu} className="font-semibold text-foreground/90" />
            <span>playing</span>
            {island.delta1h !== null && island.delta1h !== 0 && <TrendFigure className="ml-auto" value={island.delta1h} />}
          </span>
        </span>
      </button>
      {isCreatorIslandCode(island.code) && (
        <WatchStar className="absolute right-1.5 top-1.5" onToggle={onToggleWatch} title={island.title} watched={watched} />
      )}
    </div>
  )
}

/**
 * When to alert. Steps rather than a free number: player counts span four
 * orders of magnitude, and a list of round figures is quicker to pick from
 * than a field to type into. A stored value off the ladder still shows.
 */
export function ThresholdPicker({
  className,
  onChange,
  threshold,
  title,
}: {
  className?: string
  onChange: (threshold: number | null) => void
  threshold: number | null
  title: string
}) {
  const steps: Array<number> = [...thresholdSteps]

  if (threshold !== null && !steps.includes(threshold)) {
    steps.push(threshold)
    steps.sort((a, b) => a - b)
  }

  const options: Array<PickerOption> = [
    { value: 'off', label: 'No alert' },
    ...steps.map((step) => ({ value: String(step), label: `Alert at ${formatPlayers(step)} players` })),
  ]

  return (
    <Picker
      className={cn('min-w-44', className)}
      label={`When to alert for ${title}`}
      onChange={(value) => onChange(value === 'off' ? null : Number(value))}
      options={options}
      value={threshold === null ? 'off' : String(threshold)}
    />
  )
}
