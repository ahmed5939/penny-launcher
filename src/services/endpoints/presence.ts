import type {
  CreateExchangeCodeResponse,
  ExchangeCodeResponse,
} from '../../types/services/authorizations'

import { fortniteAndroidGameClient } from '../../config/fortnite/clients'

import { oauthService } from '../config/oauth'
import {
  easPresenceScope,
  easService,
  presenceDeploymentId,
} from '../config/presence'

/**
 * The presence token chain and publish call. Every function takes a signal
 * so Stop can cut a request short.
 *
 * `Basic` / `Bearer` are capitalised for api.epicgames.dev, which ignores
 * the lowercase scheme the account service accepts (see
 * `services/endpoints/locker.ts`).
 */

export type EasTokenResponse = {
  access_token: string
  expires_in?: number
  expires_at?: string
  refresh_token?: string
  refresh_expires_in?: number
  refresh_expires_at?: string
  account_id?: string
}

/**
 * One-time code from an existing account token, so presence can get a
 * session of its own without touching the one Penny's other tools use.
 */
export function createPresenceExchangeCode(
  accessToken: string,
  signal: AbortSignal
) {
  return oauthService.get<CreateExchangeCodeResponse>('/exchange', {
    headers: { Authorization: `bearer ${accessToken}` },
    signal,
    'axios-retry': { retries: 0 },
  })
}

/**
 * The exchange code becomes a Fortnite Android game-client token. Android
 * explicitly: the EAS grant below only takes a refresh token minted for the
 * client whose credentials accompany it. No retry — `oauthService` would
 * otherwise swap in the iOS client on error 18031.
 */
export function exchangeCodeForPresenceToken(
  code: string,
  signal: AbortSignal
) {
  return oauthService.post<ExchangeCodeResponse>(
    '/token',
    { grant_type: 'exchange_code', exchange_code: code },
    {
      headers: { Authorization: `basic ${fortniteAndroidGameClient.auth}` },
      signal,
      'axios-retry': { retries: 0 },
    }
  )
}

/**
 * EAS user token with the `presence` scope. `refreshToken` is either the
 * Android game token's or a previous EAS token's; Epic accepts both under
 * the same client.
 */
export function requestEasToken(refreshToken: string, signal: AbortSignal) {
  return easService.post<EasTokenResponse>(
    '/epic/oauth/v2/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: easPresenceScope,
      deployment_id: presenceDeploymentId,
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${fortniteAndroidGameClient.auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      signal,
    }
  )
}

/** Sets the presence attached to one live connect session. */
export function patchPresence({
  accessToken,
  accountId,
  connectionId,
  payload,
  signal,
}: {
  accessToken: string
  accountId: string
  connectionId: string
  payload: unknown
  signal: AbortSignal
}) {
  return easService.patch(
    `/epic/presence/v1/${encodeURIComponent(presenceDeploymentId)}/${encodeURIComponent(
      accountId
    )}/presence/${encodeURIComponent(connectionId)}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal,
    }
  )
}
