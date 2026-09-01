import { describe, expect, it } from 'vitest'

import {
  buildSpriteCollection,
  parseRelicId,
  prettifyFamily,
  variantLabel,
} from './sprite-collection'

const data = {
  families: {
    Water: {
      name: 'Water',
      rarity: 'rare',
      season: 'c7s3',
      ability: 'Replenishes shields while in water.',
      icons: {
        base: 'https://example.test/water.webp',
        gold: 'https://example.test/water-gold.webp',
      },
    },
    Klombo: {
      name: 'Klombo',
      rarity: 'mythic',
      season: 'c7s4',
      ability: 'Grants a random item at each level.',
      icons: { base: 'https://example.test/klombo.webp' },
    },
  },
}

const catalog = {
  Water_Variant_Base: {
    templateId: 'ExtractableRelic:water_variant_base',
    attributes: { bIsStarter: true, summonCost: 100 },
  },
  Water_Variant_Gold: {
    templateId: 'ExtractableRelic:water_variant_gold',
    attributes: { bIsStarter: false, summonCost: 2700 },
  },
  Water_Variant_Galaxy: {
    attributes: { summonCost: 2700 },
  },
  Klombo_Variant_A: {
    attributes: { summonCost: 2000 },
  },
  Klombo_Variant_CheatMaster: {
    attributes: { summonCost: 2400 },
  },
  BushRangerSprite_Variation_A: {
    attributes: { summonCost: 100 },
  },
  Secret_Variant_A: {
    _private: true,
  },
  Currency_ExtractionPoints: {
    attributes: {},
  },
}

const inventory = {
  inventory: [
    {
      moduleId: '70329e8f-f377-4a73-90cf-76b7ace87a07',
      counts: {
        Water_Variant_Base: 2,
        Water_Variant_Gold: 2,
        Water_Variant_Galaxy: 1,
        Klombo_Variant_A: 2,
        Currency_ExtractionPoints: 4200,
      },
      entitlementMetadata: {
        Water_Variant_Base: '{"xp":15000,"ml":true}',
        Water_Variant_Gold: '{"xp":300,"ml":0}',
        Klombo_Variant_A: 'not json',
      },
      metadata: '{"StarterRelic":"Water_Variant_Base","EquippedVariant":"Water_Variant_Gold"}',
    },
  ],
}

describe('parseRelicId', () => {
  it('splits family from treatment and normalises the base spellings', () => {
    expect(parseRelicId('Water_Variant_Base')).toEqual({
      family: 'Water',
      variant: 'base',
    })
    expect(parseRelicId('Klombo_Variant_A')).toEqual({
      family: 'Klombo',
      variant: 'base',
    })
    expect(parseRelicId('BurntPeanut_Variation_A')).toEqual({
      family: 'BurntPeanut',
      variant: 'base',
    })
    expect(parseRelicId('SleepySprite_Variant_Galactic')).toEqual({
      family: 'SleepySprite',
      variant: 'galaxy',
    })
    expect(parseRelicId('Klombo_Variant_CheatMaster')).toEqual({
      family: 'Klombo',
      variant: 'cheatmaster',
    })
  })

  it('treats an id with no separator as a base relic of its own family', () => {
    expect(parseRelicId('Mystery')).toEqual({
      family: 'Mystery',
      variant: 'base',
    })
  })
})

describe('labels', () => {
  it('names treatments the way the game does', () => {
    expect(variantLabel('candy')).toBe('Gummy')
    expect(variantLabel('cheatmaster')).toBe('Cheat Master')
    expect(variantLabel('shiny')).toBe('Shiny')
  })

  it('makes a readable name from an unknown family id', () => {
    expect(prettifyFamily('BushRangerSprite')).toBe('Bush Ranger')
    expect(prettifyFamily('CosmicThunderDoubleJumpSprite')).toBe(
      'Cosmic Thunder Double Jump'
    )
    expect(prettifyFamily('8BitBlaster')).toBe('8 Bit Blaster')
  })
})

describe('buildSpriteCollection', () => {
  const collection = buildSpriteCollection(catalog, inventory, data)

  it('keeps every public catalogue relic and drops currency and private ones', () => {
    expect(collection.totalVariants).toBe(6)
    expect(
      collection.families.flatMap((family) =>
        family.variants.map((item) => item.relicId)
      )
    ).not.toContain('Secret_Variant_A')
  })

  it('sorts families rarest first and treatments in game order', () => {
    expect(collection.families.map((family) => family.name)).toEqual([
      'Klombo',
      'Water',
      'Bush Ranger',
    ])
    expect(
      collection.families[1].variants.map((item) => item.variant)
    ).toEqual(['base', 'gold', 'galaxy'])
  })

  it('reads ownership, xp, mastery and the equipped relic from the inventory', () => {
    /* Counts are states: 2 = owned, 1 = lost in the field, absent = never. */
    const water = collection.families.find((family) => family.name === 'Water')
    const [base, gold, galaxy] = water?.variants ?? []

    expect(base).toMatchObject({
      status: 'owned',
      owned: true,
      xp: 15000,
      mastered: true,
      equipped: false,
      starter: true,
      summonCost: 100,
      iconFile: 'https://example.test/water.webp',
    })
    expect(gold).toMatchObject({
      status: 'owned',
      owned: true,
      xp: 300,
      mastered: false,
      equipped: true,
      iconFile: 'https://example.test/water-gold.webp',
    })
    expect(galaxy).toMatchObject({
      status: 'lost',
      owned: false,
      lost: true,
      xp: null,
      mastered: false,
      /* No galaxy art in the data — the base picture stands in. */
      iconFile: 'https://example.test/water.webp',
    })
    expect(water?.ownedCount).toBe(2)
    expect(water?.lostCount).toBe(1)
    expect(water?.complete).toBe(false)
  })

  it('survives unparseable entitlement metadata', () => {
    const klombo = collection.families.find(
      (family) => family.name === 'Klombo'
    )

    expect(klombo?.variants[0]).toMatchObject({
      status: 'owned',
      owned: true,
      xp: null,
      mastered: false,
    })
  })

  it('falls back to a made-up name when the data file has no entry', () => {
    const bush = collection.families.find(
      (family) => family.family === 'BushRangerSprite'
    )

    expect(bush?.variants[0].status).toBe('missing')
    expect(bush).toMatchObject({
      name: 'Bush Ranger',
      rarity: 'common',
      iconFile: null,
    })
    expect(bush?.variants[0].resolved).toBe(false)
  })

  it('totals the collection', () => {
    expect(collection).toMatchObject({
      ownedVariants: 3,
      lostVariants: 1,
      masteredVariants: 1,
      spriteDust: 4200,
      equippedRelicId: 'Water_Variant_Gold',
    })
  })

  it('unions bundled treatments the live catalogue lacks', () => {
    /* Live getBackendCatalog only lists what is summonable right now. */
    const partial = {
      Water_Variant_Base: { attributes: { summonCost: 100 } },
    }
    const built = buildSpriteCollection(partial, null, data)
    const water = built.families.find((family) => family.name === 'Water')

    expect(built.totalVariants).toBe(3)
    expect(water?.variants.map((item) => item.variant)).toEqual([
      'base',
      'gold',
    ])

    const gold = water?.variants[1]

    expect(gold).toMatchObject({
      relicId: 'Water_Variant_Gold',
      summonCost: null,
      iconFile: 'https://example.test/water-gold.webp',
    })
  })

  it('matches inventory by creature and treatment, not raw id spelling', () => {
    const built = buildSpriteCollection(
      { Water_Variant_Gold: { attributes: { summonCost: 2700 } } },
      {
        inventory: [
          {
            counts: { Water_Variation_Gold: 2 },
            entitlementMetadata: { Water_Variation_Gold: '{"xp":9,"ml":1}' },
            metadata: '{"EquippedVariant":"Water_Variation_Gold"}',
          },
        ],
      },
      data
    )
    const gold = built.families
      .flatMap((family) => family.variants)
      .find((item) => item.relicId === 'Water_Variant_Gold')

    expect(gold).toMatchObject({
      owned: true,
      mastered: true,
      equipped: true,
      xp: 9,
    })
  })

  it('reads leftover XP with no count as a lost sprite', () => {
    /* Losing a relic clears its count but the XP entitlement survives. */
    const built = buildSpriteCollection(
      { Klombo_Variant_A: { attributes: { summonCost: 2000 } } },
      {
        inventory: [
          {
            counts: {},
            entitlementMetadata: { Klombo_Variant_A: '{"xp":500,"ml":0}' },
          },
        ],
      },
      data
    )
    const klombo = built.families
      .flatMap((family) => family.variants)
      .find((item) => item.relicId === 'Klombo_Variant_A')

    expect(klombo).toMatchObject({
      status: 'lost',
      lost: true,
      owned: false,
      xp: 500,
    })
    expect(built.lostVariants).toBe(1)
  })

  it('treats a missing inventory as an empty collection', () => {
    const empty = buildSpriteCollection(catalog, null, data)

    expect(empty.ownedVariants).toBe(0)
    expect(empty.lostVariants).toBe(0)
    expect(empty.spriteDust).toBeNull()
    expect(empty.equippedRelicId).toBeNull()
    expect(empty.totalVariants).toBe(6)
  })
})
