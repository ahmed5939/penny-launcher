import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Fortnite's stats service: per-playlist stats for every platform the
 * account plays on. Takes the account's ordinary Fortnite token.
 */
export const statsService = createAxios({
  timeout: 20_000,
  baseURL: 'https://statsproxy-public-service-live.ol.epicgames.com/statsproxy/api',
})

statsService.interceptors.request.use(async (config) => {
  config.headers.setUserAgent(await Manifest.getUserAgent())

  return config
})
