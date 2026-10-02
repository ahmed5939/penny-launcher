import { create as createAxios } from 'axios'

/**
 * The Epic Games Launcher's services, which the Library page reads.
 *
 * None of these is a Fortnite service, so they go out with the launcher's
 * user agent rather than the game's. The store's GraphQL endpoint in
 * particular is the one the launcher's store tab talks to, and answers it
 * without any sign-in at all.
 */

export const launcherUserAgent = 'EpicGamesLauncher/17.0.0'

const headers = { 'User-Agent': launcherUserAgent }

export const entitlementService = createAxios({
  timeout: 30_000,
  baseURL:
    'https://entitlement-public-service-prod08.ol.epicgames.com/entitlement/api',
  headers,
})

export const catalogService = createAxios({
  timeout: 30_000,
  baseURL:
    'https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared',
  headers,
})

export const storeService = createAxios({
  timeout: 30_000,
  baseURL: 'https://launcher.store.epicgames.com',
  headers: { ...headers, 'Content-Type': 'application/json' },
})

export const saveSyncService = createAxios({
  timeout: 30_000,
  baseURL:
    'https://datastorage-public-service-liveegs.live.use1a.on.epicgames.com/api/v1/access/egstore/savesync',
  headers,
})
