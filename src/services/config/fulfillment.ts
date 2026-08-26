import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Fulfillment Service
 */

export const fulfillmentService = createAxios({
  timeout: 20_000,
  baseURL:
    'https://fulfillment-public-service-prod.ol.epicgames.com/fulfillment/api/public',
})

fulfillmentService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
