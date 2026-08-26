import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Matchmaking Service
 */

export const matchmakingService = createAxios({
  timeout: 20_000,
  baseURL:
    'https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/matchmaking/session',
})

matchmakingService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
