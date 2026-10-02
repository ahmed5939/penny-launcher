import type { CatalogItem } from '../../features/library/model'

import axios from 'axios'

import {
  catalogService,
  entitlementService,
  saveSyncService,
  storeService,
} from '../config/library'

/**
 * The Library page's reads. Entitlements and cloud saves take a launcher
 * user token and the catalogue an app-only one (see
 * `kernel/core/launcher-token.ts`); the store takes none. Nothing here
 * writes.
 */

/** One page of the account's entitlements, every Epic game included. */
export function getEntitlements({
  accessToken,
  accountId,
  count,
  start,
}: {
  accessToken: string
  accountId: string
  count: number
  start: number
}) {
  return entitlementService.get<unknown>(
    `/account/${accountId}/entitlements`,
    {
      params: { start, count },
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}

/**
 * Catalogue items by id. The service wants the id repeated (`id=a&id=b`),
 * which axios's array serialiser does not write, so the query is built by
 * hand. Ids it does not know are simply absent from the answer.
 */
export function getCatalogItems({
  accessToken,
  country,
  details,
  ids,
  namespace,
}: {
  accessToken: string
  country: string
  /** Include each item's DLC list and main game — only the main item needs them. */
  details: boolean
  ids: Array<string>
  namespace: string
}) {
  const query = new URLSearchParams()

  ids.forEach((id) => query.append('id', id))
  query.set('includeDLCDetails', String(details))
  query.set('includeMainGameDetails', String(details))
  query.set('country', country)
  query.set('locale', 'en')

  return catalogService.get<Record<string, CatalogItem>>(
    `/namespace/${encodeURIComponent(namespace)}/bulk/items?${query.toString()}`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}

const offersQuery = `query libraryOffers($namespace: String!, $country: String!, $locale: String) {
  Catalog {
    catalogOffers(namespace: $namespace, params: { count: 100 }) {
      elements {
        id
        title
        description
        offerType
        effectiveDate
        expiryDate
        keyImages { type url }
        items { id }
        categories { path }
        price(country: $country) {
          totalPrice {
            discountPrice
            originalPrice
            currencyCode
            currencyInfo { decimals }
            fmtPrice(locale: $locale) { originalPrice discountPrice }
          }
        }
      }
      paging { total count }
    }
  }
}`

/** Every offer in a namespace with its price for one country, in one query. */
export function getStoreOffers({
  country,
  locale,
  namespace,
}: {
  country: string
  locale: string
  namespace: string
}) {
  return storeService.post<unknown>('/graphql', {
    query: offersQuery,
    variables: { namespace, country, locale },
  })
}

/** The account's save-store listing, all games or one. */
export function getCloudSaves({
  accessToken,
  accountId,
  appName,
}: {
  accessToken: string
  accountId: string
  appName?: string
}) {
  return saveSyncService.get<unknown>(
    appName
      ? `/${accountId}/${encodeURIComponent(appName)}/`
      : `/${accountId}/`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}

/**
 * A save file through its signed link. The link is its own credential, so
 * no token goes with it — the account's token has no business on whichever
 * storage host Epic signs for.
 */
export function getSignedFile(readLink: string) {
  return axios.get<NodeJS.ReadableStream>(readLink, {
    responseType: 'stream',
    timeout: 120_000,
  })
}
