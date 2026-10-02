import type { AccountData } from '../../types/accounts'

import { Authentication } from './authentication'

import { launcherAppClient2 } from '../../config/fortnite/clients'

import {
  createAccessTokenUsingClientCredentials,
  createAccessTokenUsingExchange,
  getExchangeCodeUsingAccessToken,
} from '../../services/endpoints/oauth'

/**
 * Tokens for the Epic Games Launcher's own client (`launcherAppClient2`).
 *
 * The account's stored token belongs to a Fortnite client. The services the
 * launcher reads for its library — entitlements and the save-sync
 * datastore — are read here the way the launcher reads them, with a token
 * minted *for the launcher*: the account token is walked through an
 * exchange code into one, the same hop `mintEOSToken` in `locker.ts` makes
 * for the game client.
 *
 * The catalogue is not per account at all. It takes an app-only
 * (client-credentials) token for the same client, with no user behind it.
 *
 * Both are kept until shortly before they lapse — the Library page asks for
 * entitlements and cloud saves at the same moment, and minting twice would
 * be four extra round trips for nothing.
 */

const tokenSafetyMarginMs = 5 * 60 * 1000

type CachedToken = { token: string; expiresAt: number }

const userTokens = new Map<string, CachedToken>()
const userInFlight = new Map<string, Promise<string | null>>()

let appToken: CachedToken | null = null
let appInFlight: Promise<string> | null = null

function expiry(expiresIn: number | undefined, fallbackSeconds: number) {
  return (
    Date.now() +
    Math.max(0, (expiresIn ?? fallbackSeconds) * 1000 - tokenSafetyMarginMs)
  )
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (
      error as {
        response?: { status?: number; data?: { errorMessage?: string } }
      }
    ).response

    if (response?.data?.errorMessage) {
      return response.data.errorMessage
    }

    if (response?.status) {
      return `HTTP ${response.status}`
    }
  }

  return error instanceof Error ? error.message : 'Unknown error'
}

/**
 * Labels which hop of the chain broke — Epic's OAuth answers both of them,
 * in the same words.
 */
async function step<Result>(label: string, run: () => Promise<Result>) {
  try {
    return await run()
  } catch (error) {
    throw new Error(`${label}: ${errorMessage(error)}`, { cause: error })
  }
}

async function mintLauncherToken(account: AccountData) {
  const accessToken = await Authentication.verifyAccessToken(account)

  if (!accessToken) {
    return null
  }

  const exchange = await step('Exchange code', () =>
    getExchangeCodeUsingAccessToken(accessToken)
  )
  const launcher = await step('Launcher sign-in', () =>
    createAccessTokenUsingExchange(
      {
        exchange_code: exchange.data.code,
        token_type: 'eg1',
      },
      {
        headers: {
          Authorization: `basic ${launcherAppClient2.auth}`,
        },
      }
    )
  )

  if (!launcher.data.access_token) {
    return null
  }

  userTokens.set(account.accountId, {
    token: launcher.data.access_token,
    expiresAt: expiry(launcher.data.expires_in, 7200),
  })

  return launcher.data.access_token
}

/** A launcher-client token for this account, or null when the account is signed out. */
export async function launcherToken(
  account: AccountData,
  { fresh = false } = {}
) {
  const cached = userTokens.get(account.accountId)

  if (!fresh && cached && cached.expiresAt > Date.now()) {
    return cached.token
  }

  const pending = userInFlight.get(account.accountId)

  if (!fresh && pending) {
    return pending
  }

  userTokens.delete(account.accountId)

  const minting = mintLauncherToken(account).finally(() => {
    userInFlight.delete(account.accountId)
  })

  userInFlight.set(account.accountId, minting)

  return minting
}

/** The app-only token the catalogue takes. Throws when Epic refuses one. */
export async function launcherAppToken({ fresh = false } = {}) {
  if (!fresh && appToken && appToken.expiresAt > Date.now()) {
    return appToken.token
  }

  if (!fresh && appInFlight) {
    return appInFlight
  }

  appToken = null
  appInFlight = step('Catalogue sign-in', () =>
    createAccessTokenUsingClientCredentials({
      authorization: launcherAppClient2.auth,
    })
  )
    .then((response) => {
      appToken = {
        token: response.data.access_token,
        expiresAt: expiry(response.data.expires_in, 3600),
      }

      return response.data.access_token
    })
    .finally(() => {
      appInFlight = null
    })

  return appInFlight
}

/** Status of a failed request, when it got as far as an answer. */
export function responseStatus(error: unknown) {
  return (error as { response?: { status?: number } } | null)?.response?.status
}

/**
 * Runs a request with the account's launcher token, and once more with a
 * fresh one if the first is refused — a token revoked elsewhere (a password
 * change, "sign out everywhere") looks valid here until Epic says otherwise.
 */
export async function withLauncherToken<Result>(
  account: AccountData,
  run: (token: string) => Promise<Result>
) {
  const token = await launcherToken(account)

  if (!token) {
    throw new Error('Could not sign this account in to Epic. Sign in again from Accounts.')
  }

  try {
    return await run(token)
  } catch (error) {
    if (responseStatus(error) !== 401) {
      throw error
    }

    const retry = await launcherToken(account, { fresh: true })

    if (!retry) {
      throw error
    }

    return run(retry)
  }
}
