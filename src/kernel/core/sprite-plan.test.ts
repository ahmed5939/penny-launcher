import type {
  SpriteCollection,
  SpriteEntry,
  SpriteFamilySummary,
} from './sprite-collection'

import { describe, expect, it } from 'vitest'

import { planSpriteRecovery } from './sprite-plan'

function entry(
  family: string,
  variant: string,
  status: SpriteEntry['status'],
  summonCost: number | null
): SpriteEntry {
  return {
    relicId: `${family}_Variant_${variant}`,
    family,
    familyName: family,
    variant,
    variantLabel: variant,
    rarity: 'rare',
    season: null,
    ability: null,
    iconFile: null,
    summonCost,
    starter: false,
    status,
    owned: status === 'owned',
    lost: status === 'lost',
    xp: null,
    mastered: false,
    equipped: false,
    resolved: true,
  }
}

function family(name: string, variants: Array<SpriteEntry>): SpriteFamilySummary {
  const ownedCount = variants.filter((item) => item.owned).length

  return {
    family: name,
    name,
    rarity: 'rare',
    season: null,
    ability: null,
    iconFile: null,
    variants,
    ownedCount,
    lostCount: variants.filter((item) => item.lost).length,
    complete: ownedCount === variants.length,
  }
}

function collection(
  families: Array<SpriteFamilySummary>,
  spriteDust: number | null
): SpriteCollection {
  const all = families.flatMap((item) => item.variants)

  return {
    families,
    totalVariants: all.length,
    ownedVariants: all.filter((item) => item.owned).length,
    lostVariants: all.filter((item) => item.lost).length,
    masteredVariants: 0,
    spriteDust,
    equippedRelicId: null,
  }
}

const water = family('Water', [
  entry('Water', 'base', 'owned', 100),
  entry('Water', 'gold', 'lost', 2700),
  entry('Water', 'galaxy', 'lost', 900),
])
const air = family('Air', [
  entry('Air', 'base', 'lost', 100),
  entry('Air', 'gold', 'lost', null),
  entry('Air', 'candy', 'missing', 400),
  entry('Air', 'gem', 'missing', 400),
])
const klombo = family('Klombo', [
  entry('Klombo', 'base', 'owned', 2000),
  entry('Klombo', 'cheatmaster', 'missing', 2400),
])

describe('planSpriteRecovery', () => {
  it('orders lost sprites cheapest first with unknown costs last', () => {
    const plan = planSpriteRecovery(collection([water, air, klombo], 1500))

    expect(plan.lost.map((step) => step.entry.relicId)).toEqual([
      'Air_Variant_base',
      'Water_Variant_galaxy',
      'Water_Variant_gold',
      'Air_Variant_gold',
    ])
    expect(plan.lost.map((step) => step.cumulative)).toEqual([
      100,
      1000,
      3700,
      null,
    ])
  })

  it('marks the prefix the balance covers as affordable', () => {
    const plan = planSpriteRecovery(collection([water, air], 1500))

    expect(plan.lost.map((step) => step.affordable)).toEqual([
      true,
      true,
      false,
      false,
    ])
    expect(plan.affordableCount).toBe(2)
    expect(plan.totalCost).toBe(3700)
    expect(plan.unknownCostCount).toBe(1)
  })

  it('counts an exact balance as enough', () => {
    const plan = planSpriteRecovery(collection([water], 3600))

    expect(plan.affordableCount).toBe(2)
  })

  it('never counts an unknown cost as affordable, however much dust there is', () => {
    const plan = planSpriteRecovery(collection([air], 1_000_000))

    expect(plan.lost.find((step) => step.cost === null)?.affordable).toBe(false)
    expect(plan.affordableCount).toBe(1)
  })

  it('affords nothing when the balance is unknown, and says so with null', () => {
    const plan = planSpriteRecovery(collection([water, air], null))

    expect(plan.dust).toBeNull()
    expect(plan.affordableCount).toBe(0)
    expect(plan.lost.every((step) => !step.affordable)).toBe(true)
  })

  it('lists families with an owned treatment and one or two left to get', () => {
    const plan = planSpriteRecovery(collection([water, air, klombo], 0))

    expect(plan.almostComplete.map((item) => item.family.family)).toEqual([
      'Klombo',
      'Water',
    ])
    // Lost treatments first (recoverable now), cheapest first.
    expect(
      plan.almostComplete[1].needs.map((item) => item.relicId)
    ).toEqual(['Water_Variant_galaxy', 'Water_Variant_gold'])
  })

  it('leaves out complete families and ones with nothing owned', () => {
    const complete = family('Duck', [entry('Duck', 'base', 'owned', 100)])
    const plan = planSpriteRecovery(collection([complete, air], 0))

    expect(plan.almostComplete).toEqual([])
  })
})
