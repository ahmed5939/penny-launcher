import type {
  FetchFriendResponse,
  FetchFriendsSummaryResponse,
} from '../../types/services/friends'

import { friendsService } from '../config/friends'

/**
 * Friends, plus pending requests in both directions and the blocklist, in
 * one call. Asking per-friend is only worth it when you already know the id.
 */
export function getFriendsSummary({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return friendsService.get<FetchFriendsSummaryResponse>(
    `/${accountId}/summary`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    },
  )
}

export function getFriend({
  accessToken,
  accountId,
  friendId,
}: {
  accessToken: string
  accountId: string
  friendId: string
}) {
  return friendsService.get<FetchFriendResponse>(
    `/${accountId}/friends/${friendId}`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    },
  )
}

export function addFriend({
  accessToken,
  accountId,
  friendId,
}: {
  accessToken: string
  accountId: string
  friendId: string
}) {
  return friendsService.post(
    `/${accountId}/friends/${friendId}`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    },
  )
}

export function removeFriend({
  accessToken,
  accountId,
  friendId,
}: {
  accessToken: string
  accountId: string
  friendId: string
}) {
  return friendsService.delete(`/${accountId}/friends/${friendId}`, {
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}

/** Blocking also drops the friendship, if there was one. */
export function blockUser({
  accessToken,
  accountId,
  userId,
}: {
  accessToken: string
  accountId: string
  userId: string
}) {
  return friendsService.post(
    `/${accountId}/blocklist/${userId}`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    },
  )
}

export function unblockUser({
  accessToken,
  accountId,
  userId,
}: {
  accessToken: string
  accountId: string
  userId: string
}) {
  return friendsService.delete(`/${accountId}/blocklist/${userId}`, {
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}
