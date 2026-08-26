import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * User Search Service
 */

export const userSearchService = createAxios({
  timeout: 20_000,
  baseURL: 'https://user-search-service-prod.ol.epicgames.com/api/v1',
})

userSearchService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
