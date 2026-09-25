import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type { ItemRecordMap } from '../../kernel/core/item-database'

import { Check, Lock } from 'lucide-react'

import { itemBadge, resolveItemArt } from './item-icon'
import { Artboard, BadgeMark, itemBadgeMarks, rarityInk } from './artboard'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '../ui/context-menu'

import { rarityStyle } from '../page/rarity'

import { getItemRecord } from '../../state/items/database'
import { rarities, raritiesColor, RarityType } from '../../config/constants/resources'

import { cn } from '../../lib/utils'

/**
 * An item the way the Penny database site draws it.
 *
 * A card one step off the page with the rarity down its left edge and a
 * hairline of it along the top; inside, the site's artboard — a diagonal
 * rarity wash (`Artboard`) with the art standing on it, the item's class
 * marks in the top-left corner and its power stamped bottom-right as the
 * game prints it, "PL 144". Under the art, the rarity as an eyebrow in its
 * own colour, then the name. It replaces the game's flat rarity plate the
 * tile used to sit on: the site and the launcher now show the same card, so
 * moving between them is seamless.
 *
 * The tick box only shows under the pointer (or once ticked), because forty
 * empty boxes over forty portraits is noise; the padlock always shows.
 *
 * There is deliberately no `content-visibility: auto` on the tile. The two
 * screens that render hundreds — the vault and the codex — virtualise,
 * and a skipped element measures as its `contain-intrinsic-size` rather than
 * its real height, which is exactly what a virtualiser must not be told.
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
  onDoubleClick,
  onToggleSelect,
  personality,
  portrait,
  power,
  quantity,
  records,
  selected,
  setBonus,
  size = 'default',
  status,
  templateId,
  tier,
  title,
}: {
  className?: string
  disabled?: boolean
  /** Extra line under the name. */
  footer?: ReactNode
  level?: number
  /**
   * `ContextMenuItem`s to show on right-click. This is where an item's
   * actions belong — reaching them should not mean opening a dialog first.
   */
  menu?: ReactNode
  /** Item power level — the "PL 144" stamp in the artboard's corner. */
  power?: number | null
  /** Shows the padlock the game uses for favourited items. */
  locked?: boolean
  /** Overrides the database name. */
  name?: string
  /** Receives the event so a screen can read Ctrl/Shift for multi-select. */
  onClick?: (event: MouseEvent) => void
  onDoubleClick?: () => void
  /**
   * Renders a tick box in the artboard's corner. Selection lives there so a
   * plain click can mean the same thing on every tile — inspect — instead
   * of selecting some items and opening others.
   */
  onToggleSelect?: () => void
  /** Survivors: personality and set bonus, drawn as the site's corner marks. */
  personality?: string | null
  /** Survivors: the `WorkerPortrait:` id this copy rolled. */
  portrait?: string | null
  quantity?: number
  records?: ItemRecordMap
  selected?: boolean
  setBonus?: string | null
  size?: ItemTileSize
  /**
   * A tag under the name that always shows — unlike `footer`, which the
   * corner marks stand in for. For what a screen found out about the copy.
   */
  status?: ReactNode
  templateId: string
  tier?: number
  title?: string
}) {
  const art = resolveItemArt(templateId, records, portrait)
  const label = name ?? art.name
  const record = records ? getItemRecord(records, templateId) : null
  const marks = itemBadgeMarks({ personality, record, setBonus, templateId })
  const rarity = art.rarity as RarityType
  const color = raritiesColor[rarity] ?? raritiesColor[RarityType.Common]
  /* The vault's restraint ladder: edge and eyebrow colour from Rare up; the artboard still carries every tier. */
  const graded = art.accent !== null
  const compact = size === 'small'

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
        'item-tile group relative flex shrink-0 flex-col overflow-hidden rounded-lg bg-card text-left',
        'shadow-[0_1px_0_hsl(var(--foreground)/0.04)_inset,0_1px_2px_rgb(0_0_0/0.35)] ring-1 ring-inset ring-border/60',
        'transition-[transform,box-shadow,background-color] duration-150 ease-out',
        compact ? 'p-1' : 'p-1.5 pb-2',
        box,
        onClick &&
          !disabled &&
          'hover:-translate-y-0.5 hover:bg-accent/40 hover:ring-[color:var(--tile-edge)] active:translate-y-0',
        selected && 'bg-primary/10 ring-2 ring-primary',
        disabled && 'opacity-60',
        className
      )}
      disabled={isButton ? disabled : undefined}
      onClick={disabled ? undefined : onClick}
      onDoubleClick={disabled ? undefined : onDoubleClick}
      role={onClick && !isButton ? 'button' : undefined}
      style={
        {
          ...rarityStyle(art.accent),
          '--tile-edge': `color-mix(in srgb, ${color} 55%, transparent)`,
          borderLeft: graded ? `3px solid ${color}` : undefined,
        } as CSSProperties
      }
      tabIndex={onClick && !isButton ? 0 : undefined}
      title={title ?? label}
      type={isButton ? 'button' : undefined}
    >
      {/* Top rule: the site's stripe. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `color-mix(in srgb, ${color} 60%, transparent)` }}
      />

      <Artboard
        className={cn('aspect-square w-full', compact ? 'rounded' : 'rounded-md')}
        rarity={art.rarity}
      >
        {art.imgUrl && (
          <img
            alt=""
            className={cn(
              'absolute inset-0 size-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]',
              'transition-transform duration-200 ease-out group-hover:scale-[1.04]',
              compact ? 'p-0.5' : 'p-1'
            )}
            decoding="async"
            loading="lazy"
            src={art.imgUrl}
          />
        )}

        {!compact && marks.length > 0 && (
          <span className="absolute left-1 top-1 z-10 flex flex-col gap-0.5">
            {marks.map((entry) => (
              <BadgeMark key={entry.src} mark={entry} />
            ))}
          </span>
        )}

        {locked && (
          <span
            className={cn(itemBadge, 'right-1 top-1 px-0.5 py-0.5')}
            title="Favourited or equipped — cannot be recycled"
          >
            <Lock className="size-2.5" />
          </span>
        )}

        {onToggleSelect && !locked && (
          <button
            aria-checked={selected}
            className={cn(
              'absolute right-1 top-1 z-10 grid size-5 place-items-center rounded-md border transition-[opacity,background-color,border-color]',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-white/40 bg-black/45 text-transparent opacity-0 hover:border-primary hover:text-primary/60 focus-visible:opacity-100 group-hover:opacity-100'
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
          <span className={cn(itemBadge, 'figure left-1 bottom-1')}>
            ×
            {quantity > 9999
              ? `${Math.round(quantity / 1000)}k`
              : quantity.toLocaleString()}
          </span>
        )}

        {/* Power is what the game shows and what people compare; tier is a
            secondary detail, so it only appears when power is unknown. */}
        {typeof power === 'number' && power > 0 ? (
          <span className={cn(itemBadge, 'bottom-1 right-1 gap-1 rounded px-1 py-0.5 backdrop-blur-sm')}>
            {!compact && <span className="text-muted-foreground">PL</span>}
            <span className="figure">{power}</span>
          </span>
        ) : (
          typeof tier === 'number' &&
          tier > 0 && (
            <span className={cn(itemBadge, 'figure bottom-1 right-1 rounded px-1 py-0.5')}>
              T{tier}
            </span>
          )
        )}
      </Artboard>

      {compact ? (
        <span className="mt-1 line-clamp-1 px-0.5 text-center text-2xs font-medium leading-tight text-foreground">
          {label}
        </span>
      ) : (
        <span className="mt-2 flex min-w-0 flex-col gap-1 px-0.5">
          <span className="flex items-baseline justify-between gap-1">
            <span
              className="truncate text-2xs font-semibold uppercase leading-none tracking-wider"
              style={{ color: graded ? rarityInk(color) : undefined }}
            >
              {rarities[rarity] ?? 'Item'}
            </span>
            {typeof level === 'number' && level > 0 && (
              <span className="shrink-0 text-2xs leading-none text-muted-foreground">
                Lv <span className="figure font-semibold text-foreground">{level}</span>
              </span>
            )}
          </span>
          <span className="truncate text-ui font-semibold leading-tight text-foreground">
            {label}
          </span>
          {/* The corner marks already say what the footer would. */}
          {footer && marks.length === 0 && (
            <span className="truncate text-2xs leading-tight text-muted-foreground">{footer}</span>
          )}
          {status && <span className="flex min-w-0 flex-wrap gap-1">{status}</span>}
        </span>
      )}
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
