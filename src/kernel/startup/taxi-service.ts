import { RuntimeLog } from '../runtime-log'
import type {
  TaxiServiceAccountData,
  TaxiServiceAccountFileData,
  TaxiServiceAccountFileDataList,
  TaxiServiceAccountServerData,
  TaxiServiceServiceActionConfig,
  TaxiServiceServiceLogEntry,
  TaxiServiceServiceStatusResponse,
} from '../../types/taxi-service'

import { Collection } from '@discordjs/collection'
import { Client } from 'fnbr'

import { AutomationStatusType } from '../../config/constants/automation'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { Authentication } from '../core/authentication'
import { LookupManager } from '../core/lookup'
import { MainWindow } from './windows/main'
import { AccountsManager } from './accounts'
import { DataDirectory } from './data-directory'

import {
  TaxiServiceNotificationEventFriendAdded,
  TaxiServiceNotificationEventFriendRequestSend,
  TaxiServiceNotificationEventPartyInvite,
  TaxiServiceNotificationEventPartyMemberJoined,
  TaxiServiceNotificationType,
} from '../../state/stw-operations/taxi-service'

import { addFriend, removeFriend } from '../../services/endpoints/friends'

import { getExtendedDateFormat } from '../../lib/dates'
import { parseCustomDisplayName } from '../../lib/utils'

export enum AccountPresence {
  Active = 'active',
  DnD = 'dnd',
  Unknown = 'unknown',
}

export enum AccountStatus {
  Offline = 'offline',
  Online = 'online',
}

export enum MatchmakingResult {
  NotStarted = 'NotStarted',
  Success = 'Success',
}

export enum MatchmakingState {
  FindingEmptyServer = 'FindingEmptyServer',
  JoiningExistingSession = 'JoiningExistingSession',
  NotMatchmaking = 'NotMatchmaking',
  TestingEmptyServers = 'TestingEmptyServers',
}

export type PartyMetaSchema = {
  'Default:CampaignInfo_j': {
    CampaignInfo: {
      matchmakingResult: MatchmakingResult
      matchmakingState: MatchmakingState
    }
  }
  'Default:ZoneInstanceId_s'?: {
    /**
     * Main zone Id: Stonewood, Plankerton, Canny Valley, Twine Peaks, etc
     */
    theaterId: string
    /**
     * Mission Alert Id (one-time extra reward)
     */
    theaterMissionAlertId: string
    /**
     * Mission Id
     */
    theaterMissionId: string
    worldId: string
    zoneThemeClass: string
  }
}

type QueueEntry = {
  accountId: string
  displayName: string
  partyId: string
}

type AccountService = {
  accountId: string
  status: AccountPresence
  client: Client
  currentTimeout?: NodeJS.Timeout | null
  /** True while the bot serves a passenger — invites then go to the queue. */
  occupied: boolean
  /** Pending passengers waiting for the current session to end. */
  queue: Array<QueueEntry>
  /** True while leaving one party to join another, so leave handlers don't double-fire. */
  transitioning: boolean
  /** Disconnect timestamps within the last 30s, for flap detection. */
  disconnectLog: Array<number>
}

const maxRetries = 3

/**
 * Homebase-rating curve — maps a FORT stat value to the power level the
 * client presents, interpolated between Epic's known data points. Ported
 * from the community power-level tables used by taxi bots, so a taxi can
 * present any power level between 1 and 288 instead of only extremes.
 */
const HOMEBASE_RATING_KEYS: Array<[number, number]> = [
  [0, 1], [236, 2], [364, 3], [432, 4], [512, 5],
  [704, 7], [932, 8], [1196, 9], [1876, 13], [2740, 16],
  [3824, 19], [4692, 22], [5460, 24], [6260, 25], [7172, 26],
  [8084, 29], [9552, 32], [10912, 36], [13104, 41], [14844, 46],
  [17180, 49], [19008, 53], [20928, 54], [22708, 55], [24588, 57],
  [26324, 60], [28804, 63], [31312, 68], [35008, 73], [37660, 78],
  [40380, 81], [42308, 84], [44316, 86], [46448, 87], [48592, 89],
  [50852, 93], [54480, 96], [58064, 102], [62528, 107], [65472, 113],
  [68320, 116], [70400, 120], [72384, 121], [74464, 123], [76448, 124],
  [78528, 126], [80512, 127], [82592, 128], [84576, 130], [86124, 131],
  [87040, 133], [87520, 134], [87904, 136], [88384, 137], [88768, 139],
  [89248, 140], [89632, 142], [90112, 143], [90304, 144], [180608, 288],
]

function evalCurve(key: number): number {
  const first = HOMEBASE_RATING_KEYS[0]
  const last = HOMEBASE_RATING_KEYS[HOMEBASE_RATING_KEYS.length - 1]

  if (key <= first[0]) {
    return first[1]
  }

  if (key >= last[0]) {
    return last[1]
  }

  for (let index = 1; index < HOMEBASE_RATING_KEYS.length; index++) {
    const [nextTime, nextValue] = HOMEBASE_RATING_KEYS[index]

    if (HOMEBASE_RATING_KEYS[index][0] > key) {
      const [previousTime, previousValue] = HOMEBASE_RATING_KEYS[index - 1]
      const factor = (key - previousTime) / (nextTime - previousTime)

      return previousValue * (1 - factor) + nextValue * factor
    }
  }

  return last[1]
}

/**
 * Finds the per-stat FORT value whose curve evaluation lands on the
 * requested power level (binary search over stat values, stepped by 16
 * like the original tooling).
 */
function findStatForPowerLevel(targetPowerLevel: number): number {
  if (targetPowerLevel <= 1) {
    return 1
  }

  if (targetPowerLevel >= 288) {
    return 180_608
  }

  let low = 1
  let high = 10_000

  while (low <= high) {
    const mid = (low + high) >> 1
    const calculated = evalCurve(mid * 16)

    if (Math.abs(calculated - targetPowerLevel) < 0.5) {
      return mid
    }

    if (calculated < targetPowerLevel) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return high
}

function resolvePowerLevel(
  actions: Partial<{
    high?: boolean
    powerLevel?: number
  }> | null | undefined
): number {
  const configured = actions?.powerLevel

  if (typeof configured === 'number' && configured >= 1) {
    return Math.min(288, Math.max(1, Math.round(configured)))
  }

  /**
   * Legacy configs only had the binary high/low switch — map it onto the
   * same two power levels it used to send.
   */
  return actions?.high === false ? 1 : 130
}

export class TaxiService {
  private static _accounts: Collection<
    string,
    TaxiServiceAccountServerData
  > = new Collection()
  private static _services: Collection<string, AccountService> =
    new Collection()
  private static _retryCounters: Collection<string, number> =
    new Collection()
  private static _reJoinTo: Collection<string, string> = new Collection()
  /** accountId → epoch ms when the reconnect cooldown ends. */
  private static _cooldowns: Collection<string, number> = new Collection()

  private static log(
    accountId: string,
    level: TaxiServiceServiceLogEntry['level'],
    message: string,
  ) {
    const entry: TaxiServiceServiceLogEntry = {
      accountId,
      level,
      message,
      timestamp: Date.now(),
    }

    if (level === 'error') {
      RuntimeLog.error('taxi-service', new Error(message))
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.TaxiServiceServiceLog,
      entry,
    )
  }

  static async load() {
    const { taxiService } = await DataDirectory.getTaxiServiceFile()
    const accounts = AccountsManager.getAccounts()

    Object.values(taxiService).forEach((data) => {
      if (accounts.has(data.accountId)) {
        TaxiService._accounts.set(data.accountId, {
          ...data,
          status: AutomationStatusType.LOADING,
        })
        TaxiService.start(data)
      }
    })

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.TaxiServiceServiceResponseData,
      taxiService,
      false,
    )
  }

  static async sendRequests(
    origin: Array<string>,
    destination: Array<string>,
  ) {
    origin.map(async (accountId) => {
      const account = AccountsManager.getAccountById(accountId)

      if (!account) {
        return
      }

      const response = await Promise.all(
        destination.map(async (displayName) => {
          const result = await LookupManager.searchUserByDisplayName({
            account,
            displayName,
          })

          if (!result.success) {
            return {
              displayName,
              accountId: displayName,
              error: result.errorCode,
            } as TaxiServiceNotificationEventFriendRequestSend['accounts'][number]
          }

          const accessToken =
            await Authentication.verifyAccessToken(account)

          if (!accessToken) {
            return {
              displayName,
              accountId: displayName,
              error: 'invalid_access_token',
            } as TaxiServiceNotificationEventFriendRequestSend['accounts'][number]
          }

          try {
            await addFriend({
              accessToken,
              accountId,
              friendId: result.data.id,
            })

            return {
              accountId: result.data.id,
              displayName: result.data.displayName,
            } as TaxiServiceNotificationEventFriendRequestSend['accounts'][number]

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            const response =
              (error?.response?.data as Record<string, number | string>) ??
              {}

            return {
              accountId: result.data.id,
              displayName: result.data.displayName,
              error:
                `${response.errorCode}`?.split('.')?.at(-1) ?? 'UNKNOWN',
            } as TaxiServiceNotificationEventFriendRequestSend['accounts'][number]
          }
        }),
      )

      const data = {
        id: crypto.randomUUID(),
        accounts: response,
        createdAt: getExtendedDateFormat(),
        me: {
          accountId: account.accountId,
          displayName: parseCustomDisplayName(account),
        },
        type: TaxiServiceNotificationType.FriendRequestSend,
        withErrors: response.some((item) => item.error !== undefined),
      } as TaxiServiceNotificationEventFriendRequestSend

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.TaxiServiceServiceNotifications,
        data,
      )
    })
  }

  static async addAccount(accountId: string) {
    const result = await DataDirectory.getTaxiServiceFile()
    const data = {
      accountId,
      actions: {
        autoReady: true,
        denyFriendsRequests: true,
        isPrivate: false,
        leaveMinutes: 2,
        level: 100,
        powerLevel: 130,
        skin: 'CID_028_Athena_Commando_F',
        emote: 'EID_Floss',
        activeStatus: '',
        busyStatus: '',
      },
      whitelist: [],
    }

    await DataDirectory.updateTaxiServiceFile({
      ...result.taxiService,
      [accountId]: data,
    })
    TaxiService._accounts.set(data.accountId, {
      ...data,
      status: AutomationStatusType.LOADING,
    })
    TaxiService.start(data)
  }

  static async removeAccount(accountId: string) {
    const currentTimeout =
      TaxiService.getServiceByAccountId(accountId)?.currentTimeout

    if (currentTimeout !== null && currentTimeout !== undefined) {
      TaxiService.getServiceByAccountId(accountId)?.client.clearTimeout(
        currentTimeout,
      )
    }

    TaxiService.updateAccountData(accountId, {
      status: AutomationStatusType.LOADING,
    })
    TaxiService.getServiceByAccountId(
      accountId,
    )?.client.removeAllListeners()
    TaxiService.getServiceByAccountId(accountId)?.client.xmpp.disconnect()
    TaxiService.getServiceByAccountId(accountId)?.client.logout()

    await TaxiService.refreshData(accountId, true)
  }

  static async updateAction(
    accountId: string,
    config: TaxiServiceServiceActionConfig,
  ) {
    const current = TaxiService._accounts.get(accountId)

    if (!current) {
      return
    }

    TaxiService.updateAccountData(accountId, {
      actions: {
        [config.type]: config.value,
      },
    })

    const result = await DataDirectory.getTaxiServiceFile()
    const data = {
      accountId,
      actions: {
        ...current.actions,
        [config.type]: config.value,
      },
      whitelist: current.whitelist,
    }

    await DataDirectory.updateTaxiServiceFile({
      ...result.taxiService,
      [accountId]: data,
    })
  }

  static async addWhitelist(accountId: string, displayName: string) {
    const account = AccountsManager.getAccountById(accountId)

    if (!account) {
      return
    }

    const result = await LookupManager.searchUserByDisplayName({
      account,
      displayName: displayName.trim(),
    })

    if (!result.success) {
      TaxiService.log(
        accountId,
        'error',
        `Could not find user "${displayName.trim()}"`,
      )
      return
    }

    const current = TaxiService._accounts.get(accountId)

    if (!current) {
      return
    }

    if (current.whitelist.some((entry) => entry.accountId === result.data.id)) {
      return
    }

    const whitelist = [
      ...current.whitelist,
      {
        accountId: result.data.id,
        displayName: result.data.displayName ?? displayName.trim(),
      },
    ]

    TaxiService.updateAccountData(accountId, { whitelist })

    const stored = await DataDirectory.getTaxiServiceFile()

    await DataDirectory.updateTaxiServiceFile({
      ...stored.taxiService,
      [accountId]: {
        accountId,
        actions: current.actions,
        whitelist,
      },
    })

    TaxiService.log(
      accountId,
      'success',
      `Whitelisted ${result.data.displayName ?? displayName.trim()}`,
    )
  }

  static async removeWhitelist(accountId: string, targetId: string) {
    const current = TaxiService._accounts.get(accountId)

    if (!current) {
      return
    }

    const target = current.whitelist.find((entry) => entry.accountId === targetId)
    const whitelist = current.whitelist.filter(
      (entry) => entry.accountId !== targetId,
    )

    TaxiService.updateAccountData(accountId, { whitelist })

    const stored = await DataDirectory.getTaxiServiceFile()

    await DataDirectory.updateTaxiServiceFile({
      ...stored.taxiService,
      [accountId]: {
        accountId,
        actions: current.actions,
        whitelist,
      },
    })

    if (target) {
      TaxiService.log(
        accountId,
        'info',
        `Removed ${target.displayName || target.accountId} from the whitelist`,
      )
    }
  }

  static start(data: TaxiServiceAccountFileData) {
    const setNewStatus = (status: AutomationStatusType) => {
      TaxiService.updateAccountData(data.accountId, {
        status,
      })
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.TaxiServiceServiceStartNotification,
        {
          accountId: data.accountId,
          status,
        } as TaxiServiceServiceStatusResponse,
      )
    }

    setNewStatus(AutomationStatusType.LOADING)

    const defaultStatuses = {
      active: () => {
        const info = TaxiService._accounts.get(data.accountId)

        if (!info) {
          return 'Libre'
        }

        return info.actions.activeStatus.trim().length > 0
          ? info.actions.activeStatus.trim()
          : 'Libre'
      },
      busy: () => {
        const info = TaxiService._accounts.get(data.accountId)

        if (!info) {
          return 'Ocupado'
        }

        const service = TaxiService._services.get(data.accountId)
        const queueLength = service?.queue.length ?? 0

        return info.actions.busyStatus.trim().length > 0
          ? info.actions.busyStatus.trim().replace(
              '{queue}',
              String(queueLength),
            )
          : queueLength > 0
            ? `Ocupado · Queue: ${queueLength}`
            : 'Ocupado'
      },
    }
    const account = AccountsManager.getAccountById(data.accountId)!

    const accountService: AccountService = {
      accountId: account.accountId,
      status: AccountPresence.Unknown,
      currentTimeout: null as undefined | NodeJS.Timeout | null,
      occupied: false,
      queue: [],
      transitioning: false,
      disconnectLog: [],
      client: new Client({
        auth: {
          deviceAuth: {
            accountId: account.accountId,
            deviceId: account.deviceId,
            secret: account.secret,
          },
          authClient: 'fortniteAndroidGameClient',
          createLauncherSession: false,
          killOtherTokens: false,
        },
        partyConfig: {
          chatEnabled: false,
          discoverability: 'INVITED_ONLY',
          joinability: 'INVITE_AND_FORMER',
          joinConfirmation: true,
          maxSize: 4,
          privacy: {
            acceptingMembers: true,
            invitePermission: 'AnyMember',
            inviteRestriction: 'AnyMember',
            onlyLeaderFriendsCanJoin: false,
            partyType: 'Private',
            presencePermission: 'Anyone',
          },
        },
        defaultOnlineType: 'away',
        defaultStatus: defaultStatuses.active(),
        restRetryLimit: 3,
        xmppMaxConnectionRetries: 3,
      }),
    }

    const clearCurrentTimeout = () => {
      if (
        accountService.currentTimeout !== null &&
        accountService.currentTimeout !== undefined
      ) {
        accountService.client.clearTimeout(accountService.currentTimeout)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reAuth = (error: any) => {
      const restartErrors = [
        'disconnect',
        'invalid_refresh_token',
        'party_not_found',
      ].some((code) => error?.code?.toLowerCase().includes(code))

      if (restartErrors) {
        if (error?.code === 'disconnect') {
          if (
            (TaxiService._retryCounters.get(account.accountId) ?? 0) <
            maxRetries
          ) {
            TaxiService.reload([account.accountId])
          } else {
            TaxiService._retryCounters.delete(account.accountId)
          }
        } else {
          TaxiService.reload([account.accountId])
        }
      }
    }
    const disconnect = () => {
      setNewStatus(AutomationStatusType.DISCONNECTED)

      if (!TaxiService._retryCounters.has(account.accountId)) {
        TaxiService._retryCounters.set(account.accountId, 0)
      }

      accountService.status = AccountPresence.Unknown
      TaxiService._retryCounters.set(
        account.accountId,
        (TaxiService._retryCounters.get(account.accountId) ?? 0) + 1,
      )

      /**
       * Flap detection — three disconnects inside 30 seconds means the
       * login loop is thrashing Epic's auth. Park the account for 10s and
       * restart fresh instead of burning retries.
       */
      const now = Date.now()
      const recent = accountService.disconnectLog.filter(
        (timestamp) => now - timestamp < 30_000,
      )
      recent.push(now)
      accountService.disconnectLog = recent

      if (recent.length >= 3) {
        TaxiService.log(
          account.accountId,
          'error',
          'Connection loop detected — pausing 10s before reconnecting',
        )
        accountService.disconnectLog = []
        TaxiService._retryCounters.delete(account.accountId)

        setTimeout(() => {
          TaxiService.reload([account.accountId]).catch((error) => {
            RuntimeLog.error('caught:startup/taxi-service.ts', error)
          })
        }, 10_000)

        return
      }

      reAuth({ code: 'disconnect' })
    }

    /**
     * Ghost-equips the configured cosmetics on the bot's party member so
     * passengers see the expected skin, banner and level while riding.
     */
    const applyCosmetics = async () => {
      const info = TaxiService._accounts.get(account.accountId)

      if (!info) {
        return
      }

      const me = accountService.client.party?.me

      if (!me) {
        return
      }

      try {
        await me.setOutfit(info.actions.skin)
      } catch (error) {
        RuntimeLog.error('caught:startup/taxi-service.ts', error)
      }

      try {
        await me.setBanner('standardbanner15', 'defaultcolor2')
      } catch {
        // Banner is cosmetic-only — never worth surfacing.
      }

      try {
        await me.setLevel(info.actions.level)
      } catch (error) {
        RuntimeLog.error('caught:startup/taxi-service.ts', error)
      }

      await TaxiService.updatePatch(accountService)

      try {
        if (info.actions.emote.trim().length > 0) {
          await me.setEmote(info.actions.emote)
        }
      } catch {
        // Emotes fail silently when the id is wrong.
      }
    }

    const updateOccupiedStatus = () => {
      accountService.client.setStatus(defaultStatuses.busy(), 'away')
    }

    const startLeaveTimer = () => {
      clearCurrentTimeout()

      const info = TaxiService._accounts.get(account.accountId)
      const minutes = info?.actions.leaveMinutes ?? 2

      TaxiService.log(
        account.accountId,
        'info',
        `Leaving the party in ${minutes} min`,
      )

      accountService.currentTimeout = accountService.client.setTimeout(
        () => {
          try {
            accountService.client.leaveParty().catch(() => {})

            accountService.currentTimeout = null

            void finishSession()
          } catch (_error) {
            RuntimeLog.error('caught:startup/taxi-service.ts', _error)
          }
        },
        minutes * 60_000 + 1_000,
      )
    }

    const processNextInQueue = async (): Promise<void> => {
      const next = accountService.queue.shift()

      if (!next) {
        accountService.occupied = false
        accountService.status = AccountPresence.Active
        accountService.client.setStatus(defaultStatuses.active(), 'away')
        return
      }

      updateOccupiedStatus()

      TaxiService.log(
        account.accountId,
        'info',
        `Processing queue: ${next.displayName}`,
      )

      try {
        accountService.transitioning = true
        await accountService.client.leaveParty().catch(() => {})
        await new Promise((resolve) => {
          setTimeout(resolve, 2_000)
        })

        let joined = false

        if (next.partyId) {
          try {
            await accountService.client.joinParty(next.partyId)
            joined = true
          } catch {
            // Party may be gone or full — fall through to the next passenger.
          }
        }

        accountService.transitioning = false

        if (joined) {
          accountService.occupied = true
          accountService.status = AccountPresence.DnD

          await new Promise((resolve) => {
            setTimeout(resolve, 1_500)
          })
          await applyCosmetics()

          updateOccupiedStatus()
          startLeaveTimer()

          TaxiService.log(
            account.accountId,
            'success',
            `Joined ${next.displayName}'s party from the queue`,
          )
        } else {
          TaxiService.log(
            account.accountId,
            'warn',
            `Could not rejoin ${next.displayName} — trying the next in queue`,
          )
          await processNextInQueue()
        }
      } catch (error) {
        accountService.transitioning = false
        RuntimeLog.error('caught:startup/taxi-service.ts', error)
        await processNextInQueue()
      }
    }

    const finishSession = async (): Promise<void> => {
      clearCurrentTimeout()
      accountService.occupied = false

      if (accountService.queue.length > 0) {
        await processNextInQueue()
        return
      }

      accountService.status = AccountPresence.Active
      accountService.client.setStatus(defaultStatuses.active(), 'away')

      try {
        await accountService.client.leaveParty()
      } catch {
        // Already out of the party.
      }
    }

    const initTimeout = setTimeout(() => {
      setNewStatus(AutomationStatusType.ERROR)
      accountService.status = AccountPresence.Unknown
      disconnect()
    }, 10_000) // 10 seconds

    accountService.client.once('ready', () => {
      setNewStatus(AutomationStatusType.LISTENING)
      accountService.status = AccountPresence.Active
      clearTimeout(initTimeout)

      const denyFriendsRequests =
        TaxiService._accounts.get(accountService.accountId)?.actions
          .denyFriendsRequests ?? true

      if (denyFriendsRequests) {
        const pendingList =
          accountService.client.friend.pendingList.filter(
            (item) => item.direction === 'INCOMING',
          )

        Authentication.verifyAccessToken(account).then((accessToken) => {
          if (!accessToken) {
            return
          }

          pendingList.forEach((pending) => {
            removeFriend({
              accessToken,
              accountId: account.accountId,
              friendId: pending.id,
            })
          })
        })
      }

      if (TaxiService._reJoinTo.has(account.accountId)) {
        accountService.client.friend
          .resolve(TaxiService._reJoinTo.get(account.accountId)!)
          ?.sendJoinRequest()
          .catch(() => {})
        TaxiService._reJoinTo.delete(account.accountId)
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountService.client.on('xmpp:message:error', (error: any) => {
      reAuth(error)
    })
    accountService.client.on('disconnected', () => {
      disconnect()
    })
    accountService.client.on('party:member:disconnected', (member) => {
      if (member.id === accountService.accountId) {
        disconnect()
      }
    })
    accountService.client.on('party:member:expired', (member) => {
      if (member.id === accountService.accountId) {
        TaxiService.log(account.accountId, 'warn', 'Kicked from the party')
        void finishSession()
      }
    })
    accountService.client.on('party:member:kicked', (member) => {
      if (member.id === accountService.accountId) {
        clearCurrentTimeout()
        accountService.occupied = false
        accountService.status = AccountPresence.Active
        accountService.client.setStatus(defaultStatuses.active(), 'away')
      }
    })
    accountService.client.on('party:member:left', (member) => {
      if (
        member.id === accountService.accountId ||
        (member.party.members.size === 1 &&
          member.party.members.first()?.id === accountService.accountId)
      ) {
        if (accountService.transitioning) {
          return
        }

        void finishSession()
      }
    })

    /**
     * Readiness follows the passenger — as soon as someone else in the
     * party readies up, the taxi readies too so the lobby countdown starts.
     */
    accountService.client.on(
      'party:member:readiness:updated',
      (member, ready) => {
        const autoReady =
          TaxiService._accounts.get(accountService.accountId)?.actions
            .autoReady ?? true

        if (
          !autoReady ||
          member.id === accountService.accountId ||
          ready !== true
        ) {
          return
        }

        accountService.client.party?.me
          ?.setReadiness(true)
          .catch(() => {})
      },
    )

    accountService.client.on('friend:request', (incoming) => {
      const info = TaxiService._accounts.get(accountService.accountId)

      const denyFriendsRequests =
        info?.actions.denyFriendsRequests ?? true
      const isPrivate = info?.actions.isPrivate ?? false

      if (isPrivate && !info?.whitelist.some((entry) => entry.accountId === incoming.id)) {
        TaxiService.log(
          accountService.accountId,
          'warn',
          `Rejected friend request from ${incoming.displayName ?? incoming.id} — not whitelisted`,
        )

        Authentication.verifyAccessToken(account).then((accessToken) => {
          if (!accessToken) {
            return
          }

          removeFriend({
            accessToken,
            accountId: accountService.accountId,
            friendId: incoming.id,
          }).catch(() => {})
        })

        return
      }

      TaxiService.log(
        accountService.accountId,
        'info',
        `Friend request from ${incoming.displayName ?? incoming.id}`,
      )

      Authentication.verifyAccessToken(account).then((accessToken) => {
        if (!accessToken) {
          return
        }

        const data = {
          accessToken,
          accountId: accountService.accountId,
          friendId: incoming.id,
        }

        if (denyFriendsRequests) {
          removeFriend(data)
        } else {
          addFriend(data)
        }
      })
    })

    accountService.client.on('party:member:joined', async (member) => {
      try {
        const partyMetaSchema: Record<string, string> =
          member.party.meta.schema
        const defaultCampaignInfo: PartyMetaSchema['Default:CampaignInfo_j'] =
          JSON.parse(partyMetaSchema['Default:CampaignInfo_j'])
        const { matchmakingState } = defaultCampaignInfo.CampaignInfo

        if (
          matchmakingState !== MatchmakingState.NotMatchmaking &&
          member.id === accountService.accountId
        ) {
          member.client.leaveParty().catch(() => {})
          clearCurrentTimeout()

          accountService.status = AccountPresence.DnD
          member.client.setStatus(defaultStatuses.active(), 'away')

          return
        }
      } catch (error) {
        RuntimeLog.error('caught:startup/taxi-service.ts', error)
      }

      const filteredMembersId = member.party.members.filter(({ id }) =>
        TaxiService._accounts.has(id),
      )

      if (filteredMembersId.size > 1) {
        /**
         * Only one client at a time can be on the team
         */
        const randomMember = filteredMembersId.random()
        const removeThisMembers = filteredMembersId
          .filter(({ id }) => randomMember?.id !== id)
          .map((item) => item.id)

        await Promise.allSettled(
          removeThisMembers.map(async (item) => {
            const currentClient = TaxiService._services.get(item)

            if (currentClient) {
              try {
                await currentClient.client.party?.leave()
              } catch (error) {
                RuntimeLog.error('caught:startup/taxi-service.ts', error)
              }

              clearCurrentTimeout()

              currentClient.status = AccountPresence.Active
              currentClient.client.setStatus(
                defaultStatuses.active(),
                'away',
              )
            }
          }),
        )

        return
      }

      let members = member.party.members
        .map((item) => ({
          accountId: item.id,
          displayName: item.displayName,
          isLeader: item.isLeader,
          isSender: false,
        }))
        .filter((item) => item.accountId !== account.accountId)

      if (
        members.length === 0 ||
        (members.length === 1 &&
          members[0]?.accountId === account.accountId)
      ) {
        return
      }

      members = await Promise.all(
        members.map(async (item) => {
          if (typeof item.displayName !== 'string') {
            const result = await LookupManager.searchUserByDisplayName({
              account,
              displayName: item.accountId,
            })

            if (result.success) {
              return {
                ...item,
                displayName: result.data.displayName ?? item.accountId,
              }
            }
          }

          return {
            ...item,
            displayName: item.displayName ?? item.accountId,
          }
        }),
      )

      const data = {
        members,
        id: crypto.randomUUID(),
        createdAt: getExtendedDateFormat(),
        me: {
          accountId: account.accountId,
          displayName: parseCustomDisplayName(account),
        },
        type: TaxiServiceNotificationType.PartyMemberJoined,
      } as TaxiServiceNotificationEventPartyMemberJoined

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.TaxiServiceServiceNotifications,
        data,
      )
    })

    accountService.client.on('party:invite', async (invitation) => {
      const senderName =
        invitation.sender.displayName ?? invitation.sender.id

      const data = {
        id: crypto.randomUUID(),
        createdAt: getExtendedDateFormat(),
        me: {
          accountId: account.accountId,
          displayName: parseCustomDisplayName(account),
        },
        friend: {
          accountId: invitation.sender.id,
          displayName: senderName,
        },
        type: TaxiServiceNotificationType.PartyInvite,
      } as TaxiServiceNotificationEventPartyInvite

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.TaxiServiceServiceNotifications,
        data,
      )

      TaxiService.log(
        accountService.accountId,
        'info',
        `Party invite from ${senderName}`,
      )

      /**
       * Private mode only serves whitelisted passengers.
       */
      const info = TaxiService._accounts.get(accountService.accountId)
      const isPrivate = info?.actions.isPrivate ?? false

      if (
        isPrivate &&
        !info?.whitelist.some(
          (entry) => entry.accountId === invitation.sender.id,
        )
      ) {
        TaxiService.log(
          accountService.accountId,
          'warn',
          `Declined invite from ${senderName} — not whitelisted`,
        )
        invitation.decline().catch(() => {})

        return
      }

      /**
       * Client can not join to a team when total maximum members is full
       */
      const maxMembers = invitation.party.members.size >= 4

      if (maxMembers) {
        invitation.decline().catch(() => {})

        return
      }

      /**
       * Occupied — the sender joins the queue instead of stealing the seat.
       * They are declined now and picked up from the queue when the
       * current session ends.
       */
      const currentMembers =
        (invitation.client.party?.members.size ?? 1) > 1

      if (accountService.occupied || currentMembers) {
        if (
          !accountService.queue.some(
            (entry) => entry.accountId === invitation.sender.id,
          )
        ) {
          accountService.queue.push({
            accountId: invitation.sender.id,
            displayName: senderName,
            partyId: invitation.party.id,
          })

          TaxiService.log(
            accountService.accountId,
            'info',
            `${senderName} queued (position ${accountService.queue.length})`,
          )
        } else {
          const position =
            accountService.queue.findIndex(
              (entry) => entry.accountId === invitation.sender.id,
            ) + 1

          TaxiService.log(
            accountService.accountId,
            'info',
            `${senderName} is already queued (position ${position})`,
          )
        }

        invitation.decline().catch(() => {})
        updateOccupiedStatus()

        return
      }

      /**
       * Client can join if other client still not joined yet
       */
      const accountsId = TaxiService._accounts.map(
        ({ accountId }) => accountId,
      )
      const filteredMembersId = invitation.party.members
        .filter(({ id }) => accountsId.includes(id))
        .map(({ id }) => id)
      const otherClientHasPreviouslyJoined = filteredMembersId.length > 0

      if (otherClientHasPreviouslyJoined) {
        invitation.decline().catch(() => {})

        return
      }

      try {
        /**
         * Client can not join if matchmaking is changing
         */
        const { isPlaying, sessionId } = invitation.sender.presence ?? {}

        if (isPlaying || Boolean(sessionId)) {
          invitation.decline().catch(() => {})

          return
        }
      } catch (error) {
        RuntimeLog.error('caught:startup/taxi-service.ts', error)
      }

      try {
        accountService.occupied = true
        accountService.status = AccountPresence.DnD

        await invitation.accept()

        TaxiService.log(
          accountService.accountId,
          'success',
          `Joined ${senderName}'s party`,
        )

        accountService.client.setStatus(defaultStatuses.busy(), 'away')

        /**
         * Give the party a moment to settle, then present the configured
         * skin, banner, level and power stats — re-applying stats a few
         * seconds later because the first patch is often overwritten by
         * the join sequence.
         */
        await new Promise((resolve) => {
          setTimeout(resolve, 1_000)
        })

        await applyCosmetics()

        setTimeout(() => {
          TaxiService.updatePatch(accountService).catch(() => {})
        }, 3_000)

        startLeaveTimer()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        accountService.occupied = false
        accountService.status = AccountPresence.Active
        accountService.client.setStatus(defaultStatuses.active(), 'away')

        TaxiService.log(
          account.accountId,
          'error',
          `Failed to accept the invite: ${error?.message ?? 'unknown error'}`,
        )

        TaxiService._reJoinTo.set(account.accountId, invitation.sender.id)
        reAuth(error)
      }
    })

    accountService.client.on(
      'party:member:matchstate:updated',
      async (member, value, previousValue) => {
        const previousLocation = `${previousValue?.location}`
        const currentLocation = `${value?.location}`

        if (
          previousLocation === 'Lobby' &&
          currentLocation === 'JoiningGame'
        ) {
          accountService.client.setTimeout(() => {
            member.client.leaveParty().catch(() => {})
            clearCurrentTimeout()

            void finishSession()
          }, 1000 * 10) // 10 seconds

          return
        }
      },
    )

    accountService.client.on('friend:added', (friend) => {
      const data = {
        id: crypto.randomUUID(),
        createdAt: getExtendedDateFormat(),
        me: {
          accountId: account.accountId,
          displayName: parseCustomDisplayName(account),
        },
        friend: {
          accountId: friend.id,
          displayName: friend.displayName,
        },
        type: TaxiServiceNotificationType.FriendAdded,
      } as TaxiServiceNotificationEventFriendAdded

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.TaxiServiceServiceNotifications,
        data,
      )
    })

    accountService.client.login()

    TaxiService._services.set(accountService.accountId, accountService)
  }

  static async reload(ids: Array<string>) {
    ids.forEach(async (accountId) => {
      const account = TaxiService.getAccountById(accountId)
      const current = TaxiService.getServiceByAccountId(accountId)

      if (!current || !account) {
        return
      }

      /**
       * Reconnect cooldown — protects Epic's auth from restart loops
       * after a flap detection pause.
       */
      const cooldownEnd = TaxiService._cooldowns.get(accountId) ?? 0

      if (Date.now() < cooldownEnd) {
        TaxiService.log(
          accountId,
          'warn',
          `Reconnect suppressed — cooling down ${Math.ceil((cooldownEnd - Date.now()) / 1000)}s`,
        )
        return
      }

      const setNewStatus = (status: AutomationStatusType) => {
        TaxiService.updateAccountData(current.accountId, {
          status,
        })
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.TaxiServiceServiceStartNotification,
          {
            accountId: current.accountId,
            status,
          } as TaxiServiceServiceStatusResponse,
        )
      }

      setNewStatus(AutomationStatusType.LOADING)

      if (
        current.currentTimeout !== null &&
        current.currentTimeout !== undefined
      ) {
        current.client.clearTimeout(current.currentTimeout)
      }

      current.client.removeAllListeners()
      current.client.xmpp.disconnect()
      current.client.logout()

      TaxiService._accounts.delete(accountId)
      TaxiService._services.delete(accountId)

      await new Promise((resolve) => {
        setTimeout(resolve, 200)
      })

      const result = await DataDirectory.getTaxiServiceFile()
      const data = {
        accountId,
        actions: {
          ...account.actions,
        },
        whitelist: account.whitelist,
      }

      await DataDirectory.updateTaxiServiceFile({
        ...result.taxiService,
        [accountId]: data,
      })
      TaxiService._accounts.set(data.accountId, {
        ...data,
        status: AutomationStatusType.LOADING,
      })
      TaxiService.start(data)
    })
  }

  static getAccountById(
    accountId: string,
  ): TaxiServiceAccountServerData | undefined {
    return TaxiService._accounts.get(accountId)
  }

  static getServices() {
    return TaxiService._services.clone()
  }

  static getServiceByAccountId(accountId: string) {
    return TaxiService._services.find(
      (accountService) => accountService.accountId === accountId,
    )
  }

  private static async updatePatch(accountService: AccountService) {
    const powerLevel = resolvePowerLevel(
      TaxiService._accounts.get(accountService.accountId)?.actions,
    )
    const currentStat = findStatForPowerLevel(powerLevel)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mpLoadoutInfo: any =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (accountService.client.party?.me.meta.schema as any)?.[
        'Default:MpLoadout_j'
      ] ?? {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMetaInfo: Record<string, any> = {
      'Default:AthenaBannerInfo_j': JSON.stringify({
        AthenaBannerInfo: {
          bannerIconId: 'FounderTier4Banner3',
          bannerColorId: 'defaultcolor2',
        },
      }),
      'Default:AthenaCosmeticLoadout_j': JSON.stringify({
        AthenaCosmeticLoadout: {
          characterPrimaryAssetId:
            'AthenaCharacter:Character_SuperNovaTaro',
        },
      }),
    }

    if (mpLoadoutInfo?.MpLoadout?.d !== undefined) {
      newMetaInfo['Default:MpLoadout_j'] = JSON.stringify({
        MpLoadout: {
          d: JSON.stringify({
            ac: {
              i: 'Character_SuperNovaTaro',
              v: [],
            },
          }),
        },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaInfo: Record<string, any> = {
      'Default:FORTStats_j': JSON.stringify({
        FORTStats: {
          fortitude: currentStat,
          offense: currentStat,
          resistance: currentStat,
          tech: currentStat,
          teamFortitude: currentStat,
          teamOffense: currentStat,
          teamResistance: currentStat,
          teamTech: currentStat,
          fortitude_Phoenix: currentStat,
          offense_Phoenix: currentStat,
          resistance_Phoenix: currentStat,
          tech_Phoenix: currentStat,
          teamFortitude_Phoenix: currentStat,
          teamOffense_Phoenix: currentStat,
          teamResistance_Phoenix: currentStat,
          teamTech_Phoenix: currentStat,
        },
      }),
      'Default:PackedState_j': JSON.stringify({
        PackedState: {
          subGame: 'Campaign',
          location: 'PreLobby',
          gameMode: 'None',
          voiceChatStatus: 'PartyVoice',
          hasCompletedSTWTutorial: true,
          hasPurchasedSTW: true,
          platformSupportsSTW: true,
          bReturnToLobbyAndReadyUp: false,
          bHideReadyUp: false,
          bDownloadOnDemandActive: false,
          bIsPartyLFG: false,
          bShouldRecordPartyChannel: false,
        },
      }),
      /**
       * The commander/backpack ratings present the power level itself, so
       * the lobby banner matches the FORT stats the curve produced.
       */
      'Default:CampaignCommanderLoadoutRating_d': powerLevel.toFixed(2),
      'Default:CampaignBackpackRating_d': powerLevel.toFixed(6),
      ...newMetaInfo,
    }

    try {
      await accountService.client.party?.me?.sendPatch(metaInfo)
    } catch (error) {
      RuntimeLog.error('caught:startup/taxi-service.ts', error)
    }
  }

  private static async refreshData(
    accountId: string,
    removeAccount?: boolean,
  ) {
    const automation = TaxiService._accounts
      .filter((account) => account.accountId !== accountId)
      .map((account) => account)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .reduce((accumulator, { status, ...account }) => {
        accumulator[account.accountId] = account

        return accumulator
      }, {} as TaxiServiceAccountFileDataList)

    if (removeAccount) {
      TaxiService._accounts.delete(accountId)
      TaxiService._services.delete(accountId)
    }

    await DataDirectory.updateTaxiServiceFile(automation)

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.TaxiServiceServiceResponseData,
      automation,
      true,
    )
  }

  private static updateAccountData(
    accountId: string,
    data: Partial<{
      actions: Partial<TaxiServiceAccountData['actions']>
      status: Partial<TaxiServiceAccountData['status']>
      whitelist: TaxiServiceAccountData['whitelist']
    }>,
  ) {
    const automationAccount = TaxiService.getAccountById(accountId)

    if (automationAccount) {
      const accountService = TaxiService._services.get(
        automationAccount.accountId,
      )

      const actionsNewValue = {
        ...automationAccount.actions,
        ...data.actions,
      } as TaxiServiceAccountData['actions']

      if (actionsNewValue.activeStatus !== undefined) {
        actionsNewValue.activeStatus = `${actionsNewValue.activeStatus}`.trim()
        actionsNewValue.busyStatus = `${actionsNewValue.busyStatus}`.trim()
      }

      TaxiService._accounts.set(accountId, {
        accountId,
        actions: actionsNewValue,
        status: data.status ?? automationAccount.status,
        whitelist: data.whitelist ?? automationAccount.whitelist,
      })

      if (accountService) {
        if (
          data.actions?.powerLevel !== undefined &&
          data.actions.powerLevel !== automationAccount.actions.powerLevel
        ) {
          void TaxiService.updatePatch(accountService)
        }

        /**
         * Cosmetic changes are applied live so a running taxi picks up a
         * new look without ending the session.
         */
        const cosmeticChanged =
          (data.actions?.skin !== undefined &&
            data.actions.skin !== automationAccount.actions.skin) ||
          (data.actions?.emote !== undefined &&
            data.actions.emote !== automationAccount.actions.emote) ||
          (data.actions?.level !== undefined &&
            data.actions.level !== automationAccount.actions.level)

        if (
          cosmeticChanged &&
          (accountService.occupied || accountService.status !== AccountPresence.Unknown)
        ) {
          const me = accountService.client.party?.me

          if (me) {
            if (
              data.actions?.skin !== undefined &&
              data.actions.skin !== automationAccount.actions.skin
            ) {
              me.setOutfit(`${data.actions.skin}`).catch(() => {})
            }

            if (
              data.actions?.level !== undefined &&
              data.actions.level !== automationAccount.actions.level
            ) {
              me.setLevel(data.actions.level).catch(() => {})
            }

            if (
              data.actions?.emote !== undefined &&
              data.actions.emote !== automationAccount.actions.emote &&
              accountService.occupied
            ) {
              me.setEmote(`${data.actions.emote}`).catch(() => {})
            }
          }
        }

        if (
          data.actions?.activeStatus !== undefined &&
          automationAccount.actions.activeStatus !==
            data.actions.activeStatus &&
          accountService.status === AccountPresence.Active
        ) {
          accountService.client.setStatus(
            `${data.actions.activeStatus}`.trim().length > 0
              ? `${data.actions.activeStatus}`.trim()
              : 'Libre',
            'away',
          )
        } else if (
          data.actions?.busyStatus !== undefined &&
          automationAccount.actions.busyStatus !==
            data.actions.busyStatus &&
          accountService.status === AccountPresence.DnD
        ) {
          accountService.client.setStatus(
            `${data.actions.busyStatus}`.trim().length > 0
              ? `${data.actions.busyStatus}`.trim()
              : 'Ocupado',
            'away',
          )
        }

        if (
          !automationAccount.actions.denyFriendsRequests &&
          actionsNewValue.denyFriendsRequests
        ) {
          const account = AccountsManager.getAccountById(accountId)!

          Authentication.verifyAccessToken(account).then((accessToken) => {
            if (!accessToken) {
              return
            }

            const pendingList =
              accountService.client.friend.pendingList.filter(
                (item) => item.direction === 'INCOMING',
              )

            pendingList.forEach((pending) => {
              removeFriend({
                accessToken,
                accountId: account.accountId,
                friendId: pending.id,
              })
            })
          })
        }
      }
    }
  }
}
