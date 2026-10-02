import { epicGraphQLService } from '../config/epic-graphql'

import { graphQLProblems } from '../../features/playtime/model'

/**
 * A GraphQL request that failed behind an HTTP 200. Shaped like an axios
 * error (`response.status` is the status of the service that refused) so
 * `responseStatus` and the 401 retry in `withLauncherToken` treat it the
 * same as a refusal at the door.
 */
export class EpicGraphQLError extends Error {
  readonly response: { status: number | undefined }

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'EpicGraphQLError'
    this.response = { status: status ?? undefined }
  }
}

/**
 * Posts one query — signed in, or not for public reads — and returns the
 * whole reply body. Throws when the field the caller needs (`required`, a
 * path under `data`) came back null — that is what a refusal looks like
 * here — but not for problems elsewhere in the reply.
 */
async function query(
  accessToken: string | null,
  document: string,
  variables: Record<string, unknown>,
  required: Array<string>
) {
  const response = await epicGraphQLService.post<unknown>(
    '',
    { query: document, variables },
    accessToken ? { headers: { Authorization: `bearer ${accessToken}` } } : undefined
  )
  let value: unknown = (response.data as { data?: unknown } | null)?.data

  for (const key of required) {
    value = (value as Record<string, unknown> | null | undefined)?.[key]
  }

  if (value === null || value === undefined) {
    const [problem] = graphQLProblems(response.data)

    throw new EpicGraphQLError(
      problem?.message ?? `No ${required.join('.')} in the reply`,
      problem?.status ?? null
    )
  }

  return response.data
}

const playtimeQuery = `query PlaytimeTotal($accountId: String!) {
  PlaytimeTracking {
    total(accountId: $accountId) {
      artifactId
      totalTime
    }
  }
}`

/**
 * Every app's total for one account. Only with that account's own launcher
 * token: another account's id is a 403 from the playtime service.
 */
export function getPlaytimeTotals({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return query(accessToken, playtimeQuery, { accountId }, ['PlaytimeTracking', 'total'])
}

const appBuildsQuery = `query AppBuilds($platform: Platform!, $label: Label!, $locale: String!) {
  Launcher {
    appBuilds(platform: $platform, label: $label) {
      appName
      namespace
      catalogItem(locale: $locale) {
        title
        keyImages {
          type
          url
        }
      }
    }
  }
}`

/**
 * The launcher apps the token's account may install, with their catalogue
 * titles and art — the names for the playtime totals' app ids.
 */
export function getAppBuilds({
  accessToken,
  locale = 'en-US',
}: {
  accessToken: string
  locale?: string
}) {
  return query(
    accessToken,
    appBuildsQuery,
    { platform: 'Windows', label: 'Live', locale },
    ['Launcher', 'appBuilds']
  )
}

const achievementSummariesQuery = `query AchievementSummaries($epicAccountId: String!, $locale: String!) {
  PlayerProfile {
    playerProfile(epicAccountId: $epicAccountId) {
      privacy {
        accessLevel
      }
      achievementsSummaries {
        __typename
        ... on PlayerAchievementResponseSuccess {
          data {
            sandboxId
            totalUnlocked
            totalXP
            baseOfferForSandbox(locale: $locale) {
              keyImages {
                type
                url
              }
            }
            product(locale: $locale) {
              name
            }
            productAchievements(locale: $locale) {
              totalAchievements
              totalProductXP
            }
            playerAwards {
              awardType
            }
          }
        }
        ... on ServiceError {
          status
          message
        }
      }
    }
  }
}`

/**
 * One account's Epic achievements per game, and who can see its profile.
 * With that account's own launcher token: another account's privacy comes
 * back null, and its summaries only as far as friendship allows.
 */
export function getAchievementSummaries({
  accessToken,
  accountId,
  locale = 'en-US',
}: {
  accessToken: string
  accountId: string
  locale?: string
}) {
  return query(
    accessToken,
    achievementSummariesQuery,
    { epicAccountId: accountId, locale },
    ['PlayerProfile', 'playerProfile']
  )
}

const achievementDefinitionsQuery = `query AchievementDefinitions($sandboxId: String!, $locale: String!) {
  Achievement {
    productAchievementsRecordBySandbox(sandboxId: $sandboxId, locale: $locale) {
      totalAchievements
      totalProductXP
      platinumRarity {
        percent
      }
      achievements {
        achievement {
          name
          hidden
          unlockedDisplayName
          lockedDisplayName
          unlockedDescription
          lockedDescription
          XP
          unlockedIconLink
          lockedIconLink
          rarity {
            percent
          }
        }
      }
    }
  }
}`

/** A game's achievement list. Public: no token. */
export function getAchievementDefinitions({
  locale = 'en-US',
  sandboxId,
}: {
  locale?: string
  sandboxId: string
}) {
  return query(
    null,
    achievementDefinitionsQuery,
    { sandboxId, locale },
    ['Achievement', 'productAchievementsRecordBySandbox']
  )
}

const playerAchievementsQuery = `query PlayerAchievements($epicAccountId: String!, $sandboxId: String!) {
  PlayerAchievement {
    playerAchievementGameRecordsBySandbox(epicAccountId: $epicAccountId, sandboxId: $sandboxId) {
      records {
        playerAwards {
          awardType
        }
        playerAchievements {
          playerAchievement {
            achievementName
            unlocked
            progress
            unlockDate
          }
        }
      }
    }
  }
}`

/** One account's unlocks in one game, with dates. Its own launcher token. */
export function getPlayerAchievements({
  accessToken,
  accountId,
  sandboxId,
}: {
  accessToken: string
  accountId: string
  sandboxId: string
}) {
  return query(
    accessToken,
    playerAchievementsQuery,
    { epicAccountId: accountId, sandboxId },
    ['PlayerAchievement', 'playerAchievementGameRecordsBySandbox']
  )
}

const libraryItemsQuery = `query LibraryItems($cursor: String, $locale: String) {
  Library {
    libraryItems(cursor: $cursor, params: { includeMetadata: true }) {
      records {
        appName
        namespace
        catalogItemId
        acquisitionDate
        sandboxName
        catalogItem(locale: $locale) {
          title
          categories {
            path
          }
          keyImages {
            type
            url
          }
        }
      }
      responseMetadata {
        nextCursor
      }
    }
  }
}`

/**
 * One page of the account's Epic library — what the Epic Games Launcher
 * lists, games and engines alike. Its own launcher token; `cursor` from the
 * previous page.
 */
export function getLibraryItems({
  accessToken,
  cursor = null,
  locale = 'en-US',
}: {
  accessToken: string
  cursor?: string | null
  locale?: string
}) {
  return query(
    accessToken,
    libraryItemsQuery,
    { cursor, locale },
    ['Library', 'libraryItems']
  )
}

const myAccountQuery = `query MyAccount {
  Account {
    myAccount {
      country
      emailVerified
      tfaEnabled
      cabinedMode
      externalAuths {
        type
      }
    }
  }
}`

/**
 * The token's own account: two-factor, verified email, linked platforms.
 * Only ever the account behind the token — there is no id to ask about.
 */
export function getMyAccount({ accessToken }: { accessToken: string }) {
  return query(accessToken, myAccountQuery, {}, ['Account', 'myAccount'])
}

const freeGamesQuery = `query FreeGames($country: String!, $locale: String) {
  Catalog {
    searchStore(category: "freegames", count: 40, country: $country, locale: $locale) {
      elements {
        id
        namespace
        title
        productSlug
        urlSlug
        keyImages {
          type
          url
        }
        catalogNs {
          mappings(pageType: "productHome") {
            pageSlug
            pageType
          }
        }
        offerMappings {
          pageSlug
          pageType
        }
        price(country: $country) {
          totalPrice {
            originalPrice
            fmtPrice(locale: $locale) {
              originalPrice
            }
          }
        }
        promotions(category: "freegames") {
          promotionalOffers {
            promotionalOffers {
              startDate
              endDate
              discountSetting {
                discountPercentage
              }
            }
          }
          upcomingPromotionalOffers {
            promotionalOffers {
              startDate
              endDate
              discountSetting {
                discountPercentage
              }
            }
          }
        }
      }
    }
  }
}`

/** The store's free-games shelf, with its promotions. Public. */
export function getFreeGames({ country, locale }: { country: string; locale: string }) {
  return query(null, freeGamesQuery, { country, locale }, ['Catalog', 'searchStore'])
}

const gameDetailsQuery = `query GameDetails($namespace: String!, $locale: String!) {
  Catalog {
    catalogNs(namespace: $namespace) {
      mappings(pageType: "productHome") {
        pageSlug
        pageType
      }
    }
  }
  RatingsPolls {
    getProductResult(sandboxId: $namespace, locale: $locale) {
      averageRating
      pollResult {
        total
        localizations {
          resultTitle
        }
      }
    }
  }
}`

/** A game's store page slug and its players' rating. Public; a game without a rating is null there. */
export function getGameDetails({ locale = 'en-US', namespace }: { locale?: string; namespace: string }) {
  return query(null, gameDetailsQuery, { namespace, locale }, ['Catalog'])
}

const criticQuery = `query CriticReviews($sku: String!) {
  OpenCritic {
    productReviews(sku: $sku) {
      openCriticScore
      reviewCount
      percentRecommended
      award
      openCriticUrl
    }
  }
}`

/** OpenCritic's score for a store page, by `EPIC_<slug>`. Public. */
export function getCriticReviews({ slug }: { slug: string }) {
  return query(null, criticQuery, { sku: `EPIC_${slug}` }, ['OpenCritic'])
}
