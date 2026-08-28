import type { ItemRecordMap } from '../../kernel/core/item-database'
import type { ParseResourceData } from '../../types/data/resources'

import {
  accentByRarity,
  gradedTypes,
  rarityStyle,
  rarityTypeFromName,
} from '../page/rarity'

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
 *   lookup only strips the `CardPack:zcp_` prefix;
 * - survivors keep the app's own art, because PegLeg's stand-in for them is a
 *   featureless black silhouette (see `peglegPlaceholders`).
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

/** One plate per rarity token, matching `RarityColor`. */
const frameByRarity: Record<string, string> = {
  [RarityType.Common]: 'c',
  [RarityType.Uncommon]: 'uc',
  [RarityType.Rare]: 'r',
  [RarityType.Epic]: 'vr',
  [RarityType.Legendary]: 'sr',
  [RarityType.Mythic]: 'ur',
}

/** The kinds whose decoded name beats `parseResource`'s generic one. */
const decodablePrefix = /^(Hero|Schematic|Defender|Worker):/

/**
 * PegLeg exports that are worse than having no art at all.
 *
 * Every unnamed survivor in the game — every `Survivor`, every `Lead
 * Whatever` — points at `GenericWorker.png`, which is a solid black
 * head-and-shoulders on transparency. Dropped over a rarity plate it reads as
 * a hole punched in the tile, and a llama's contents are mostly survivors, so
 * a preview ends up looking broken. The app ships its own survivor glyph for
 * exactly this case; the record's name and rarity are still worth keeping,
 * only its picture is not.
 */
const peglegPlaceholders = new Set(['GenericWorker.png'])

function usableImage(fileName: string | null | undefined) {
  return fileName && !peglegPlaceholders.has(fileName) ? fileName : null
}

/**
 * A survivor's `portrait` attribute, as a database row.
 *
 * The profile spells it as a full template id
 * (`WorkerPortrait:IconDef-WorkerPortrait-Pragmatic-F01`), which
 * `getItemRecord` already case-folds. The bare icon-definition name is tried
 * as well so an account whose profile omits the prefix still gets a face
 * rather than silently falling back to the silhouette.
 */
function getPortraitRecord(records: ItemRecordMap, portrait: string) {
  return (
    getItemRecord(records, portrait) ??
    getItemRecord(records, `WorkerPortrait:${portrait}`)
  )
}

/**
 * The voucher art was exported back when Mythic's token was `er`, and the
 * files still say so. `assets` misses on `ur` and the caller falls back to a
 * plain plate, which is why the rename stops here rather than in the filenames.
 */
function voucherRarity(rarity: string) {
  return rarity === RarityType.Mythic ? 'er' : rarity
}

/**
 * Every rarity-tinted generic voucher, mapped to the white cut it is a recolour
 * of.
 *
 * The tinted variants were drawn for a neutral background. Dropped onto this
 * app's rarity plate they come out as the plate's own colour — a Legendary
 * survivor is an orange silhouette on orange, which reads as a tile that
 * failed to load. The plate already says what the rarity is, so the glyph only
 * has to say what the thing is, which is exactly what the white cut does and
 * what the game itself draws.
 *
 * Keyed on the resolved asset URL rather than on a kind, because by the time
 * this applies the branches below have already decided which voucher an item
 * gets and the only question left is which cut of it to show.
 */
const neutralVoucher = new Map<string, string>()

;['defender', 'hero', 'manager', 'melee', 'ranged', 'trap', 'worker'].forEach(
  (kind) => {
    const neutral = assets(`voucher_generic_${kind}`)

    if (!neutral) {
      return
    }

    Object.values(RarityType).forEach((token) => {
      const tinted = assets(`voucher_generic_${kind}_${voucherRarity(token)}`)

      if (tinted) {
        neutralVoucher.set(tinted, neutral)
      }
    })
  }
)

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
  /** The same art at detail-view size, when a bigger export exists. */
  largeImgUrl: string | undefined
  name: string
  rarity: string
  /** True when `name` is better than whatever the caller decoded. */
  preferName: boolean
}

/**
 * Resolved art, kept.
 *
 * `parseResource` linearly scans four JSON blobs with `key.includes(id)`, and
 * a vault shelf asks for the same few hundred template ids on *every* render
 * — so ticking one tile used to re-derive the art for all of them. The cache
 * hangs off the database object itself, so it is dropped when the database is
 * replaced and never has to be invalidated by hand.
 */
const artCaches = new WeakMap<ItemRecordMap, Map<string, ItemArt>>()
const artCacheWithoutRecords = new Map<string, ItemArt>()

function artCacheFor(records?: ItemRecordMap) {
  if (!records) {
    return artCacheWithoutRecords
  }

  let cache = artCaches.get(records)

  if (!cache) {
    cache = new Map()
    artCaches.set(records, cache)
  }

  return cache
}

/**
 * @param records the item database, when it has loaded. Passing it swaps the
 *   generic voucher art and decoded names for the game's own.
 * @param portrait a survivor's `WorkerPortrait:` template id, from the profile
 *   item's `portrait` attribute. See `computeItemArt`.
 */
export function resolveItemArt(
  templateId: string,
  records?: ItemRecordMap,
  portrait?: string | null
): ItemArt {
  const cache = artCacheFor(records)
  const key = portrait ? `${templateId}\u0000${portrait}` : templateId
  const cached = cache.get(key)

  if (cached) {
    return cached
  }

  const art = computeItemArt(templateId, records, portrait)

  cache.set(key, art)

  return art
}

function computeItemArt(
  templateId: string,
  records?: ItemRecordMap,
  portrait?: string | null
): ItemArt {
  const resource = parseResource({ key: templateId, quantity: 1 })
  const record = records ? getItemRecord(records, templateId) : null
  /*
   * A survivor's template id says only what grade of survivor it is — every
   * unnamed one shares a handful of ids, and PegLeg gives all of them the same
   * `GenericWorker.png`. The face is per-copy and lives on the profile item, in
   * `portrait`, pointing at one of the 95 `WorkerPortrait:` rows. That row is
   * the only place the real picture exists, so it outranks the item's own.
   */
  const portraitRecord =
    records && portrait ? getPortraitRecord(records, portrait) : null
  /*
   * A mythic hero's template id says `sr` — the Legendary token — so the id
   * alone paints MEGA B.A.S.E. Kyle orange while the dialog beside it reads
   * "Mythic". The database is the one that knows; take its word for the plate
   * and the accent both.
   */
  const rarity = record
    ? (rarityTypeFromName(record.rarity) ?? resource.rarity)
    : resource.rarity
  /*
   * A quest gets no plate. It is not a graded item — 2,261 of the 2,416 the
   * database knows carry no rarity at all — so a rarity plate behind one says
   * nothing, and `resolveAccent` already refuses it a ring for the same
   * reason. It also actively hurts: quest art is a white glyph cut for a dark
   * background, and the Common plate it would otherwise default to is pale
   * grey, which leaves a journal or a calendar barely visible.
   */
  const plated = !templateId.startsWith('Quest:')
  const large = usableImage(portraitRecord?.largeImage ?? record?.largeImage)
  const small = usableImage(portraitRecord?.image ?? record?.image)
  /** Heroes read better as the portrait than as the head-and-shoulders chip. */
  const image = templateId.startsWith('Hero:') ? (large ?? small) : small

  if (image) {
    return {
      accent: resolveAccent(templateId, { ...resource, rarity }),
      frame: plated ? assets(frameByRarity[rarity] ?? 'c') : undefined,
      imgUrl: peglegImageURL(image),
      largeImgUrl: large ? peglegImageURL(large) : undefined,
      name: record?.name ?? resource.name,
      rarity,
      /** The database name beats anything we decode ourselves. */
      preferName: true,
    }
  }

  /*
   * The plate is still worth computing when it is not going to be drawn: it is
   * also what `parseResource` returns when it recognised nothing, so it is how
   * "no art" is spelled further down.
   */
  const plate = assets(frameByRarity[rarity] ?? 'c')
  const frame = plated ? plate : undefined
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
        assets(`voucher_generic_${kind}_${voucherRarity(rarity)}`) ?? imgUrl
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

  /*
   * Quests are the one family the database routinely holds no art for — every
   * Wargames simulation and prerequisite comes through with a null image — and
   * a quest that draws no plate either would be an empty box. The journal is
   * the game's own default quest icon and the app already ships it, so that is
   * what an artless quest gets.
   */
  if (!plated && (!imgUrl || imgUrl === plate)) {
    imgUrl = assets('quest') ?? imgUrl
  }

  /*
   * Last, because every branch above picks a voucher and none of them care
   * which cut of it ends up on screen.
   */
  if (imgUrl) {
    imgUrl = neutralVoucher.get(imgUrl) ?? imgUrl
  }

  return {
    accent: resolveAccent(templateId, { ...resource, rarity }),
    frame,
    /** Nothing matched, so the plate is the whole picture. */
    imgUrl: imgUrl === plate ? undefined : imgUrl,
    largeImgUrl: undefined,
    /** A record that only lacked art still knows what the thing is called. */
    name: record?.name ?? resource.name,
    rarity,
    preferName: record ? true : !decodablePrefix.test(templateId),
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
  portrait,
  quantity,
  records,
  size = 'default',
  templateId,
  tier,
  title,
}: {
  className?: string
  /** Survivors: the `WorkerPortrait:` id this copy rolled. */
  portrait?: string | null
  /** Rendered as a corner badge when above 1. */
  quantity?: number
  records?: ItemRecordMap
  size?: 'small' | 'default' | 'large' | 'xl'
  templateId: string
  /** Rendered as a corner pip when above 0. */
  tier?: number
  title?: string
}) {
  const art = resolveItemArt(templateId, records, portrait)
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
