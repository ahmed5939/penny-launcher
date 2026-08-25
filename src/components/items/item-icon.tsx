import type { ItemRecordMap } from '../../kernel/core/item-database'

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

export type ItemArt = {
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
 * corner. Sized in the same steps as the reward chips.
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
        'relative grid shrink-0 place-items-center overflow-hidden rounded-md',
        'bg-muted/40 ring-1 ring-inset ring-border/60',
        box,
        className
      )}
      title={title ?? art.name}
    >
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
          className="relative size-full object-contain"
          loading="lazy"
          src={art.imgUrl}
        />
      )}
      {typeof quantity === 'number' && quantity > 1 && (
        <span className="absolute bottom-0 right-0 rounded-tl bg-background/85 px-1 text-[0.55rem] font-semibold leading-tight tabular-nums">
          {quantity > 9999
            ? `${Math.round(quantity / 1000)}k`
            : quantity.toLocaleString()}
        </span>
      )}
      {typeof tier === 'number' && tier > 0 && (
        <span className="absolute left-0 top-0 rounded-br bg-background/85 px-1 text-[0.5rem] font-semibold leading-tight">
          T{tier}
        </span>
      )}
    </span>
  )
}
