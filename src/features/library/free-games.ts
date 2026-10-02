import type { LibraryArt } from './model'

import { pickArt } from './model'

/**
 * Epic's free games: this week's and next week's, from the store's own
 * search (`Catalog.searchStore`, category `freegames`) with promotions.
 *
 * Epic writes a promotion's `discountPercentage` as the share of the price
 * still paid: 0 is free, 50 is half price. The `freegames` category also
 * carries ordinary sales and games between giveaways; only 0% promotions
 * are giveaways.
 */

export type FreeGame = {
  offerId: string
  /** The game's sandbox — the namespace an owning account's library lists it under. */
  namespace: string
  title: string
  art: LibraryArt
  /** The store page, when the offer has one. */
  storeUrl: string | null
  /** What it costs outside the giveaway, formatted for the region; null when free anyway. */
  regularPrice: string | null
  startsAt: string
  endsAt: string
}

export type FreeGamesResponse = {
  now: Array<FreeGame>
  next: Array<FreeGame>
  fetchedAt: string
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function list(value: unknown) {
  return Array.isArray(value) ? value : []
}

/** The store page slug: the product's, else its home-page mapping. */
export function storeSlug(element: Record<string, unknown>) {
  const mapped = [
    ...list(record(element.catalogNs)?.mappings),
    ...list(element.offerMappings),
  ]
    .map((mapping) => record(mapping))
    .find((mapping) => text(mapping?.pageType) === 'productHome' && text(mapping?.pageSlug))
  const slug = text(element.productSlug) ?? text(mapped?.pageSlug) ?? text(element.urlSlug)

  return slug ? slug.replace(/\/home$/, '') : null
}

export function storePageUrl(slug: string | null) {
  return slug && /^[a-z0-9-]+$/i.test(slug) ? `https://store.epicgames.com/p/${slug}` : null
}

/** Giveaway windows in a promotions list: 0% to pay, with real dates. */
function giveaways(groups: unknown) {
  return list(groups).flatMap((group) =>
    list(record(group)?.promotionalOffers).flatMap((offer) => {
      const promo = record(offer)
      const percentage = record(promo?.discountSetting)?.discountPercentage
      const startsAt = text(promo?.startDate)
      const endsAt = text(promo?.endDate)

      return percentage === 0 && startsAt && endsAt ? [{ startsAt, endsAt }] : []
    })
  )
}

export function parseFreeGames(body: unknown, now = Date.now()): Omit<FreeGamesResponse, 'fetchedAt'> {
  const elements = list(
    record(record(record(record(body)?.data)?.Catalog)?.searchStore)?.elements
  )
  const current: Array<FreeGame> = []
  const upcoming: Array<FreeGame> = []

  for (const entry of elements) {
    const element = record(entry)
    const offerId = text(element?.id)
    const namespace = text(element?.namespace)
    const title = text(element?.title)

    if (!element || !offerId || !namespace || !title) {
      continue
    }

    const promotions = record(element.promotions)
    const price = record(record(element.price)?.totalPrice)
    const original = Number(price?.originalPrice)
    const formatted = text(record(price?.fmtPrice)?.originalPrice)
    const base = {
      offerId,
      namespace,
      title,
      art: pickArt(element.keyImages),
      storeUrl: storePageUrl(storeSlug(element)),
      regularPrice: Number.isFinite(original) && original > 0 ? formatted : null,
    }
    const live = giveaways(promotions?.promotionalOffers).find(
      (window) => Date.parse(window.startsAt) <= now && now < Date.parse(window.endsAt)
    )
    const soon = giveaways(promotions?.upcomingPromotionalOffers).find(
      (window) => Date.parse(window.startsAt) > now
    )

    if (live) {
      current.push({ ...base, ...live })
    } else if (soon) {
      upcoming.push({ ...base, ...soon })
    }
  }

  const byEnd = (a: FreeGame, b: FreeGame) => a.endsAt.localeCompare(b.endsAt) || a.title.localeCompare(b.title)

  return { now: current.sort(byEnd), next: upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || byEnd(a, b)) }
}
