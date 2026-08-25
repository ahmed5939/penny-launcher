import axios from 'axios'

/**
 * Repository Service
 *
 * Used for the "new version available" check, so it must point at the repo
 * where releases are actually published.
 */

export const repositoryService = axios.create({
  baseURL: 'https://api.github.com/repos/ahmed5939/penny-launcher',
})
