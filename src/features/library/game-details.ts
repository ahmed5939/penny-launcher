/**
 * What the Epic Games Store says about a game: its players' rating (the
 * store's own polls) and its OpenCritic score. Both are public; the
 * OpenCritic lookup is keyed by the store page's slug as `EPIC_<slug>`.
 */

export type PlayerPoll = { title: string; total: number }

export type GameDetails = {
  namespace: string
  storeSlug: string | null
  /** 0–5, the store's star rating. */
  rating: number | null
  /** The polls' headline traits, most voted first. */
  polls: Array<PlayerPoll>
  critic: {
    score: number | null
    reviews: number | null
    recommended: number | null
    /** OpenCritic's tier: "Mighty", "Strong", "Fair", "Weak". */
    tier: string | null
    url: string | null
  } | null
}

export type GameDetailsResult = { ok: true; data: GameDetails } | { ok: false; error: string }

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function number(value: unknown) {
  const parsed = Number(value)

  return value !== null && value !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function data(body: unknown) {
  return record(record(body)?.data)
}

/** `Catalog.catalogNs(namespace).mappings`: the store page slug for a sandbox. */
export function parseStoreSlug(body: unknown) {
  const mappings = record(data(body)?.Catalog)?.catalogNs

  const list = record(mappings)?.mappings

  return Array.isArray(list)
    ? (list.map((entry) => text(record(entry)?.pageSlug)).find((slug) => slug !== null) ?? null)
    : null
}

/** `RatingsPolls.getProductResult`: the star rating and the most voted traits. */
export function parseRating(body: unknown) {
  const result = record(record(data(body)?.RatingsPolls)?.getProductResult)
  const polls = Array.isArray(result?.pollResult) ? result.pollResult : []

  return {
    rating: number(result?.averageRating),
    polls: polls
      .flatMap((entry): Array<PlayerPoll> => {
        const poll = record(entry)
        const title = text(record(poll?.localizations)?.resultTitle)
        const total = number(poll?.total)

        return title && total !== null ? [{ title, total }] : []
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 4),
  }
}

/** `OpenCritic.productReviews`, or null when OpenCritic does not know the game. */
export function parseCritic(body: unknown): GameDetails['critic'] {
  const reviews = record(record(data(body)?.OpenCritic)?.productReviews)

  if (!reviews) {
    return null
  }

  const url = text(reviews.openCriticUrl)

  return {
    score: number(reviews.openCriticScore),
    reviews: number(reviews.reviewCount),
    recommended: number(reviews.percentRecommended),
    tier: text(reviews.award),
    url: url && url.startsWith('https://opencritic.com/') ? url : null,
  }
}

export function isNamespace(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
}
