import type { ReactNode } from 'react'
import type { ItemRecordMap } from '../../kernel/core/item-database'
import type { LucideIcon } from 'lucide-react'

import { Children } from 'react'

import { Zap } from 'lucide-react'

import { resolveItemArt } from './item-icon'
import { DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'

import { rarityStyle, rarityTypeFromName } from '../page/rarity'
import { raritiesColor, rarities, RarityType } from '../../config/constants/resources'

import { cn } from '../../lib/utils'

/**
 * The top of every item dialog, matching `ItemDetailDialog`: framed art on
 * the left, name, a rarity-coloured caption line, power, then small facts.
 *
 * `rarity` overrides what the art resolver decides — the Collection Book's
 * slot rarity, a scan's own rarity — when the caller knows better.
 */
export function DetailHeader({
  badges,
  description,
  dimmed,
  facts,
  meta,
  name,
  portrait,
  power,
  rarity,
  records,
  templateId,
}: {
  badges?: ReactNode
  description?: string | null
  /** Draw the art greyed, for an empty slot. */
  dimmed?: boolean
  /** Small facts under the power line: level, quantity, location. */
  facts?: ReactNode
  /** Joined with " · " after the rarity in the caption line. */
  meta?: Array<string | false | null | undefined>
  name?: string
  portrait?: string | null
  power?: number | null
  rarity?: string | null
  records: ItemRecordMap
  templateId: string
}) {
  const art = resolveItemArt(templateId, records, portrait)
  const type = (rarity ? rarityTypeFromName(rarity) : null) ?? (art.rarity as RarityType)
  const accent = type && type !== RarityType.Common ? raritiesColor[type] : null
  const caption = [rarity ?? rarities[type], ...(meta ?? [])].filter(Boolean).join(' · ')

  return (
    <DialogHeader>
      <div className="flex items-start gap-4">
        <span className={cn('relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border-2', accent ? 'border-[color:var(--rarity)]' : 'border-border/60')} style={rarityStyle(accent)}>
          {art.frame && <img alt="" aria-hidden className="absolute inset-0 size-full object-cover" decoding="async" src={art.frame} />}
          {art.imgUrl && <img alt="" className={cn('relative size-full object-contain', dimmed && 'opacity-50 grayscale')} decoding="async" src={art.largeImgUrl ?? art.imgUrl} />}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <DialogTitle className="text-left text-lg leading-tight">{name ?? art.name}</DialogTitle>
          {caption && (
            <p className={cn('micro-label mt-1.5', accent && 'text-[color:var(--rarity)]')} style={rarityStyle(accent)}>{caption}</p>
          )}
          {typeof power === 'number' && power > 0 && (
            <p className="mt-2 flex items-center gap-1.5 leading-none">
              <Zap className="size-4 text-muted-foreground" />
              <span className="figure text-base font-bold">{power}</span>
              <span className="micro-label">Power</span>
            </p>
          )}
          {facts && <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">{facts}</p>}
          {badges && <div className="mt-2 flex flex-wrap gap-1">{badges}</div>}
        </div>
      </div>
      {description && <DialogDescription className="mt-3 whitespace-pre-line text-left leading-relaxed">{description}</DialogDescription>}
    </DialogHeader>
  )
}

/** A titled block inside an item dialog. Same caption rank as `ItemDetailDialog`'s own sections. */
export function DetailSection({ children, icon: Icon, title }: { children: ReactNode; icon: LucideIcon; title: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="section-label flex items-center gap-1.5"><Icon className="size-3 text-muted-foreground" />{title}</p>
      {children}
    </section>
  )
}

/**
 * One perk slot on one copy, drawn like `ItemDetailDialog`'s perk rows: a
 * rarity pip, the perk's name, then chips. Empty slots stay rows rather than
 * gaps; the raw alteration id is the row's tooltip.
 */
export function PerkSlotRow({ accent, children, empty, id, index, title }: {
  /** Rarity colour for the pip, when known. */
  accent?: string | null
  /** Chips under the name. */
  children?: ReactNode
  empty?: boolean
  /** Raw alteration id, kept as the tooltip. */
  id?: string | null
  index: number
  title: ReactNode
}) {
  return (
    <li className="panel px-3 py-2" data-slot={index} title={id ?? undefined}>
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', accent ? 'bg-[color:var(--rarity)]' : 'bg-muted-foreground/50')} style={rarityStyle(accent ?? null)} />
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-semibold', empty && 'text-muted-foreground')}>{title}</p>
          {Children.toArray(children).length > 0 && <div className="mt-1 flex flex-wrap items-center gap-1">{children}</div>}
        </div>
      </div>
    </li>
  )
}
