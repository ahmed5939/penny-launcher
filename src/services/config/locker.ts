import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * The locker lives on Epic Online Services, not on the MCP profile service.
 *
 * Reading or writing an equipped cosmetic goes through the game's EOS
 * deployment, which speaks a different token than every other endpoint in
 * this app: an `epicgames_access_token` external auth, exchanged for an EOS
 * token scoped to that deployment. `eosAuthService` mints it;
 * `lockerService` spends it.
 */

/** Fortnite's live EOS deployment. */
export const eosDeploymentId = '62a9473a2dca46b29ccf17577fcf42d7'

export const eosAuthService = createAxios({
  timeout: 20_000,
  baseURL: 'https://api.epicgames.dev/auth/v1',
})

export const lockerService = createAxios({
  timeout: 20_000,
  baseURL: `https://fngw-svc-gc-livefn.ol.epicgames.com/api/locker/v4/${eosDeploymentId}`,
})

lockerService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
