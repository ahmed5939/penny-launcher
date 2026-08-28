import type { CSSProperties, ReactNode } from 'react'
import type { CosmeticMeta } from '../../../kernel/core/locker-catalog'

import { ImageOff } from 'lucide-react'

import { cosmeticTileColors } from '../../../config/fortnite/locker'

import { cn } from '../../../lib/utils'

/**
 * A Battle Royale cosmetic, drawn the way the game draws it.
 *
 * Not `ItemTile`: that one is Save the World's, and it works by looking a
 * template id up in the STW item database and dropping the art onto one of
 * six shipped rarity plates. A locker cosmetic has neither — its name, art
 * and rarity all arrive from fortnite-api.com — so the plate is a CSS
 * gradient built from the item's own series palette, falling back to the
 * rarity ladder.
 *
 * Banner colours are the one kind with no artwork at all: for those the
 * swatch *is* the item, so the tile draws the colour itself.
 */
export type CosmeticTileSize = 'small' | 'default'

export function CosmeticTile({
  cosmetic,
  disabled,
  footer,
  onClick,
  selected,
  size = 'default',
  title,
}: {
  cosmetic: Pick<
    CosmeticMeta,
    'color' | 'imageUrl' | 'name' | 'rarity' | 'seriesColors'
  >
  disabled?: boolean
  /** A line under the name bar — the slot a tile stands for, usually. */
  footer?: ReactNode
  onClick?: () => void
  selected?: boolean
  size?: CosmeticTileSize
  title?: string
}) {
  const [from, to] = cosmeticTileColors(cosmetic)
  const style = {
    backgroundImage: `radial-gradient(circle at 50% 38%, ${from}, ${to})`,
  } satisfies CSSProperties

  const Element = onClick ? 'button' : 'div'

  return (
    <Element
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border text-left',
        'border-border/60 transition-[transform,box-shadow,border-color]',
        onClick && !disabled && 'hover:-translate-y-0.5 hover:border-primary/60',
        disabled && 'cursor-not-allowed opacity-60',
        selected && 'border-primary ring-1 ring-primary',
        size === 'small' ? 'w-20' : 'w-28'
      )}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
      title={title ?? cosmetic.name}
      type={onClick ? 'button' : undefined}
    >
      <div
        className={cn(
          'relative w-full',
          size === 'small' ? 'h-20' : 'h-28'
        )}
        style={style}
      >
        {cosmetic.color ? (
          <span
            aria-hidden
            className="absolute inset-[22%] rounded-md border-2 border-white/35"
            style={{ backgroundColor: cosmetic.color }}
          />
        ) : cosmetic.imageUrl ? (
          <img
            alt=""
            className="absolute inset-0 size-full object-contain"
            draggable={false}
            loading="lazy"
            src={cosmetic.imageUrl}
          />
        ) : (
          <ImageOff className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-white/50" />
        )}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-b from-transparent to-black/85"
        />
        <span
          className={cn(
            'absolute inset-x-0 bottom-0 truncate px-1 pb-1 text-center font-semibold text-white',
            size === 'small' ? 'text-[0.5625rem]' : 'text-[0.625rem]'
          )}
        >
          {cosmetic.name}
        </span>
      </div>
      {footer && (
        <span className="micro-label truncate border-t border-border/60 bg-muted/40 px-1 py-1 text-center">
          {footer}
        </span>
      )}
    </Element>
  )
}
