import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Friends Service
 */

export const friendsService = createAxios({
  timeout: 20_000,
  baseURL:
    'https://friends-public-service-prod.ol.epicgames.com/friends/api/v1',
})

friendsService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
