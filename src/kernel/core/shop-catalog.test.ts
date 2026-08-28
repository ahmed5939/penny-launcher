import { describe, expect, it } from 'vitest'

import { parsePennyDBShop } from './shop-catalog'

describe('parsePennyDBShop', () => {
  it('keeps known storefronts in display order and drops offers without an id', () => {
    const storefronts = parsePennyDBShop({
      storefronts: {
        cpspgp_storefront: [
          {
            offerId: 'gameplay-1',
            name: 'Mini Reward Llama',
            price: 1,
            currency_readable: 'Mini Reward Llama',
          },
        ],
        llamas_storefront: [
          {
            offerId: 'llama-1',
            title: 'Upgrade Llama',
            name: 'Upgrade Llama',
            price: 50,
            currency: 'AccountResource:currency_xrayllama',
            currency_readable: 'X-Ray Tickets',
            dailyLimit: 50,
            image_link: 'https://example.test/upgrade.png',
          },
          {
            name: 'Missing id',
            price: 1,
          },
        ],
        extra_shelf_storefront: [
          {
            offerId: 'extra-1',
            name: 'Bonus',
            price: 10,
          },
        ],
      },
    })

    expect(storefronts.map((storefront) => storefront.id)).toEqual([
      'llamas_storefront',
      'cpspgp_storefront',
      'extra_shelf_storefront',
    ])
    expect(storefronts[0].label).toBe('X-Ray Llamas')
    expect(storefronts[1].label).toBe('Gameplay')
    expect(storefronts[2].label).toBe('Extra Shelf')
    expect(storefronts[0].offers).toHaveLength(1)
    expect(storefronts[0].offers[0]).toMatchObject({
      offerId: 'llama-1',
      name: 'Upgrade Llama',
      price: 50,
      currencyLabel: 'X-Ray Tickets',
      imageUrl: 'https://example.test/upgrade.png',
      dailyLimit: 50,
    })
  })

  it('prefers a readable name over Epic internal titles', () => {
    const [storefront] = parsePennyDBShop({
      storefronts: {
        stw_storefront: [
          {
            offerId: 'gold-1',
            title: '[VIRTUAL]1 x Copper Judge for 600 GameItem : AccountResource:eventcurrency_scaling',
            name: 'Judge',
            price: 600,
            currency: 'AccountResource:eventcurrency_scaling',
            weeklyLimit: 1,
          },
        ],
      },
    })

    expect(storefront.label).toBe('Weekly Store')
    expect(storefront.offers[0].name).toBe('Judge')
    expect(storefront.offers[0].currencyLabel).toBe('Gold')
    expect(storefront.offers[0].weeklyLimit).toBe(1)
  })

  it('returns an empty list when PennyDB sends nothing', () => {
    expect(parsePennyDBShop(undefined)).toEqual([])
    expect(parsePennyDBShop({ storefronts: {} })).toEqual([])
  })
})
