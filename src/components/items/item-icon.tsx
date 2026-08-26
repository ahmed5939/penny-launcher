import type { ItemRecordMap } from '../../kernel/core/item-database'
import type { ParseResourceData } from '../../types/data/resources'

import { accentByRarity, gradedTypes, rarityStyle } from '../page/rarity'

import { RarityType } from '../../config/constants/resources'
import { peglegImageURL } from '../../config/constants/pegleg'

import { getItemRecord } from '../../state/items/database'

import { parseResource } from '../../lib/parsers/resources'
import { assets } from '../../lib/repository'
import { cn } from '../../lib/utils'

/**
 * Item art, resolved the same way the mission rewards resolve theirs.
 *
 * `parseResource` is the app's one template-id → asset mapper, so anything it
 * already knows (resources, ingredients, traps, survivors, the generic hero /
 * defender / schematic vouchers) looks identical here to how it looks on the
 * alerts screen. This adds two refinements on top of it:
 *
 * - weapon schematics get the melee/ranged voucher rather than the flat
 *   schematic one, which is the difference between "a schematic" and "a
 *   sword" at a glance;
 * - card packs get their llama art, which `parseResource` misses because its
 *   lookup only strips the `CardPack:zcp_` prefix.
 */

const meleeTokens = [
  'edged',
  'blunt',
  'piercing',
  'axe',
  'scythe',
  'club',
  'sword',
  'spear',
  'hardware',
]

const rangedTokens = [
  'assault',
  'pistol',
  'shotgun',
  'sniper',
  'launcher',
  'explosive',
]

/** Mythic ships no frame of its own; the exotic frame is the closest match. */
const frameByRarity: Record<string, string> = {
  [RarityType.Common]: 'c',
  [RarityType.Uncommon]: 'uc',
  [RarityType.Rare]: 'r',
  [RarityType.Epic]: 'vr',
  [RarityType.Legendary]: 'sr',
  [RarityType.Mythic]: 'er',
}

/** The kinds whose decoded name beats `parseResource`'s generic one. */
const decodablePrefix = /^(Hero|Schematic|Defender|Worker):/

/**
 * The one corner-badge recipe.
 *
 * A quantity, a level, a tier, a power and the padlock are all the same
 * thing — a small fact stamped onto the item's own art — so they are one
 * shape rather than five. The fill is a token pair rather than black and
 * white, because a badge has to stay legible over a bright legendary plate
 * and over a pale page, and a fixed pair only manages one of the two.
 *
 * Where a badge pins is the call site's business, since the corner and the
 * inset scale with the art it sits on. What it looks like is not.
 */
export const itemBadge =
  'absolute z-10 inline-flex items-center gap-0.5 rounded-lg bg-background/85 px-1 py-px text-[0.625rem] font-semibold leading-none text-foreground ring-1 ring-inset ring-border/50'

/**
 * The rarity colour this item's chrome is allowed to spend, on the app's one
 * ladder (`src/components/page/rarity.ts`).
 *
 * Two gates, both borrowed rather than restated, so the vault cannot become a
 * second source of truth for rarity. Rarity is a real property of graded item
 * classes only — a stack of Nuts & Bolts is not "Common", it has no rarity to
 * colour at all — and `accentByRarity` holds no entry below Rare, which keeps
 * the junk half of a vault page in the neutral border token.
 */
function resolveAccent(templateId: string, resource: ParseResourceData) {
  const graded =
    (resource.type !== null && gradedTypes.has(resource.type)) ||
    templateId.startsWith('Schematic:')

  return graded ? accentByRarity[resource.rarity] ?? null : null
}

export type ItemArt = {
  /**
   * The colour this item's chrome draws its rarity in, or null when the item
   * has no rarity worth spending colour on. See `resolveAccent`.
   */
  accent: string | null
  /** Rarity backing tile. Always present. */
  frame: string | undefined
  /** Foreground icon, or undefined when only the frame is known. */
  imgUrl: string | undefined
  name: string
  rarity: string
  /** True when `name` is better than whatever the caller decoded. */
  preferName: boolean
}

/**
 * @param records the item database, when it has loaded. Passing it swaps the
 *   generic voucher art and decoded names for the game's own.
 */
export function resolveItemArt(
  templateId: string,
  records?: ItemRecordMap
): ItemArt {
  const resource = parseResource({ key: templateId, quantity: 1 })
  const record = records ? getItemRecord(records, templateId) : null

  if (record) {
    return {
      accent: resolveAccent(templateId, resource),
      frame: assets(frameByRarity[resource.rarity] ?? 'c'),
      imgUrl: record.image ? peglegImageURL(record.image) : undefined,
      name: record.name,
      rarity: resource.rarity,
      /** The database name beats anything we decode ourselves. */
      preferName: true,
    }
  }

  const frame = assets(frameByRarity[resource.rarity] ?? 'c')
  const body = templateId.toLowerCase()

  let imgUrl = resource.imgUrl

  if (templateId.startsWith('Schematic:') && resource.type !== 'trap') {
    const kind = meleeTokens.some((token) => body.includes(token))
      ? 'melee'
      : rangedTokens.some((token) => body.includes(token))
        ? 'ranged'
        : null

    if (kind) {
      imgUrl =
        assets(`voucher_generic_${kind}_${resource.rarity}`) ?? imgUrl
    }
  }

  if (templateId.startsWith('CardPack:')) {
    imgUrl =
      assets(
        body.includes('jackpot')
          ? 'voucher_cardpack_jackpot'
          : body.includes('bronze')
            ? 'voucher_cardpack_bronze'
            : 'voucher_basicpack'
      ) ?? imgUrl
  }

  return {
    accent: resolveAccent(templateId, resource),
    frame,
    /** Nothing matched, so the frame is the whole picture. */
    imgUrl: imgUrl === frame ? undefined : imgUrl,
    name: resource.name,
    rarity: resource.rarity,
    preferName: !decodablePrefix.test(templateId),
  }
}

/**
 * One framed item icon: rarity tile behind, item art on top, quantity in the
 * corner. Sized in the same steps as the reward chips, and ringed the same
 * way `RewardWell` rings them — rarity as a hairline, never a fill behind the
 * art, and only for the grades the ladder decided are worth the colour.
 */
export function ItemIcon({
  className,
  quantity,
  records,
  size = 'default',
  templateId,
  tier,
  title,
}: {
  className?: string
  /** Rendered as a corner badge when above 1. */
  quantity?: number
  records?: ItemRecordMap
  size?: 'small' | 'default' | 'large' | 'xl'
  templateId: string
  /** Rendered as a corner pip when above 0. */
  tier?: number
  title?: string
}) {
  const art = resolveItemArt(templateId, records)
  const box = {
    small: 'size-7',
    default: 'size-9',
    large: 'size-12',
    xl: 'size-16',
  }[size]

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-lg',
        'bg-muted/40 ring-1 ring-inset',
        art.accent ? 'ring-[color:var(--rarity-soft)]' : 'ring-border/60',
        box,
        className
      )}
      style={rarityStyle(art.accent)}
      title={title ?? art.name}
    >
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
          className="relative size-full object-contain"
          decoding="async"
          loading="lazy"
          src={art.imgUrl}
        />
      )}
      {typeof quantity === 'number' && quantity > 1 && (
        <span className={cn(itemBadge, 'figure bottom-0.5 right-0.5')}>
          {quantity > 9999
            ? `${Math.round(quantity / 1000)}k`
            : quantity.toLocaleString()}
        </span>
      )}
      {typeof tier === 'number' && tier > 0 && (
        <span className={cn(itemBadge, 'figure left-0.5 top-0.5')}>
          T{tier}
        </span>
      )}
    </span>
  )
}
