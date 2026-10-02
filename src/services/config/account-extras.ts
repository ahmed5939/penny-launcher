import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

/**
 * Two account services that sit outside the game's own: the avatar service
 * (which outfit an account shows as its picture across Epic) and the social
 * ban service (bans and warnings on voice, text and party features). Both
 * take an ordinary eg1 bearer token.
 */

export const avatarService = createAxios({
  timeout: 20_000,
  baseURL: 'https://avatar-service-prod.identity.live.on.epicgames.com/v1',
})

export const socialBanService = createAxios({
  timeout: 20_000,
  baseURL:
    'https://social-ban-public-service-prod.ol.epicgames.com/socialban/api/public/v1',
})

for (const service of [avatarService, socialBanService]) {
  service.interceptors.request.use(async (config) => {
    const userAgent = await Manifest.getUserAgent()

    config.headers.setUserAgent(userAgent)

    return config
  })
}
