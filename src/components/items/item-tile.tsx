import type { ReactNode } from 'react'
import type { ItemRecordMap } from '../../kernel/core/item-database'

import { Check, Lock, Zap } from 'lucide-react'

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
 *
 * There is deliberately no `content-visibility: auto` on the tile. It was how
 * the vault survived rendering its whole contents at once; the two screens
 * that did that — the vault and the compendium — virtualise now, and a
 * skipped element measures as its `contain-intrinsic-size` rather than its
 * real height, which is exactly what a virtualiser must not be told.
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
  onToggleSelect,
  portrait,
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
  /**
   * Renders a tick box in the plate's corner. Selection lives there so a
   * plain click can mean the same thing on every tile — inspect — instead
   * of selecting some items and opening others.
   */
  onToggleSelect?: () => void
  /** Survivors: the `WorkerPortrait:` id this copy rolled. */
  portrait?: string | null
  quantity?: number
  records?: ItemRecordMap
  selected?: boolean
  size?: ItemTileSize
  templateId: string
  tier?: number
  title?: string
}) {
  const art = resolveItemArt(templateId, records, portrait)
  const label = name ?? art.name

  const box = {
    small: 'w-16',
    default: 'w-24',
    large: 'w-32',
  }[size]

  /*
   * The tick box is a button of its own, and a button cannot nest inside a
   * button — with one present the tile falls back to a clickable div.
   */
  const isButton = Boolean(onClick) && !onToggleSelect
  const Element = isButton ? 'button' : 'div'

  const tile = (
    <Element
      aria-pressed={isButton ? selected : undefined}
      className={cn(
        'group relative block shrink-0 overflow-hidden rounded-lg border-2 text-left',
        'transition-transform',
        box,
        art.accent ? 'border-[color:var(--rarity)]' : 'border-border/60',
        onClick && !disabled && 'hover:-translate-y-0.5 hover:brightness-110',
        onClick && !isButton && 'cursor-pointer',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        disabled && 'opacity-60',
        className
      )}
      disabled={isButton ? disabled : undefined}
      onClick={disabled ? undefined : onClick}
      role={onClick && !isButton ? 'button' : undefined}
      style={rarityStyle(art.accent)}
      tabIndex={onClick && !isButton ? 0 : undefined}
      title={title ?? label}
      type={isButton ? 'button' : undefined}
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

        {onToggleSelect && !locked && (
          <button
            aria-checked={selected}
            className={cn(
              'absolute right-1 top-1 grid size-5 place-items-center rounded-md border transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/80 bg-background/70 text-transparent hover:border-primary/70 hover:text-primary/50'
            )}
            onClick={(event) => {
              event.stopPropagation()
              onToggleSelect()
            }}
            role="checkbox"
            title="Tick to select"
            type="button"
          >
            <Check className="size-3.5" />
          </button>
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
