import type {
  EOSTokenResponse,
  LockerItemsResponse,
  LockerLoadoutGroupRequest,
} from '../../types/services/locker'

import { randomBytes } from 'node:crypto'

import { fortnitePCGameClient } from '../../config/fortnite/clients'

import { eosAuthService, eosDeploymentId, lockerService } from '../config/locker'

/**
 * The locker endpoints, which are not MCP.
 *
 * `Bearer` and `Basic` are capitalised deliberately. Everywhere else in this
 * app the scheme is lowercase, because Epic's MCP accepts it — the EOS
 * gateway in front of the locker does not. It looks for the literal
 * `Bearer ` and, finding none, answers "Jwt is missing", which reads like a
 * token problem rather than the header-casing one it is.
 */

/**
 * Trades an eg1 game-client token for an EOS one.
 *
 * `gameAccessToken` must come from the same Epic product as the Basic
 * credentials below — see `mintEOSToken` in `kernel/core/locker.ts`.
 *
 * The `nonce` is required and only has to be unique per request — EOS
 * rejects a repeat, which is why it is minted here rather than passed in.
 */
export function getEOSAccessToken(gameAccessToken: string) {
  return eosAuthService.post<EOSTokenResponse>(
    '/oauth/token',
    new URLSearchParams({
      grant_type: 'external_auth',
      external_auth_type: 'epicgames_access_token',
      external_auth_token: gameAccessToken,
      deployment_id: eosDeploymentId,
      nonce: randomBytes(8).toString('hex'),
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${fortnitePCGameClient.auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    }
  )
}

export function getLockerItems({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return lockerService.get<LockerItemsResponse>(
    `/account/${accountId}/items`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
}

/**
 * Writes the locker back.
 *
 * There is no per-slot endpoint: the body replaces the entire active loadout
 * group, so a caller must send back everything it was given plus its one
 * change, or the omitted slots come off.
 */
export function setActiveLoadoutGroup({
  accessToken,
  accountId,
  loadouts,
}: {
  accessToken: string
  accountId: string
  loadouts: LockerLoadoutGroupRequest['loadouts']
}) {
  return lockerService.put(
    `/account/${accountId}/active-loadout-group`,
    { loadouts } satisfies LockerLoadoutGroupRequest,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )
}
