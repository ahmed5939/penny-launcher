import { create as createAxios } from 'axios'

/**
 * Epic Account Services and EOS presence, both on api.epicgames.dev.
 *
 * Presence speaks a third kind of token: not the eg1 game token most of this
 * app uses, and not the EOS Connect token the locker mints
 * (`services/config/locker.ts`), but an EAS *user* token with the
 * `presence` scope. Short timeouts: every call here sits behind a button
 * the user is watching, and the session manager retries on its own terms.
 */
export const easService = createAxios({
  timeout: 15_000,
  baseURL: 'https://api.epicgames.dev',
})

/** Fortnite's live EOS deployment, the one the game publishes presence to. */
export { eosDeploymentId as presenceDeploymentId } from './locker'

export const easPresenceScope = 'basic_profile friends_list presence openid'
