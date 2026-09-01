import type {
  SpriteCatalogResponse,
  SpriteEntitlement,
  SpriteInventoryResponse,
  SpriteModuleMetadata,
} from '../../types/services/sprites'

import spriteData from '../../data/sprites.json'

/**
 * Sprites — the collectible companions Battle Royale added in Chapter 7.
 *
 * To the backend a sprite is a *relic*: `Water_Variant_Gold` is the gold
 * Water sprite, `Klombo_Variant_CheatMaster` the Cheat Master Klombo. The
 * part before `_Variant_` is the *family* — one creature — and the part after
 * is its treatment. Epic never publishes a name or a picture for either, so
 * those come from `data/sprites.json`, keyed by family, and anything the
 * file has not caught up with is shown under a name made from its id.
 *
 * Pure on purpose — nothing here touches Electron or the network — so the
 * join is testable. `Sprites` in `sprites.ts` does the fetching.
 */

export type SpriteVariantKey =
  | 'base'
  | 'gold'
  | 'candy'
  | 'galaxy'
  | 'gem'
  | 'holofoil'
  | 'cube'
  | 'quack'
  | 'cheatmaster'
  | string

export type SpriteFamilyData = {
  name: string
  rarity: string
  season: string | null
  ability: string | null
  icons: Partial<Record<SpriteVariantKey, string>>
}

export type SpriteData = {
  families: Record<string, SpriteFamilyData>
}

/**
 * `counts` in the inventory is a state, not a quantity: absent means the
 * account has never secured the relic, `1` that it was encountered but is
 * not held — a sprite lost in the field, recoverable for its summon cost —
 * and `2` that it is owned outright. Both community emulators write `2` for
 * "owned" and ship default collections of `1`s. A relic with no count at
 * all but leftover XP metadata was also held once, so it too reads as lost
 * rather than never-seen.
 */
export type SpriteStatus = 'owned' | 'lost' | 'missing'

export type SpriteEntry = {
  /** `Water_Variant_Gold` — the id the backend uses everywhere. */
  relicId: string
  family: string
  familyName: string
  variant: SpriteVariantKey
  variantLabel: string
  rarity: string
  season: string | null
  ability: string | null
  /** File name inside `assets/images/sprites/`, or null when art is unknown. */
  iconFile: string | null
  summonCost: number | null
  /** Handed out on first login rather than found. */
  starter: boolean
  status: SpriteStatus
  owned: boolean
  /** Encountered but not secured — buy it back for `summonCost` dust. */
  lost: boolean
  xp: number | null
  mastered: boolean
  equipped: boolean
  /** False when `data/sprites.json` has nothing on this family. */
  resolved: boolean
}

export type SpriteFamilySummary = {
  family: string
  name: string
  rarity: string
  season: string | null
  ability: string | null
  iconFile: string | null
  variants: Array<SpriteEntry>
  ownedCount: number
  lostCount: number
  /** Every treatment of this creature is on the account. */
  complete: boolean
}

export type SpriteCollection = {
  families: Array<SpriteFamilySummary>
  totalVariants: number
  ownedVariants: number
  lostVariants: number
  masteredVariants: number
  /**
   * Sprite Dust — `Currency_ExtractionPoints` to the backend — the currency
   * that summons a relic back. Null when the inventory did not say.
   */
  spriteDust: number | null
  equippedRelicId: string | null
}

const currencyRelicId = 'Currency_ExtractionPoints'

/** How the backend spells each treatment, and how the game does. */
const variantLabels: Record<string, string> = {
  base: 'Base',
  gold: 'Gold',
  candy: 'Gummy',
  galaxy: 'Galaxy',
  gem: 'Gem',
  holofoil: 'Holofoil',
  cube: 'Cube',
  quack: 'Quack',
  cheatmaster: 'Cheat Master',
}

const variantOrder = [
  'base',
  'gold',
  'cheatmaster',
  'candy',
  'galaxy',
  'gem',
  'holofoil',
  'cube',
  'quack',
]

const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']

/**
 * `Water_Variant_Gold` → `{ family: 'Water', variant: 'gold' }`.
 *
 * Two spellings of the separator exist (`_Variant_` and `_Variation_`), the
 * base treatment is `A` for most families and `Base` for one, and one
 * family spells Galaxy as `Galactic`. All of that is flattened here so the
 * rest of the module only ever sees one key per treatment.
 */
export function parseRelicId(relicId: string) {
  const match = relicId.match(/^(.+?)_(?:Variant|Variation)_([A-Za-z0-9]+)$/)

  if (!match) {
    return { family: relicId, variant: 'base' as SpriteVariantKey }
  }

  const raw = match[2].toLowerCase()
  const variant =
    raw === 'a' || raw === 'base'
      ? 'base'
      : raw === 'galactic'
        ? 'galaxy'
        : raw

  return { family: match[1], variant: variant as SpriteVariantKey }
}

export function variantLabel(variant: SpriteVariantKey) {
  return (
    variantLabels[variant] ??
    variant.charAt(0).toUpperCase() + variant.slice(1)
  )
}

/** `BushRangerSprite` → `Bush Ranger`, for families the data file lacks. */
export function prettifyFamily(family: string) {
  return (
    family
      .replace(/Sprite$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .trim() || family
  )
}

function parseJson<T>(value: string | undefined | null): T | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function variantRank(variant: string) {
  const index = variantOrder.indexOf(variant)

  return index < 0 ? variantOrder.length : index
}

function rarityRank(rarity: string) {
  const index = rarityOrder.indexOf(rarity)

  return index < 0 ? rarityOrder.length : index
}

/**
 * The suffix the backend most often uses for a treatment, for synthesising a
 * relic id when a bundled sprite is absent from the live catalogue. Real ids
 * vary (`A` vs `Base`, `Variant` vs `Variation`), which is why *matching*
 * never uses raw ids — only display and equip payloads want one.
 */
const variantSuffixes: Record<string, string> = {
  base: 'A',
  gold: 'Gold',
  candy: 'Candy',
  galaxy: 'Galaxy',
  gem: 'Gem',
  holofoil: 'Holofoil',
  cube: 'Cube',
  quack: 'Quack',
  cheatmaster: 'CheatMaster',
}

function syntheticRelicId(family: string, variant: string) {
  return `${family}_Variant_${variantSuffixes[variant] ?? variantLabel(variant).replace(/ /g, '')}`
}

/** One key per creature-and-treatment, however the backend spelled it. */
function stateKey(relicId: string) {
  const { family, variant } = parseRelicId(relicId)

  return `${family}::${variant}`
}

/**
 * Joins the catalogue with the account's inventory.
 *
 * The spine is the *union* of the live catalogue and the bundled data file:
 * the live `getBackendCatalog` only lists what is currently summonable — a
 * handful of families, some missing treatments — while the data file knows
 * every sprite ever released. A relic in either source is a row; only the
 * live ones carry a summon cost.
 *
 * Inventory state is matched on parsed family + treatment rather than the
 * raw relic id, because the two backends spell the same relic differently
 * (`Water_Variant_Base` vs `Water_Variation_A` style drift).
 *
 * Families are sorted rarest first, then by name; treatments within a family
 * in the order the game lists them.
 */
export function buildSpriteCollection(
  catalog: SpriteCatalogResponse,
  inventory: SpriteInventoryResponse | null,
  data: SpriteData = spriteData as SpriteData
): SpriteCollection {
  const counts = new Map<string, number>()
  const entitlements = new Map<string, SpriteEntitlement>()
  let equippedRelicId: string | null = null
  let extractionPoints: number | null = null

  inventory?.inventory?.forEach((module) => {
    Object.entries(module.counts ?? {}).forEach(([relicId, count]) => {
      if (relicId === currencyRelicId) {
        extractionPoints = (extractionPoints ?? 0) + (count ?? 0)

        return
      }

      const key = stateKey(relicId)

      counts.set(key, Math.max(counts.get(key) ?? 0, count ?? 0))
    })

    Object.entries(module.entitlementMetadata ?? {}).forEach(
      ([relicId, raw]) => {
        const parsed = parseJson<SpriteEntitlement>(raw)

        if (parsed) {
          entitlements.set(stateKey(relicId), parsed)
        }
      }
    )

    const metadata = parseJson<SpriteModuleMetadata>(module.metadata)

    if (
      metadata?.EquippedVariant &&
      metadata.EquippedVariant !== 'None'
    ) {
      equippedRelicId = metadata.EquippedVariant
    }
  })

  const equippedKey = equippedRelicId ? stateKey(equippedRelicId) : null

  type SpineEntry = {
    relicId: string
    family: string
    variant: SpriteVariantKey
    summonCost: number | null
    starter: boolean
  }

  const spine = new Map<string, SpineEntry>()

  Object.entries(catalog).forEach(([relicId, entry]) => {
    if (relicId === currencyRelicId || entry?._private) {
      return
    }

    const { family, variant } = parseRelicId(relicId)

    spine.set(stateKey(relicId), {
      relicId,
      family,
      variant,
      summonCost: entry?.attributes?.summonCost ?? null,
      starter: entry?.attributes?.bIsStarter ?? false,
    })
  })

  Object.entries(data.families).forEach(([family, known]) => {
    Object.keys(known.icons).forEach((variant) => {
      const key = `${family}::${variant}`

      if (!spine.has(key)) {
        spine.set(key, {
          relicId: syntheticRelicId(family, variant),
          family,
          variant,
          summonCost: null,
          starter: false,
        })
      }
    })
  })

  const byFamily = new Map<string, Array<SpriteEntry>>()

  spine.forEach((entry, key) => {
    const { family, variant } = entry
    const known = data.families[family]
    const count = counts.get(key) ?? 0
    const entitlementProbe = entitlements.get(key)
    const status: SpriteStatus =
      count >= 2
        ? 'owned'
        : count === 1 || entitlementProbe !== undefined
          ? 'lost'
          : 'missing'
    const entitlement = entitlements.get(key)
    const mastered =
      entitlement?.ml === true ||
      (typeof entitlement?.ml === 'number' && entitlement.ml > 0)

    const sprite: SpriteEntry = {
      relicId: entry.relicId,
      family,
      familyName: known?.name ?? prettifyFamily(family),
      variant,
      variantLabel: variantLabel(variant),
      rarity: known?.rarity ?? 'common',
      season: known?.season ?? null,
      ability: known?.ability ?? null,
      iconFile: known?.icons[variant] ?? known?.icons.base ?? null,
      summonCost: entry.summonCost,
      starter: entry.starter,
      status,
      owned: status === 'owned',
      lost: status === 'lost',
      xp: typeof entitlement?.xp === 'number' ? entitlement.xp : null,
      mastered,
      equipped: equippedKey === key,
      resolved: Boolean(known),
    }

    const list = byFamily.get(family) ?? []

    list.push(sprite)
    byFamily.set(family, list)
  })

  const families: Array<SpriteFamilySummary> = [...byFamily.entries()].map(
    ([family, variants]) => {
      variants.sort(
        (a, b) =>
          variantRank(a.variant) - variantRank(b.variant) ||
          a.variantLabel.localeCompare(b.variantLabel)
      )

      const base = variants.find((item) => item.variant === 'base') ?? variants[0]
      const ownedCount = variants.filter((item) => item.owned).length
      const lostCount = variants.filter((item) => item.lost).length

      return {
        family,
        name: base.familyName,
        rarity: base.rarity,
        season: base.season,
        ability: base.ability,
        iconFile: base.iconFile,
        variants,
        ownedCount,
        lostCount,
        complete: ownedCount === variants.length,
      }
    }
  )

  families.sort(
    (a, b) =>
      rarityRank(a.rarity) - rarityRank(b.rarity) ||
      a.name.localeCompare(b.name)
  )

  const all = families.flatMap((family) => family.variants)

  return {
    families,
    totalVariants: all.length,
    ownedVariants: all.filter((item) => item.owned).length,
    lostVariants: all.filter((item) => item.lost).length,
    masteredVariants: all.filter((item) => item.mastered).length,
    spriteDust: extractionPoints,
    equippedRelicId,
  }
}
