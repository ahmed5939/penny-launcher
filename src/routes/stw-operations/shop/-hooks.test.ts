import type { ShopPurchaseNotification } from '../../../kernel/core/shop'

import { describe, expect, it } from 'vitest'

import {
  finishPendingPurchase,
  pendingOfferFor,
  purchaseToast,
  startPendingPurchase,
  type PendingPurchases,
} from './-hooks'

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

describe('pending purchases across accounts', () => {
  it('keeps A locked after A → B → A with both purchases unresolved', () => {
    let pending: PendingPurchases = new Map()

    pending = startPendingPurchase(pending, 'account-a', 'offer-1')

    // Buying on B is allowed while A's purchase is still in flight.
    expect(pendingOfferFor(pending, 'account-b')).toBeNull()

    pending = startPendingPurchase(pending, 'account-b', 'offer-2')

    // Back on A: its spinner is still on and its buy is still refused.
    expect(pendingOfferFor(pending, 'account-a')).toBe('offer-1')
    expect(pendingOfferFor(pending, 'account-b')).toBe('offer-2')
  })

  it('clears only the account that replied, whichever reply lands first', () => {
    let pending: PendingPurchases = new Map()

    pending = startPendingPurchase(pending, 'account-a', 'offer-1')
    pending = startPendingPurchase(pending, 'account-b', 'offer-2')

    pending = finishPendingPurchase(pending, 'account-b')

    expect(pendingOfferFor(pending, 'account-a')).toBe('offer-1')
    expect(pendingOfferFor(pending, 'account-b')).toBeNull()

    pending = finishPendingPurchase(pending, 'account-a')

    expect(pendingOfferFor(pending, 'account-a')).toBeNull()
  })

  it('does not change the map when a reply has no purchase behind it', () => {
    const pending: PendingPurchases = new Map([['account-a', 'offer-1']])

    expect(finishPendingPurchase(pending, 'account-b')).toBe(pending)
  })

  it('reads nothing when no account is selected', () => {
    const pending: PendingPurchases = new Map([['account-a', 'offer-1']])

    expect(pendingOfferFor(pending, null)).toBeNull()
  })
})
