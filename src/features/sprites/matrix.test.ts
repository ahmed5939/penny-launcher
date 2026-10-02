import type { SpriteCatalogResponse } from '../../types/services/sprites'

import { describe, expect, it } from 'vitest'

import { buildSpriteCollection } from '../../kernel/core/sprite-collection'
import { buildSpriteMatrix, filterSpriteMatrix } from './matrix'

const data = {
  families: {
    Water: {
      name: 'Water',
      rarity: 'rare',
      season: null,
      ability: 'Replenishes shields while in water.',
      icons: { base: 'water_base.webp', gold: 'water_gold.webp' },
    },
    Klombo: {
      name: 'Klombo',
      rarity: 'mythic',
      season: null,
      ability: null,
      icons: { base: 'klombo_base.webp' },
    },
  },
}

const catalog: SpriteCatalogResponse = {}

function collection(counts: Record<string, number>) {
  return buildSpriteCollection(
    catalog,
    { inventory: [{ counts }] },
    data
  )
}

const main = collection({
  Water_Variant_A: 2,
  Water_Variant_Gold: 1,
  Currency_ExtractionPoints: 300,
})
// The same base Water, spelt the other way, and no dust reported.
const alt = collection({ Water_Variation_Base: 2, Klombo_Variant_A: 1 })

describe('buildSpriteMatrix', () => {
  const matrix = buildSpriteMatrix([
    { accountId: 'main', collection: main },
    { accountId: 'alt', collection: alt },
  ])

  it('puts one sprite on one row whatever the spelling, rarest family first', () => {
    expect(matrix.families.map((family) => family.family)).toEqual([
      'Klombo',
      'Water',
    ])
    expect(matrix.families[1].rows.map((row) => row.key)).toEqual([
      'Water::base',
      'Water::gold',
    ])
    expect(matrix.families[1].rows[0].ownedBy).toBe(2)
  })

  it('counts across accounts, leaving unknown balances out of the dust sum', () => {
    expect(matrix.totals).toEqual({
      sprites: 3,
      ownedAnywhere: 1,
      lostAnywhere: 2,
      lostPairs: 2,
      dust: 300,
      dustUnknown: 1,
    })
  })

  it('says unavailable, not 0, when no account reported dust', () => {
    expect(
      buildSpriteMatrix([{ accountId: 'alt', collection: alt }]).totals.dust
    ).toBeNull()
  })

  it('filters by who owns a sprite', () => {
    const keys = (ownership: Parameters<typeof filterSpriteMatrix>[1]['ownership']) =>
      filterSpriteMatrix(matrix, { ownership, query: '', rarity: 'all' })
        .flatMap((family) => family.rows)
        .map((row) => row.key)

    expect(keys('every')).toEqual(['Water::base'])
    expect(keys('none')).toEqual(['Klombo::base', 'Water::gold'])
    expect(keys('some')).toEqual([])
    expect(keys('lost')).toEqual(['Klombo::base', 'Water::gold'])
  })

  it('searches family names, abilities and treatments, and filters by rarity', () => {
    const rows = (query: string, rarity = 'all') =>
      filterSpriteMatrix(matrix, { ownership: 'all', query, rarity })
        .flatMap((family) => family.rows)
        .map((row) => row.key)

    expect(rows('shields')).toEqual(['Water::base', 'Water::gold'])
    expect(rows('gold')).toEqual(['Water::gold'])
    expect(rows('', 'mythic')).toEqual(['Klombo::base'])
  })
})
