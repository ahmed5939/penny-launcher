import { userSearchService } from '../config/user-search'

export type UserSearchPlatform = 'epic' | 'psn' | 'xbl' | 'steam' | 'nsw'

export type UserSearchMatch = {
  accountId: string
  matches: Array<{
    value: string
    platform: UserSearchPlatform
  }>
  matchType: 'exact' | 'prefix'
  epicMutuals: number
  sortPosition: number
}

/**
 * Prefix search across Epic and the connected console platforms — the same
 * lookup the in-game "add friend" box uses.
 *
 * @see https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation
 */
export function searchUsers({
  accessToken,
  accountId,
  prefix,
  platform = 'epic',
}: {
  accessToken: string
  accountId: string
  prefix: string
  platform?: UserSearchPlatform
}) {
  return userSearchService.get<Array<UserSearchMatch>>(
    `/search/${accountId}`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        platform,
        prefix,
      },
    }
  )
}
