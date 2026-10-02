import { create as createAxios } from 'axios'

/**
 * The Epic Games Launcher's GraphQL gateway, signed in.
 *
 * The same host the Library page asks without a token (`storeService` in
 * `library.ts`); with a launcher-client eg1 token it also answers for the
 * account behind it — its playtime, its app builds. Opaque tokens get an
 * HTML 500 here, and the game client's eg1 token gets 403s from the
 * services behind it, so this always goes out with a `launcherToken`.
 *
 * The user agent is the one the launcher's embedded browser sends, which is
 * what these queries were tested with.
 */
export const epicGraphQLService = createAxios({
  timeout: 20_000,
  baseURL: 'https://launcher.store.epicgames.com/graphql',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher',
  },
})
