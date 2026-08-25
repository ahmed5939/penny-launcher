import type {
  LookupFindManyByDisplayNameResponse,
  LookupFindOneByDisplayNameResponse,
} from '../../types/services/lookup'

import { publicAccountService } from '../config/public-account'

export function findUserByAccountId({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return publicAccountService.get<LookupFindOneByDisplayNameResponse>(
    `/${accountId}`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}

/**
 * Resolves up to 100 account ids in one call, with their linked console
 * accounts. Friend lists routinely run past a hundred entries, so callers
 * must chunk.
 *
 * @see https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation
 */
export function findUsersByAccountIds({
  accessToken,
  accountIds,
}: {
  accessToken: string
  accountIds: Array<string>
}) {
  const searchParams = new URLSearchParams()

  accountIds.forEach((accountId) => {
    searchParams.append('accountId', accountId)
  })

  return publicAccountService.get<LookupFindManyByDisplayNameResponse>(
    `?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}

export function findUserByDisplayName({
  accessToken,
  displayName,
}: {
  accessToken: string
  displayName: string
}) {
  return publicAccountService.get<LookupFindOneByDisplayNameResponse>(
    `/displayName/${displayName}`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}

export function findUserByExternalDisplayName({
  accessToken,
  displayName,
  externalAuthType,
}: {
  accessToken: string
  displayName: string
  externalAuthType: 'psn' | 'xbl'
}) {
  return publicAccountService.get<LookupFindManyByDisplayNameResponse>(
    `/lookup/externalAuth/${externalAuthType}/displayName/${displayName}?caseInsensitive=true`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}
