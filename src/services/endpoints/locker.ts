import type {
  EOSTokenResponse,
  LockerItemsResponse,
  LockerLoadoutGroupRequest,
} from '../../types/services/locker'

import { randomBytes } from 'node:crypto'

import { fortnitePCGameClient } from '../../config/fortnite/clients'

import { eosAuthService, eosDeploymentId, lockerService } from '../config/locker'

/**
 * Trades a launcher access token for an EOS one.
 *
 * The `nonce` is required and only has to be unique per request — EOS
 * rejects a repeat, which is why it is minted here rather than passed in.
 */
export function getEOSAccessToken(launcherAccessToken: string) {
  return eosAuthService.post<EOSTokenResponse>(
    '/oauth/token',
    new URLSearchParams({
      grant_type: 'external_auth',
      external_auth_type: 'epicgames_access_token',
      external_auth_token: launcherAccessToken,
      deployment_id: eosDeploymentId,
      nonce: randomBytes(8).toString('hex'),
    }).toString(),
    {
      headers: {
        Authorization: `basic ${fortnitePCGameClient.auth}`,
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
        Authorization: `bearer ${accessToken}`,
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
        Authorization: `bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )
}
