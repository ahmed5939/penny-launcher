import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Base Game Service
 */

export const baseGameService = createAxios({
  timeout: 20_000,
  baseURL:
    'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2',
})

baseGameService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
