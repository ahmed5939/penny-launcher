import type {
  PennyDBShopOfferRaw,
  PennyDBShopResponse,
} from '../../services/endpoints/pennydb'

/**
 * Public catalog from PennyDB. Read-only: purchase still goes through
 * Epic's MCP catalog for the selected account when that offer is present.
 */
export type ShopView = 'account' | 'browse'

export type ShopCatalogOffer = {
  offerId: string
  devName: string
  name: string
  description: string
  price: number
  currency: string
  currencyLabel: string
  currencyImageUrl: string
  templateId: string
  imageUrl: string
  dailyLimit: number
  weeklyLimit: number
  monthlyLimit: number
}

export type ShopCatalogStorefront = {
  id: string
  label: string
  offers: Array<ShopCatalogOffer>
}

export type ShopCatalogPayload = {
  errorMessage?: string
  storefronts: Array<ShopCatalogStorefront>
}

/** Known PennyDB keys first; anything new from the API still surfaces. */
const catalogStorefrontOrder = [
  'llamas_storefront',
  'stw_storefront',
  'stw_event_storefront',
  'cpspgp_storefront',
]

const catalogStorefrontLabels: Record<string, string> = {
  llamas_storefront: 'X-Ray Llamas',
  stw_storefront: 'Weekly Store',
  stw_event_storefront: 'Event Store',
  cpspgp_storefront: 'Gameplay',
}

const currencyLabels: Record<string, string> = {
  'AccountResource:currency_xrayllama': 'X-Ray Tickets',
  'AccountResource:currency_mtxswap': 'V-Bucks',
  'AccountResource:eventcurrency_scaling': 'Gold',
  'AccountResource:eventcurrency_founder': "Founder's Coins",
}

function labelForStorefront(id: string) {
  if (catalogStorefrontLabels[id]) {
    return catalogStorefrontLabels[id]
  }

  return id
    .replace(/_storefront$/i, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function labelForCurrency(currency: string) {
  if (currencyLabels[currency]) {
    return currencyLabels[currency]
  }

  const leaf = currency.split(':').pop() ?? currency

  return leaf
    .replace(/^(account|event)?currency_?/i, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function displayNameForCatalogOffer(offer: PennyDBShopOfferRaw) {
  const title = offer.title?.trim() ?? ''
  const name = offer.name?.trim() ?? ''
  const hasInternalTitle =
    title.includes('[VIRTUAL]') ||
    title.includes('GameItem:') ||
    title.includes('AccountResource:')

  if (title && !hasInternalTitle) {
    return title
  }

  if (name) {
    return name
  }

  const leaf =
    (offer.templateId ?? offer.devName ?? 'Unknown').split(':').pop() ??
    'Unknown'

  return leaf
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Turns the live PennyDB payload into the shelves the browse tab renders.
 * Offers without an id are dropped — they cannot be matched to MCP later.
 */
export function parsePennyDBShop(
  data: PennyDBShopResponse | null | undefined
): Array<ShopCatalogStorefront> {
  const source = data?.storefronts ?? {}
  const known = catalogStorefrontOrder.filter((id) => id in source)
  const extra = Object.keys(source).filter(
    (id) => !catalogStorefrontOrder.includes(id)
  )

  return [...known, ...extra]
    .map((id) => ({
      id,
      label: labelForStorefront(id),
      offers: (source[id] ?? [])
        .filter(
          (offer) =>
            typeof offer.offerId === 'string' && offer.offerId.length > 0
        )
        .map((offer) => {
          const currency = offer.currency ?? ''

          return {
            offerId: offer.offerId as string,
            devName: offer.devName ?? '',
            name: displayNameForCatalogOffer(offer),
            description: offer.description?.trim() ?? '',
            price: offer.price ?? 0,
            currency,
            currencyLabel:
              offer.currency_readable?.trim() || labelForCurrency(currency),
            currencyImageUrl: offer.currency_image ?? '',
            templateId: offer.templateId ?? '',
            imageUrl: offer.image_link ?? '',
            dailyLimit: offer.dailyLimit ?? -1,
            weeklyLimit: offer.weeklyLimit ?? -1,
            monthlyLimit: offer.monthlyLimit ?? -1,
          }
        }),
    }))
    .filter((storefront) => storefront.offers.length > 0)
}
