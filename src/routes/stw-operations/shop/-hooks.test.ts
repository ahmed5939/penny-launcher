import type { ShopPurchaseNotification } from '../../../kernel/core/shop'

import { describe, expect, it } from 'vitest'

import { purchaseToast } from './-hooks'

const purchase: ShopPurchaseNotification = {
  accountId: 'account-a',
  offerTitle: 'Llama Pinata',
  quantity: 1,
}

describe('purchaseToast', () => {
  it('names the account on a successful purchase', () => {
    expect(purchaseToast(purchase, 'Dragon')).toBe(
      'Bought 1× Llama Pinata on Dragon'
    )
  })

  it('names the account and says what to do on a failed purchase', () => {
    expect(
      purchaseToast({ ...purchase, errorMessage: 'Unknown Error' }, 'Dragon')
    ).toBe(
      'Could not buy Llama Pinata on Dragon. Refresh the shop and try again.'
    )
  })

  it('leaves the name out when the account is no longer in the launcher', () => {
    expect(purchaseToast(purchase, undefined)).toBe('Bought 1× Llama Pinata')
    expect(
      purchaseToast({ ...purchase, errorMessage: 'Unknown Error' }, undefined)
    ).toBe('Could not buy Llama Pinata. Refresh the shop and try again.')
  })
})
