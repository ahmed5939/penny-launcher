import type { ReactNode } from 'react'
import type { CosmeticShowcase, StwShowcase } from './facts'

import { useState } from 'react'

import { Artboard } from '../../components/items/artboard'
import { rarityTypeFromName } from '../../components/page/rarity'

import { cardRarityLabels, cosmeticTileColors } from '../../config/fortnite/locker'

import { seasonName } from './facts'
import { formatCount } from './words'

import { cn } from '../../lib/utils'

/**
 * The Rewind's building blocks: the type ladder of a slide, a cosmetic and a
 * Save the World item as the game draws them, and the two stages — Save the
 * World's key art with the commander in front, Battle Royale's island map
 * with an outfit.
 */

/** fortnite-api's render of the current island, without labels. */
export const brMapUrl = 'https://fortnite-api.com/images/map.png'

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="micro-label text-primary">{children}</p>
}

export function Big({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('figure text-hero-lg font-black leading-none tracking-tight', className)}>{children}</p>
}

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-hero font-black leading-tight', className)}>{children}</p>
}

export function Line({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-display-sm font-semibold leading-snug text-foreground/90', className)}>{children}</p>
}

export function Aside({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-ui text-foreground/70', className)}>{children}</p>
}

/** A bar beside a label and a figure: modes, accounts. */
export function Bars({ rows }: { rows: Array<{ key: string; label: ReactNode; value: number; figure: string }> }) {
  const max = Math.max(...rows.map((row) => row.value), 1)

  return (
    <ul className="max-w-xl space-y-2.5">
      {rows.map((row) => (
        <li className="flex items-center gap-3" key={row.key}>
          <span className="w-44 shrink-0 truncate text-ui font-medium">{row.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="figure w-20 text-right text-ui font-semibold">{row.figure}</span>
        </li>
      ))}
    </ul>
  )
}

/** Figures in a row, the value over its label. */
export function Figures({
  className,
  items,
  size = 'display',
}: {
  className?: string
  items: Array<{ label: string; value: ReactNode }>
  size?: 'display' | 'hero'
}) {
  return (
    <dl className={cn('flex flex-wrap gap-x-12 gap-y-5', className)}>
      {items.map((item) => (
        <div className="flex flex-col-reverse" key={item.label}>
          <dt className="mt-1 micro-label">{item.label}</dt>
          <dd className={cn('figure font-black leading-none', size === 'hero' ? 'text-hero' : 'text-display')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * One cosmetic on its tier's gradient, as the locker draws it. The caption
 * defaults to the season it came out in.
 */
export function CosmeticTile({
  caption,
  className,
  item,
  size = 'md',
}: {
  caption?: ReactNode
  className?: string
  item: CosmeticShowcase
  size?: 'sm' | 'md' | 'lg'
}) {
  const [from, to] = cosmeticTileColors(item)
  const [failed, setFailed] = useState(false)
  const width = { sm: 'w-20', md: 'w-28', lg: 'w-36' }[size]
  const tier = item.series ?? cardRarityLabels[item.rarity] ?? null

  return (
    <figure className={cn('shrink-0', width, className)}>
      <div
        className="relative aspect-square overflow-hidden rounded-lg shadow-lg ring-1 ring-foreground/10"
        style={{ background: `radial-gradient(circle at 50% 35%, ${from}, ${to})` }}
      >
        {item.icon && !failed && (
          <img
            alt=""
            className="absolute inset-0 size-full object-contain"
            crossOrigin="anonymous"
            decoding="async"
            onError={() => setFailed(true)}
            src={item.icon}
          />
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      {size !== 'sm' && (
        <figcaption className="mt-1.5">
          <span className="block truncate text-ui font-semibold leading-tight">{item.name}</span>
          <span className="block truncate text-xs text-foreground/70">
            {caption ?? (item.introduced ? seasonName(item.introduced) : tier)}
          </span>
        </figcaption>
      )}
    </figure>
  )
}

/** A tier's name with its count, coloured like its tiles. */
export function TierChip({ count, label, rarity }: { count: number; label: string; rarity: string }) {
  const [from] = cosmeticTileColors({ rarity })

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-foreground/10 py-1 pl-1.5 pr-3 text-ui font-semibold">
      <span aria-hidden className="size-3 rounded-full" style={{ background: from }} />
      <span className="figure">{formatCount(count)}</span>
      <span className="font-normal text-foreground/80">{label}</span>
    </span>
  )
}

/**
 * The Battle Royale stage: the island from above, darkened, with one of the
 * player's own outfits standing on the right.
 */
export function BrStage({ render }: { render: CosmeticShowcase | null }) {
  return (
    <>
      <img alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 saturate-150" crossOrigin="anonymous" src={brMapUrl} />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
      {render?.featured && (
        <img
          alt=""
          className="absolute bottom-0 right-[4%] h-[92%] max-w-[46%] object-contain drop-shadow-2xl animate-in fade-in-0 slide-in-from-right-8 duration-700"
          crossOrigin="anonymous"
          key={render.id}
          src={render.featured}
        />
      )}
      {render && (
        <span className="absolute bottom-16 right-[6%] max-w-[40%] truncate text-xs text-foreground/60">
          {render.name}
        </span>
      )}
    </>
  )
}

/** A Save the World hero, weapon or survivor on its rarity's artboard, as the Profile page draws it. */
export function StwTile({
  caption,
  className,
  item,
  size = 'md',
}: {
  caption?: ReactNode
  className?: string
  item: StwShowcase
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const width = { xs: 'w-12', sm: 'w-20', md: 'w-28', lg: 'w-40' }[size]
  const hero = item.templateId.toLowerCase().startsWith('hero:')

  return (
    <figure className={cn('shrink-0', width, className)}>
      <Artboard className={cn('aspect-square shadow-lg', size === 'xs' ? 'rounded-md' : 'rounded-lg')} rarity={rarityTypeFromName(item.rarity)}>
        {item.image && !failed && (
          <img
            alt=""
            className={cn('absolute inset-0 size-full', hero ? 'object-cover object-top' : 'object-contain p-2')}
            crossOrigin="anonymous"
            decoding="async"
            onError={() => setFailed(true)}
            src={item.image}
          />
        )}
      </Artboard>
      {(size === 'md' || size === 'lg') && (
        <figcaption className="mt-1.5">
          <span className="block truncate text-ui font-semibold leading-tight">{item.name}</span>
          <span className="block truncate text-xs text-foreground/70">{caption ?? item.rarity}</span>
        </figcaption>
      )}
    </figure>
  )
}

/**
 * The Save the World stage: key art, darkened, with a commander's portrait
 * on the right.
 */
export function StwStage({ hero, src }: { hero: StwShowcase | null; src: string }) {
  return (
    <>
      <img alt="" className="absolute inset-0 size-full object-cover opacity-60 animate-in fade-in-0 duration-700" key={src} src={src} />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
      {hero?.image && (
        <img
          alt=""
          className="absolute bottom-0 right-[4%] aspect-square h-[80%] max-w-[44%] object-contain object-bottom drop-shadow-2xl animate-in fade-in-0 slide-in-from-right-8 duration-700"
          crossOrigin="anonymous"
          key={hero.templateId}
          src={hero.image}
        />
      )}
      {hero && (
        <span className="absolute bottom-16 right-[6%] z-10 max-w-[40%] truncate text-xs text-foreground/60">{hero.name}</span>
      )}
    </>
  )
}
