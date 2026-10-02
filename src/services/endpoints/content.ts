import { type AxiosRequestConfig } from 'axios'

import { contentService } from '../config/content'

/**
 * The `fortnite-game` page is a large JSON document keyed by subpage — one
 * key per in-game surface (`savetheworldnews`, `battleroyalenewsv2`,
 * `emergencynoticev2`, and dozens more). The shape of each subpage shifts
 * season to season, so this is deliberately typed loosely; the model layer
 * guards every level as it reads.
 */
export type FortniteGameContent = Record<string, unknown>

/**
 * A single unauthenticated GET for Fortnite's current in-game news. No token,
 * no account — this is public content.
 */
export function getFortniteGameContent(config?: AxiosRequestConfig) {
  return contentService.get<FortniteGameContent>(
    '/content/api/pages/fortnite-game',
    config,
  )
}
