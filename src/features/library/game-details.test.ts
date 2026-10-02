import { describe, expect, it } from 'vitest'

import { isNamespace, parseCritic, parseRating, parseStoreSlug } from './game-details'

// As the store answered for Hogwarts Legacy on 2026-10-02.
describe('game details', () => {
  it('reads the store slug from the namespace mappings', () => {
    expect(parseStoreSlug({ data: { Catalog: { catalogNs: { mappings: [{ pageSlug: 'hogwarts-legacy', pageType: 'productHome' }] } } } })).toBe('hogwarts-legacy')
    expect(parseStoreSlug({ data: { Catalog: { catalogNs: { mappings: [] } } } })).toBeNull()
  })

  it('reads the star rating and the most voted traits', () => {
    const rating = parseRating({
      data: {
        RatingsPolls: {
          getProductResult: {
            averageRating: 4.66,
            pollResult: [
              { localizations: { resultTitle: 'Great Boss Battles' }, total: 100 },
              { localizations: { resultTitle: 'Character Customization' }, total: 281969 },
              { localizations: {}, total: 5 },
            ],
          },
        },
      },
    })

    expect(rating).toEqual({
      rating: 4.66,
      polls: [
        { title: 'Character Customization', total: 281969 },
        { title: 'Great Boss Battles', total: 100 },
      ],
    })
    expect(parseRating({ data: { RatingsPolls: { getProductResult: null } } })).toEqual({ rating: null, polls: [] })
  })

  it('reads OpenCritic, keeping only its own links', () => {
    expect(
      parseCritic({
        data: {
          OpenCritic: {
            productReviews: { openCriticScore: 84, reviewCount: 181, percentRecommended: 88, award: 'Mighty', openCriticUrl: 'https://opencritic.com/game/13898/hogwarts-legacy' },
          },
        },
      })
    ).toEqual({ score: 84, reviews: 181, recommended: 88, tier: 'Mighty', url: 'https://opencritic.com/game/13898/hogwarts-legacy' })
    expect(parseCritic({ data: { OpenCritic: { productReviews: { openCriticUrl: 'https://evil.example' } } } })?.url).toBeNull()
    expect(parseCritic({ data: { OpenCritic: { productReviews: null } } })).toBeNull()
  })

  it('accepts only plain namespaces', () => {
    expect(isNamespace('e97659b501af4e3981d5430dad170911')).toBe(true)
    expect(isNamespace('a/b')).toBe(false)
  })
})
