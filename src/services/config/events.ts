import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Fortnite's events service: the competitive calendar and one account's own
 * place in it — the events it is eligible for or has played, with its scores.
 * Takes the account's ordinary Fortnite token (scope
 * `fortnite:profile:{accountId}:commands READ`), the same token the stats
 * service reads with.
 */
export const eventsService = createAxios({
  timeout: 20_000,
  baseURL: 'https://events-public-service-live.ol.epicgames.com',
})

eventsService.interceptors.request.use(async (config) => {
  config.headers.setUserAgent(await Manifest.getUserAgent())

  return config
})
