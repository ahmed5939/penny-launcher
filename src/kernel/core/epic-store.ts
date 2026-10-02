import type { FreeGamesResponse } from '../../features/library/free-games'
import type { GameDetailsResult } from '../../features/library/game-details'

import { app, shell } from 'electron'

import { AccountsManager } from '../startup/accounts'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'

import { parseFreeGames } from '../../features/library/free-games'
import {
  isNamespace,
  parseCritic,
  parseRating,
  parseStoreSlug,
} from '../../features/library/game-details'
import { storeRegion } from '../../features/library/model'
import {
  getCriticReviews,
  getFreeGames,
  getGameDetails,
} from '../../services/endpoints/epic-graphql'
import { getExchangeCodeUsingAccessToken } from '../../services/endpoints/oauth'

/**
 * The Epic Games Store, read the way its own website reads it — free games,
 * a game's player rating and critic score — and opened in the browser
 * already signed in as whichever linked account should claim or buy.
 *
 * Nothing here needs an account except the signed-in open, which walks the
 * account's token through an exchange code exactly as "Epic account
 * settings" does, and only ever towards a store page.
 */

export type { FreeGamesResponse } from '../../features/library/free-games'
export type { GameDetailsResult } from '../../features/library/game-details'

/** The shelf changes once a week; half an hour keeps "ends in" honest enough. */
const freeGamesMaxAgeMs = 30 * 60 * 1000

/** Ratings and critic scores move slowly. */
const detailsMaxAgeMs = 6 * 60 * 60 * 1000

export type OpenSignedInResult = { ok: true } | { ok: false; error: string }

export class EpicStore {
  private static free: { at: number; key: string; value: FreeGamesResponse } | null = null
  private static details = new Map<string, { at: number; value: GameDetailsResult }>()

  private static region() {
    return storeRegion(app.getLocaleCountryCode(), app.getSystemLocale())
  }

  static async freeGames(refresh = false): Promise<FreeGamesResponse> {
    const region = EpicStore.region()
    const key = `${region.country}:${region.locale}`
    const cached = EpicStore.free

    if (!refresh && cached && cached.key === key && Date.now() - cached.at < freeGamesMaxAgeMs) {
      return cached.value
    }

    const value: FreeGamesResponse = {
      ...parseFreeGames(await getFreeGames(region)),
      fetchedAt: new Date().toISOString(),
    }

    EpicStore.free = { at: Date.now(), key, value }

    return value
  }

  static async gameDetails(namespace: unknown): Promise<GameDetailsResult> {
    if (!isNamespace(namespace)) {
      return { ok: false, error: 'That is not a game Epic knows.' }
    }

    const cached = EpicStore.details.get(namespace)

    if (cached && Date.now() - cached.at < detailsMaxAgeMs) {
      return cached.value
    }

    try {
      const body = await getGameDetails({ namespace })
      const slug = parseStoreSlug(body)
      const critic = slug
        ? await getCriticReviews({ slug })
            .then(parseCritic)
            .catch(() => null)
        : null
      const value: GameDetailsResult = {
        ok: true,
        data: { namespace, storeSlug: slug, ...parseRating(body), critic },
      }

      EpicStore.details.set(namespace, { at: Date.now(), value })

      return value
    } catch (error) {
      RuntimeLog.error('caught:core/epic-store.ts (details)', error)

      return { ok: false, error: 'Could not reach the Epic Games Store. Try again later.' }
    }
  }

  /** A store page in the browser, signed in as one linked account. */
  static async openSignedIn(accountId: unknown, url: unknown): Promise<OpenSignedInResult> {
    const account = typeof accountId === 'string' ? AccountsManager.getAccountById(accountId) : undefined

    if (!account) {
      return { ok: false, error: 'This account is no longer linked.' }
    }

    let target: URL

    try {
      target = new URL(String(url))
    } catch {
      return { ok: false, error: 'That is not a store page.' }
    }

    if (target.protocol !== 'https:' || target.hostname !== 'store.epicgames.com') {
      return { ok: false, error: 'That is not a store page.' }
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return { ok: false, error: 'This account is signed out. Sign it in again from Accounts.' }
      }

      const exchange = await getExchangeCodeUsingAccessToken(accessToken)

      if (!exchange.data.code) {
        return { ok: false, error: 'Epic did not hand out a sign-in code. Try again.' }
      }

      const signIn = new URL('https://www.epicgames.com/id/exchange')

      signIn.searchParams.set('exchangeCode', exchange.data.code)
      signIn.searchParams.set('redirectUrl', target.toString())
      await shell.openExternal(signIn.toString())

      return { ok: true }
    } catch (error) {
      RuntimeLog.error('caught:core/epic-store.ts (open)', error)

      return { ok: false, error: 'Could not open the store signed in. Try again.' }
    }
  }
}
