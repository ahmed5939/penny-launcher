import axios from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * User Search Service
 */

export const userSearchService = axios.create({
  baseURL: 'https://user-search-service-prod.ol.epicgames.com/api/v1',
})

userSearchService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
