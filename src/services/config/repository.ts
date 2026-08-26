import { create as createAxios } from 'axios'

/**
 * Repository Service
 *
 * Used for the "new version available" check, so it must point at the repo
 * where releases are actually published.
 */

export const repositoryService = createAxios({
  timeout: 20_000,
  baseURL: 'https://api.github.com/repos/ahmed5939/penny-launcher',
})
