import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Epic's public content CMS (`fortnitecontent-website-prod07`): the same
 * backing store the in-game news panels, the message-of-the-day and the
 * emergency-notice banner read from. Everything here is anonymous — no token,
 * no account — so the only header worth setting is the launcher User-Agent,
 * matching every other Epic call the app makes.
 */
export const contentService = createAxios({
  timeout: 20_000,
  baseURL: 'https://fortnitecontent-website-prod07.ol.epicgames.com',
})

contentService.interceptors.request.use(async (config) => {
  config.headers.setUserAgent(await Manifest.getUserAgent())

  return config
})
