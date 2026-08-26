import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import {
  addFriend,
  blockUser,
  getFriendsSummary,
  removeFriend,
  unblockUser,
} from '../../services/endpoints/friends'
import { findUsersByAccountIds } from '../../services/endpoints/lookup'
import { searchUsers } from '../../services/endpoints/user-search'

export type FriendLinkedAccount = {
  displayName: string
  platform: string
}

export type FriendKind = 'blocked' | 'friend' | 'incoming' | 'outgoing'

export type FriendEntry = {
  accountId: string
  alias: string
  created: string
  displayName: string
  favorite: boolean
  /**
   * Where `displayName` came from. `id` means we found nothing usable, and
   * a PennyDB lookup would be pointless.
   */
  nameSource: 'epic' | 'platform' | 'id'
  kind: FriendKind
  linked: Array<FriendLinkedAccount>
  mutual: number
  note: string
}

export type FriendsPayload = {
  accountId: string
  entries: Array<FriendEntry>
  errorMessage?: string
  limitsReached?: {
    accepted: boolean
    incoming: boolean
    outgoing: boolean
  }
}

export type FriendsSearchResult = {
  accountId: string
  displayName: string
  /** `exact` sorts above `prefix`. */
  matchType: string
  mutual: number
  platform: string
}

export type FriendsSearchPayload = {
  errorMessage?: string
  query: string
  results: Array<FriendsSearchResult>
}

export type FriendsActionPayload = {
  action: 'add' | 'block' | 'remove' | 'unblock'
  errorMessage?: string
  targetAccountId: string
  total?: number
}

/** Epic caps the bulk account lookup at 100 ids. */
const lookupChunkSize = 100

function chunk<T>(items: Array<T>, size: number) {
  const chunks: Array<Array<T>> = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

/**
 * Friends for the currently selected account.
 *
 * Scoped to one account on purpose: this backs a side panel you keep open
 * while working, not a bulk operation over every account you own.
 */
export class FriendsManager {
  static async request(account: AccountData) {
    const payload: FriendsPayload = {
      accountId: account.accountId,
      entries: [],
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        payload.errorMessage = 'Could not authenticate this account'

        return FriendsManager.send(payload)
      }

      const summary = await getFriendsSummary({
        accessToken,
        accountId: account.accountId,
      })

      const collected: Array<
        Omit<FriendEntry, 'displayName' | 'linked' | 'nameSource'>
      > = [
          ...summary.data.friends.map((item) => ({
            accountId: item.accountId,
            alias: item.alias ?? '',
            created: item.created ?? '',
            favorite: item.favorite ?? false,
            kind: 'friend' as const,
            mutual: item.mutual ?? 0,
            note: item.note ?? '',
          })),
          ...summary.data.incoming.map((item) => ({
            accountId: item.accountId,
            alias: item.alias ?? '',
            created: item.created ?? '',
            favorite: item.favorite ?? false,
            kind: 'incoming' as const,
            mutual: item.mutual ?? 0,
            note: item.note ?? '',
          })),
          ...summary.data.outgoing.map((item) => ({
            accountId: item.accountId,
            alias: item.alias ?? '',
            created: item.created ?? '',
            favorite: item.favorite ?? false,
            kind: 'outgoing' as const,
            mutual: item.mutual ?? 0,
            note: item.note ?? '',
          })),
          ...summary.data.blocklist.map((item) => ({
            accountId: item.accountId,
            alias: item.alias ?? '',
            created: item.created ?? '',
            favorite: item.favorite ?? false,
            kind: 'blocked' as const,
            mutual: 0,
            note: item.note ?? '',
          })),
        ]

      payload.limitsReached = summary.data.limitsReached

      const names = await FriendsManager.resolveNames(
        accessToken,
        collected.map((item) => item.accountId)
      )

      payload.entries = collected
        .map((item) => ({
          ...item,
          displayName: names[item.accountId]?.displayName ?? item.accountId,
          linked: names[item.accountId]?.linked ?? [],
          nameSource: names[item.accountId]?.nameSource ?? 'id',
        }))
        .toSorted((itemA, itemB) =>
          Number(itemB.favorite) - Number(itemA.favorite) ||
          itemA.displayName.localeCompare(itemB.displayName)
        )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      payload.errorMessage =
        error?.response?.data?.errorMessage ?? 'Could not load friends'
    }

    return FriendsManager.send(payload)
  }

  /**
   * Resolves display names and linked console accounts in batches of 100.
   * A failed chunk degrades to raw ids rather than failing the whole list.
   */
  private static async resolveNames(
    accessToken: string,
    accountIds: Array<string>
  ) {
    const resolved: Record<
      string,
      {
        displayName: string
        linked: Array<FriendLinkedAccount>
        nameSource: FriendEntry['nameSource']
      }
    > = {}

    if (accountIds.length <= 0) {
      return resolved
    }

    const batches = await Promise.allSettled(
      chunk([...new Set(accountIds)], lookupChunkSize).map((ids) =>
        findUsersByAccountIds({ accessToken, accountIds: ids })
      )
    )

    batches.forEach((batch) => {
      if (batch.status !== 'fulfilled') {
        return
      }

      batch.value.data.forEach((item) => {
        const linked = Object.entries(item.externalAuths ?? {})
          .map(([platform, auth]) => ({
            platform,
            displayName: auth?.externalDisplayName ?? '',
          }))
          .filter((link) => link.displayName.length > 0)

        /**
         * Console-only accounts have no Epic display name. Falling back to
         * the raw account id gives you a row of hex you cannot act on, so
         * borrow the first linked platform's name instead.
         */
        resolved[item.id] = {
          displayName:
            item.displayName ?? linked[0]?.displayName ?? item.id,
          linked,
          nameSource: item.displayName
            ? 'epic'
            : linked[0]?.displayName
              ? 'platform'
              : 'id',
        }
      })
    })

    return resolved
  }

  static async search(account: AccountData, query: string) {
    const payload: FriendsSearchPayload = { query, results: [] }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        payload.errorMessage = 'Could not authenticate this account'

        return FriendsManager.sendSearch(payload)
      }

      const response = await searchUsers({
        accessToken,
        accountId: account.accountId,
        prefix: query,
      })

      payload.results = response.data
        .toSorted((itemA, itemB) => itemA.sortPosition - itemB.sortPosition)
        .slice(0, 5)
        .map((item) => ({
          accountId: item.accountId,
          displayName: item.matches[0]?.value ?? item.accountId,
          matchType: item.matchType,
          mutual: item.epicMutuals ?? 0,
          platform: item.matches[0]?.platform ?? 'epic',
        }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      payload.errorMessage =
        error?.response?.data?.errorMessage ?? 'Search failed'
    }

    return FriendsManager.sendSearch(payload)
  }

  static async action(
    account: AccountData,
    targetAccountId: string,
    action: FriendsActionPayload['action']
  ) {
    const payload: FriendsActionPayload = { action, targetAccountId }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        payload.errorMessage = 'Could not authenticate this account'

        return FriendsManager.sendAction(payload)
      }

      const request = {
        add: addFriend,
        remove: removeFriend,
        block: blockUser,
        unblock: unblockUser,
      }[action]

      await request({
        accessToken,
        accountId: account.accountId,
        // The friend and blocklist endpoints name this parameter differently.
        friendId: targetAccountId,
        userId: targetAccountId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      payload.errorMessage =
        error?.response?.data?.errorMessage ?? 'Action failed'
    }

    return FriendsManager.sendAction(payload)
  }

  static async bulkAction(
    account: AccountData,
    targetAccountIds: Array<string>,
    action: 'add' | 'remove'
  ) {
    const uniqueIds = [...new Set(targetAccountIds)].slice(0, 500)
    const payload: FriendsActionPayload = {
      action,
      targetAccountId: '__bulk__',
      total: uniqueIds.length,
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        payload.errorMessage = 'Could not authenticate this account'
        return FriendsManager.sendAction(payload)
      }

      const request = action === 'add' ? addFriend : removeFriend
      const results: Array<PromiseSettledResult<unknown>> = []

      // Keep concurrency modest; Epic rate-limits large friends lists.
      for (const batch of chunk(uniqueIds, 10)) {
        results.push(
          ...(await Promise.allSettled(
            batch.map((friendId) =>
              request({ accessToken, accountId: account.accountId, friendId })
            )
          ))
        )
      }
      const failed = results.filter((result) => result.status === 'rejected').length

      if (failed > 0) {
        payload.errorMessage = `${uniqueIds.length - failed} succeeded; ${failed} failed`
      }
    } catch {
      payload.errorMessage = 'Bulk action failed'
    }

    return FriendsManager.sendAction(payload)
  }

  private static send(payload: FriendsPayload) {
    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.FriendsManagerResponse,
      payload
    )
  }

  private static sendSearch(payload: FriendsSearchPayload) {
    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.FriendsManagerSearchResponse,
      payload
    )
  }

  private static sendAction(payload: FriendsActionPayload) {
    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.FriendsManagerActionNotification,
      payload
    )
  }
}
