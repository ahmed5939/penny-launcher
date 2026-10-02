import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Fortnite's Habanero ranked service: an account's competitive rank on every
 * active ranked track — Battle Royale (Build and Zero Build), Reload, OG,
 * Ballistic and Rocket Racing. Takes the account's ordinary Fortnite (eg1)
 * token; the service answers for the account the token belongs to, scope
 * `rankings:fortnite:playerprogress READ`, and for no one else.
 */
export const habaneroService = createAxios({
  timeout: 20_000,
  baseURL:
    'https://fn-service-habanero-live-public.ogs.live.on.epicgames.com/api/v1/games/fortnite',
})

habaneroService.interceptors.request.use(async (config) => {
  config.headers.setUserAgent(await Manifest.getUserAgent())

  return config
})
