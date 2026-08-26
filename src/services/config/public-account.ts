import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Public Account Service
 */

export const publicAccountService = createAxios({
  timeout: 20_000,
  baseURL:
    'https://account-public-service-prod.ol.epicgames.com/account/api/public/account',
})

publicAccountService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
