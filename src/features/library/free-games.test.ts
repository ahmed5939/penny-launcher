import { describe, expect, it } from 'vitest'

import { parseFreeGames, storePageUrl } from './free-games'

// Cut from `Catalog.searchStore(category: "freegames")`, 2026-10-02.
const promo = (startDate: string, endDate: string, discountPercentage: number) => ({
  promotionalOffers: [{ startDate, endDate, discountSetting: { discountType: 'PERCENTAGE', discountPercentage } }],
})
const element = (id: string, title: string, extra: Record<string, unknown>) => ({
  id,
  namespace: `${id}-ns`,
  title,
  productSlug: null,
  keyImages: [{ type: 'OfferImageTall', url: `https://cdn1.epicgames.com/${id}` }],
  price: { totalPrice: { discountPrice: 0, originalPrice: 2999, fmtPrice: { originalPrice: '$29.99', discountPrice: '0' } } },
  ...extra,
})
const reply = {
  data: {
    Catalog: {
      searchStore: {
        elements: [
          element('ss2', 'System Shock 2: 25th Anniversary Remaster', {
            catalogNs: { mappings: [{ pageSlug: 'system-shock-2-25th-anniversary-remaster-cb94d9', pageType: 'productHome' }] },
            promotions: { promotionalOffers: [promo('2026-10-01T15:00:00.000Z', '2026-10-08T15:00:00.000Z', 0)], upcomingPromotionalOffers: [] },
          }),
          element('terra', 'TerraScape', {
            productSlug: 'terrascape-2b12b1',
            promotions: { promotionalOffers: [], upcomingPromotionalOffers: [promo('2026-10-08T15:00:00.000Z', '2026-10-15T15:00:00.000Z', 0)] },
          }),
          // A sale in the same category is not a giveaway.
          element('lisa', 'LISA', {
            promotions: { promotionalOffers: [promo('2026-09-17T15:00:00.000Z', '2026-10-09T15:00:00.000Z', 50)], upcomingPromotionalOffers: [] },
          }),
          element('plain', 'Between giveaways', { promotions: null }),
        ],
      },
    },
  },
}

describe('parseFreeGames', () => {
  const now = Date.parse('2026-10-02T12:00:00.000Z')
  const { next, now: current } = parseFreeGames(reply, now)

  it('finds this week’s giveaways with their store page and regular price', () => {
    expect(current).toEqual([
      {
        offerId: 'ss2',
        namespace: 'ss2-ns',
        title: 'System Shock 2: 25th Anniversary Remaster',
        art: { tall: 'https://cdn1.epicgames.com/ss2', wide: null },
        storeUrl: 'https://store.epicgames.com/p/system-shock-2-25th-anniversary-remaster-cb94d9',
        regularPrice: '$29.99',
        startsAt: '2026-10-01T15:00:00.000Z',
        endsAt: '2026-10-08T15:00:00.000Z',
      },
    ])
  })

  it('finds next week’s, and leaves sales and quiet weeks out', () => {
    expect(next.map((game) => [game.title, game.startsAt.slice(0, 10)])).toEqual([['TerraScape', '2026-10-08']])
  })

  it('drops a giveaway that has ended', () => {
    expect(parseFreeGames(reply, Date.parse('2026-10-09T00:00:00.000Z')).now).toEqual([])
  })

  it('only builds store links from plain slugs', () => {
    expect(storePageUrl('terrascape-2b12b1')).toBe('https://store.epicgames.com/p/terrascape-2b12b1')
    expect(storePageUrl('../../evil')).toBeNull()
    expect(storePageUrl(null)).toBeNull()
  })
})
