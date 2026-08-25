import type { ReactNode } from 'react'
import type { ItemRecordMap } from '../../kernel/core/item-database'

import { Lock, Zap } from 'lucide-react'

import { resolveItemArt } from './item-icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '../ui/context-menu'

import { RarityType } from '../../config/constants/resources'

import { cn } from '../../lib/utils'

/**
 * An item the way the game draws it.
 *
 * The vault does not show you a table row — it shows a rarity-coloured plate
 * with the art centred on it, the name on a bar across the bottom, and the
 * level in the corner. Those plates ship with the app already
 * (`assets/images/rarities/*.png`, used here as the tile background), so
 * this is the real thing rather than an approximation of it.
 */

/** The in-game rarity colours, for the border and the name bar. */
const rarityBorder: Record<string, string> = {
  [RarityType.Common]: 'border-[#9ba0a5]',
  [RarityType.Uncommon]: 'border-[#5ecc32]',
  [RarityType.Rare]: 'border-[#43aff5]',
  [RarityType.Epic]: 'border-[#b054e8]',
  [RarityType.Legendary]: 'border-[#f5a742]',
  [RarityType.Mythic]: 'border-[#f5e142]',
}

const rarityBar: Record<string, string> = {
  [RarityType.Common]: 'bg-[#4a4f54]/95',
  [RarityType.Uncommon]: 'bg-[#2c6b1a]/95',
  [RarityType.Rare]: 'bg-[#1d5c8c]/95',
  [RarityType.Epic]: 'bg-[#5b2a80]/95',
  [RarityType.Legendary]: 'bg-[#8a5410]/95',
  [RarityType.Mythic]: 'bg-[#8a7a10]/95',
}

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
  const rarity = art.rarity

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
        'transition-transform duration-100',
        box,
        rarityBorder[rarity] ?? 'border-border',
        onClick && !disabled && 'hover:-translate-y-0.5 hover:brightness-110',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        disabled && 'opacity-60',
        className
      )}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
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
            src={art.frame}
          />
        )}
        {art.imgUrl && (
          <img
            alt=""
            className="absolute inset-0 size-full object-contain"
            loading="lazy"
            src={art.imgUrl}
          />
        )}

        {/* Power is what the game shows and what people compare; tier is a
            secondary detail, so it only appears when power is unknown. */}
        {typeof power === 'number' && power > 0 ? (
          <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-black/70 px-1 text-[0.6rem] font-bold leading-tight text-white">
            <Zap className="size-2 text-yellow-300" />
            {power}
          </span>
        ) : (
          typeof tier === 'number' &&
          tier > 0 && (
            <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[0.6rem] font-bold leading-tight text-white">
              T{tier}
            </span>
          )
        )}

        {locked && (
          <span
            className="absolute right-1 top-1 grid size-4 place-items-center rounded bg-black/65 text-white"
            title="Favourited or equipped — cannot be recycled"
          >
            <Lock className="size-2.5" />
          </span>
        )}

        {typeof quantity === 'number' && quantity > 1 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[0.6rem] font-bold leading-tight tabular-nums text-white">
            {quantity > 9999
              ? `${Math.round(quantity / 1000)}k`
              : quantity.toLocaleString()}
          </span>
        )}

        {typeof level === 'number' && level > 0 && (
          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[0.6rem] font-bold leading-tight tabular-nums text-white">
            {level}
          </span>
        )}
      </span>

      {/* Name bar. */}
      <span
        className={cn(
          'block px-1.5 py-1 text-center',
          rarityBar[rarity] ?? 'bg-muted'
        )}
      >
        <span className="line-clamp-2 text-[0.6rem] font-semibold leading-tight text-white">
          {label}
        </span>
        {footer && (
          <span className="mt-0.5 block truncate text-[0.55rem] leading-tight text-white/70">
            {footer}
          </span>
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
