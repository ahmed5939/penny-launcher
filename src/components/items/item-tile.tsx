import type { ReactNode } from 'react'
import type { ItemRecordMap } from '../../kernel/core/item-database'

import { Lock, Zap } from 'lucide-react'

import { itemBadge, resolveItemArt } from './item-icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '../ui/context-menu'

import { rarityStyle } from '../page/rarity'

import { cn } from '../../lib/utils'

/**
 * An item the way the game draws it.
 *
 * The vault does not show you a table row — it shows a rarity-coloured plate
 * with the art centred on it, the name on a bar across the bottom, and the
 * level in the corner. Those plates ship with the app already
 * (`assets/images/rarities/*.png`, used here as the tile background), so
 * this is the real thing rather than an approximation of it.
 *
 * That plate is the game's own artwork, so it states the tier in the game's
 * own colours whatever we do — which is exactly why the chrome around it can
 * afford the restraint ladder the rest of the app runs on. The border tints
 * from Rare up and takes the neutral hairline below it, and nothing is lost
 * by that, because the tier is still legible in the plate underneath. A shelf
 * of Nuts & Bolts therefore does not compete with the one Legendary schematic
 * standing in it. The name bar carries no rarity at all: it is a caption, and
 * a caption is not where a page spends its colour.
 */

export type ItemTileSize = 'small' | 'default' | 'large'

export function ItemTile({
  className,
  disabled,
  footer,
  level,
  locked,
  menu,
  name,
  onClick,
  power,
  quantity,
  records,
  selected,
  size = 'default',
  templateId,
  tier,
  title,
}: {
  className?: string
  disabled?: boolean
  /** Extra line under the name bar. */
  footer?: ReactNode
  level?: number
  /**
   * `ContextMenuItem`s to show on right-click. This is where an item's
   * actions belong — reaching them should not mean opening a dialog first.
   */
  menu?: ReactNode
  /** Item power level — takes the corner slot tier used to occupy. */
  power?: number | null
  /** Shows the padlock the game uses for favourited items. */
  locked?: boolean
  /** Overrides the database name. */
  name?: string
  onClick?: () => void
  quantity?: number
  records?: ItemRecordMap
  selected?: boolean
  size?: ItemTileSize
  templateId: string
  tier?: number
  title?: string
}) {
  const art = resolveItemArt(templateId, records)
  const label = name ?? art.name

  const box = {
    small: 'w-16',
    default: 'w-24',
    large: 'w-32',
  }[size]

  const Element = onClick ? 'button' : 'div'

  const tile = (
    <Element
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        'group relative block shrink-0 overflow-hidden rounded-lg border-2 text-left',
        'transition-transform',
        box,
        art.accent ? 'border-[color:var(--rarity)]' : 'border-border/60',
        onClick && !disabled && 'hover:-translate-y-0.5 hover:brightness-110',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        disabled && 'opacity-60',
        '[content-visibility:auto] [contain-intrinsic-size:6rem_8rem]',
        className
      )}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
      style={rarityStyle(art.accent)}
      title={title ?? label}
      type={onClick ? 'button' : undefined}
    >
      {/* Rarity plate. */}
      <span className="relative block aspect-square w-full">
        {art.frame && (
          <img
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
            decoding="async"
            loading="lazy"
            src={art.frame}
          />
        )}
        {art.imgUrl && (
          <img
            alt=""
            className="absolute inset-0 size-full object-contain"
            decoding="async"
            loading="lazy"
            src={art.imgUrl}
          />
        )}

        {/* Power is what the game shows and what people compare; tier is a
            secondary detail, so it only appears when power is unknown. */}
        {typeof power === 'number' && power > 0 ? (
          <span className={cn(itemBadge, 'left-1 top-1')}>
            <Zap className="size-2 text-muted-foreground" />
            <span className="figure">{power}</span>
          </span>
        ) : (
          typeof tier === 'number' &&
          tier > 0 && (
            <span className={cn(itemBadge, 'figure left-1 top-1')}>
              T{tier}
            </span>
          )
        )}

        {locked && (
          <span
            className={cn(itemBadge, 'right-1 top-1 px-0.5')}
            title="Favourited or equipped — cannot be recycled"
          >
            <Lock className="size-2.5" />
          </span>
        )}

        {typeof quantity === 'number' && quantity > 1 && (
          <span className={cn(itemBadge, 'figure bottom-1 right-1')}>
            {quantity > 9999
              ? `${Math.round(quantity / 1000)}k`
              : quantity.toLocaleString()}
          </span>
        )}

        {typeof level === 'number' && level > 0 && (
          <span className={cn(itemBadge, 'figure bottom-1 left-1')}>
            {level}
          </span>
        )}
      </span>

      {/* Name bar. */}
      <span className="block bg-card/80 px-1.5 py-1 text-center">
        <span className="line-clamp-2 text-[0.75rem] font-medium leading-tight text-foreground">
          {label}
        </span>
        {footer && (
          <span className="micro-label mt-1 block truncate">{footer}</span>
        )}
      </span>
    </Element>
  )

  if (!menu) {
    return tile
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{tile}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">{menu}</ContextMenuContent>
    </ContextMenu>
  )
}
