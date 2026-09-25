import type { ReactNode } from 'react'
import type { ShopOffer } from '../../../kernel/core/shop'

import { UpdateIcon } from '@radix-ui/react-icons'
import { useState } from 'react'

import { Button } from '../../../components/ui/button'

import { cn } from '../../../lib/utils'

/** The first limit Epic sets on an offer, or 0 when it has none. */
export function purchaseLimit(offer: ShopOffer) {
  return (
    [
      offer.dailyLimit,
      offer.weeklyLimit,
      offer.monthlyLimit,
      offer.eventLimit,
    ].find((limit) => limit > 0) ?? 0
  )
}

/** The currency art a price is drawn with, or null when there is none. */
export function priceArtId(offer: ShopOffer) {
  return offer.currency === 'MtxCurrency'
    ? 'AccountResource:currency_mtxswap'
    : offer.currencySubType || null
}

export function isSoldOut(offer: ShopOffer) {
  const limit = purchaseLimit(offer)

  return limit > 0 && offer.purchased >= limit
}

/**
 * Buy button shared by the account shop and the catalog. Spending asks
 * twice (UX standard §6): the first press turns it destructive and names
 * the price, the second buys.
 */
export function BuyButton({
  className,
  currencyIcon,
  isPurchaseLocked,
  isPurchasing,
  offer,
  onPurchase,
}: {
  className?: string
  /**
   * Draws the button as the price strip along the foot of a store tile, the
   * way the game does: the currency icon and the figure, nothing else.
   */
  currencyIcon?: ReactNode
  /** Another offer is being bought right now. */
  isPurchaseLocked: boolean
  isPurchasing: boolean
  offer: ShopOffer
  onPurchase: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const soldOut = isSoldOut(offer)
  const price = `${offer.finalPrice.toLocaleString()} ${offer.currencyLabel}`
  const isStrip = currencyIcon !== undefined
  const figure = (
    <span className="flex items-center gap-1.5">
      {currencyIcon}
      <span className="figure font-bold">
        {offer.finalPrice.toLocaleString()}
      </span>
    </span>
  )

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true)

      return
    }

    setConfirming(false)
    onPurchase()
  }

  return (
    <Button
      className={cn('w-full', className)}
      title={isStrip && !offer.affordable ? `Not enough ${offer.currencyLabel}` : undefined}
      disabled={
        isPurchaseLocked ||
        isPurchasing ||
        !offer.affordable ||
        offer.fulfillmentOwned ||
        soldOut ||
        offer.currency === 'RealMoney'
      }
      onBlur={() => setConfirming(false)}
      onClick={handleClick}
      size="sm"
      variant={
        confirming ? 'destructive' : offer.affordable ? 'default' : 'secondary'
      }
    >
      {isPurchasing ? (
        <UpdateIcon className="animate-spin" />
      ) : isStrip ? (
        soldOut ? (
          'Sold out'
        ) : offer.fulfillmentOwned ? (
          'Owned'
        ) : offer.currency === 'RealMoney' ? (
          'Real money only'
        ) : confirming ? (
          <>Confirm {figure}</>
        ) : (
          figure
        )
      ) : soldOut ? (
        'Purchased · limit reached'
      ) : offer.fulfillmentOwned ? (
        'Already claimed'
      ) : offer.currency === 'RealMoney' ? (
        'Real money only'
      ) : !offer.affordable ? (
        `Not enough ${offer.currencyLabel}`
      ) : confirming ? (
        `Confirm — spends ${price}`
      ) : (
        `Buy for ${price}`
      )}
    </Button>
  )
}
