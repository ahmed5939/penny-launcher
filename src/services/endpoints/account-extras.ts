import { avatarService, socialBanService } from '../config/account-extras'

/**
 * Avatars for many accounts at once. Any linked account's token will do —
 * the service answers for whichever ids it is asked about — so one token
 * covers linked accounts and friends alike. The reply is
 * `[{ accountId, namespace, avatarId }]`.
 */
export function getAccountAvatars({
  accessToken,
  accountIds,
}: {
  accessToken: string
  accountIds: Array<string>
}) {
  return avatarService.get<unknown>('/avatar/fortnite/ids', {
    params: { accountIds: accountIds.join(',') },
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}

/**
 * One account's bans and warnings, `{ bans: [], warnings: [] }`. Only with
 * that account's own token.
 */
export function getSocialStanding({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return socialBanService.get<unknown>(`/${accountId}`, {
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}
