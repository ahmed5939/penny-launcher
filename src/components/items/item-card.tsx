import type { ReactNode } from 'react'
import type { ItemRecordMap } from '../../kernel/core/item-database'

import { ImageOff, Star } from 'lucide-react'

import { itemBadge, resolveItemArt } from './item-icon'
import { artboardStyle, BadgeMark, itemBadgeMarks, rarityInk } from './artboard'

import { getItemRecord } from '../../state/items/database'

import { rarities, raritiesColor, RarityType } from '../../config/constants/resources'

import { cn } from '../../lib/utils'

/**
 * The card the Penny database site draws for an item, brought over for the
 * screens that list things by the copy rather than as a vault tile: the
 * finder, the backpack and storage, the Collection Book.
 *
 * Structure follows the site's `ItemCell`: an elevated panel with a 3px
 * rarity edge and a soft wash off it, a 2px rarity rule along the top, an
 * artboard whose gradient carries the tier behind the art, overlays in the
 * artboard corners (power bottom-right, favourite bottom-left, quantity
 * top-right), then an uppercase rarity eyebrow and the name. Colour is the
 * launcher's own rarity ladder, so a Legendary here is the same orange as a
 * Legendary in the vault.
 *
 * The vault keeps `ItemTile` — a plate is right for a hundred schematics on
 * a shelf. This is for forty copies you are reading one by one.
 */
export function ItemCard({
  badges,
  className,
  eyebrow,
  favorite,
  footer,
  level,
  name,
  onClick,
  overlay,
  personality,
  portrait,
  power,
  quantity,
  records,
  setBonus,
  subtitle,
  templateId,
  tier,
  title,
}: {
  /** Chips under the name. */
  badges?: ReactNode
  className?: string
  /** Overrides the rarity word above the name. */
  eyebrow?: ReactNode
  favorite?: boolean
  /** A hairlined strip at the bottom of the card. */
  footer?: ReactNode
  level?: number | null
  name?: string
  onClick?: () => void
  /** Anything else to draw over the artboard. */
  overlay?: ReactNode
  /** Survivors: drawn as the site's corner marks. */
  personality?: string | null
  portrait?: string | null
  power?: number | null
  quantity?: number
  records?: ItemRecordMap
  setBonus?: string | null
  subtitle?: ReactNode
  templateId: string
  tier?: number
  title?: string
}) {
  const art = resolveItemArt(templateId, records, portrait)
  const marks = itemBadgeMarks({
    personality,
    record: records ? getItemRecord(records, templateId) : null,
    setBonus,
    templateId,
  })
  /*
   * Every tier gets its colour here, Common included — the site does the
   * same. The vault's restraint ladder (nothing below Rare) is for a shelf of
   * a hundred plates; a grid of forty read-one-by-one cards can afford it.
   */
  const rarity = art.rarity as RarityType
  const isCommon = rarity === RarityType.Common
  const accent = isCommon ? null : (raritiesColor[rarity] ?? null)
  const rarityName = rarities[rarity] ?? null
  const label = name ?? art.name
  const Element = onClick ? 'button' : 'div'

  return (
    <Element
      className={cn(
        'item-card group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/70 text-left',
        'transition-colors',
        /*
         * A tile, not a web card: it lights up under the pointer and dims
         * while pressed, without lifting or throwing a shadow, and keeps the
         * arrow cursor and the app-wide focus rectangle.
         */
        onClick && 'hover:border-primary/40 hover:bg-accent/30 active:bg-accent/20',
        className
      )}
      onClick={onClick}
      style={
        {
          '--rarity': accent ?? 'hsl(var(--border))',
          borderLeft: '3px solid var(--rarity)',
          backgroundImage: accent
            ? `linear-gradient(90deg, color-mix(in srgb, ${accent} 8%, transparent), transparent 40%)`
            : undefined,
        } as React.CSSProperties
      }
      title={title ?? label}
      type={onClick ? 'button' : undefined}
    >
      {/* Top rule: the site's `fn-stripe`. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-[2] h-0.5"
        style={{ background: accent ?? 'hsl(var(--muted-foreground) / 0.5)' }}
      />

      {/* Artboard. */}
      <span
        className="relative m-2 mb-0 grid aspect-square place-items-center overflow-hidden rounded-lg"
        style={artboardStyle(art.rarity)}
      >
        {art.imgUrl ? (
          <img
            alt=""
            className="size-full object-contain p-2 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] transition-transform duration-200 ease-out group-hover:scale-[1.03]"
            decoding="async"
            loading="lazy"
            src={art.imgUrl}
          />
        ) : (
          <ImageOff className="size-8 text-muted-foreground/60" />
        )}

        {typeof power === 'number' && power > 0 && (
          <span className={cn(itemBadge, 'bottom-1.5 right-1.5 gap-1 rounded px-1.5 py-0.5 backdrop-blur-sm')}>
            <span className="text-muted-foreground">PL</span>
            <span className="figure">{power}</span>
          </span>
        )}
        {typeof power !== 'number' && typeof tier === 'number' && tier > 0 && (
          <span className={cn(itemBadge, 'figure bottom-1.5 right-1.5 backdrop-blur-sm')}>
            T{tier}
          </span>
        )}
        {favorite && (
          <span className={cn(itemBadge, 'bottom-1.5 left-1.5 px-0.5 py-0.5 backdrop-blur-sm')} title="Favourited">
            <Star className="size-3 fill-current text-warning drop-shadow-[0_0_5px_rgba(255,200,80,0.7)]" />
          </span>
        )}
        {typeof quantity === 'number' && quantity > 1 && (
          <span className={cn(itemBadge, 'figure right-1.5 top-1.5 backdrop-blur-sm')} title={quantity.toLocaleString()}>
            ×{compact(quantity)}
          </span>
        )}
        {marks.length > 0 && (
          <span className="absolute left-1.5 top-1.5 z-10 flex flex-col gap-0.5">
            {marks.map((entry) => (
              <BadgeMark key={entry.src} mark={entry} />
            ))}
          </span>
        )}
        {overlay}
      </span>

      {/* Caption. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1 px-3 pb-3 pt-2.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-2xs font-semibold uppercase leading-none tracking-wider text-muted-foreground" style={accent ? { color: rarityInk(accent) } : undefined}>
            {eyebrow ?? rarityName ?? 'Item'}
          </span>
          {typeof level === 'number' && (
            <span className="micro-label shrink-0">
              Lv <span className="figure text-foreground">{level}</span>
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-ui font-semibold leading-snug text-foreground">{label}</span>
        {subtitle && <span className="truncate text-caption text-muted-foreground">{subtitle}</span>}
        {badges && <span className="mt-1 flex flex-wrap gap-1">{badges}</span>}
      </span>

      {footer && (
        <span className="mt-auto flex items-center gap-2 border-t border-border/50 px-3 py-2 text-caption text-muted-foreground">
          {footer}
        </span>
      )}

    </Element>
  )
}

/** The grid the cards sit in. Same breakpoints as the site's schematic grid. */
export function ItemCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6', className)}>
      {children}
    </div>
  )
}

function compact(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`
  return n.toLocaleString()
}
