import type { ShopOffer } from '../../../kernel/core/shop'
import type { ComponentProps } from 'react'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BuyButton } from './-offer-parts'

const offer = (over: Partial<ShopOffer>): ShopOffer => ({
  offerId: 'offer',
  devName: 'dev',
  title: 'Offer',
  section: 'weekly',
  currency: 'MtxCurrency',
  currencySubType: 'AccountResource:currency_mtxswap',
  currencyLabel: 'Gold',
  regularPrice: 1000,
  finalPrice: 1000,
  affordable: true,
  dailyLimit: 0,
  weeklyLimit: 0,
  monthlyLimit: 0,
  eventLimit: 0,
  purchased: 0,
  fulfillmentOwned: false,
  saleExpiration: null,
  itemGrants: [],
  preroll: null,
  sortPriority: 0,
  ...over,
})

const button = (
  over: Partial<ShopOffer>,
  props: Partial<ComponentProps<typeof BuyButton>> = {}
) =>
  renderToStaticMarkup(
    createElement(BuyButton, {
      currencyIcon: 'G',
      isPurchaseLocked: false,
      isPurchasing: false,
      offer: offer(over),
      onPurchase: () => undefined,
      ...props,
    })
  )

describe('BuyButton', () => {
  it('names the store tile strip with the price and the verb', () => {
    expect(button({})).toContain('aria-label="Buy for 1,000 Gold"')
  })

  it('names the store tile strip with why it cannot be bought', () => {
    expect(button({ affordable: false })).toContain('aria-label="Not enough Gold"')
    expect(button({ dailyLimit: 1, purchased: 1 })).toContain('aria-label="Sold out"')
    expect(button({ fulfillmentOwned: true })).toContain('aria-label="Owned"')
    expect(button({ currency: 'RealMoney' })).toContain('aria-label="Real money only"')
  })

  it('says it is buying while a purchase is in flight, on both variants', () => {
    expect(button({}, { isPurchasing: true })).toContain('aria-label="Buying…"')
    expect(button({}, { currencyIcon: undefined, isPurchasing: true })).toContain('aria-label="Buying…"')
  })

  it('leaves the full-width variant named by its text', () => {
    expect(button({}, { currencyIcon: undefined })).not.toContain('aria-label')
  })
})
