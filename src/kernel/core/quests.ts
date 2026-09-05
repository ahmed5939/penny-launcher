import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import {
  getQueryProfile,
  setSetPinnedQuests,
} from '../../services/endpoints/mcp'

export type QuestObjectiveProgress = {
  backendName: string
  completed: number
}

export type QuestEntry = {
  /** Item GUID — what `SetPinnedQuests` takes. */
  itemId: string
  templateId: string
  /** `Active` or `Claimed`. */
  state: string
  pinned: boolean
  /**
   * Raw `completion_*` counters. The renderer pairs these with the
   * objective definitions from the item database, which knows the targets.
   */
  objectives: Array<QuestObjectiveProgress>
}

export type QuestsPayload = {
  accountId: string
  errorMessage?: string
  quests: Array<QuestEntry>
  /** How many daily rerolls the account has banked. */
  rerolls: number
}

export type QuestsPinNotification = {
  accountId: string
  errorMessage?: string
}

export class Quests {
  static async request(account: AccountData) {
    try {
      const payload = await Quests.getQuests(account)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.QuestsResponse,
        payload
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.QuestsResponse,
        {
          accountId: account.accountId,
          errorMessage:
            error?.response?.data?.errorMessage ?? 'Unknown Error',
          quests: [],
          rerolls: 0,
        } as QuestsPayload
      )
    }
  }

  static async getQuests(account: AccountData) {
    const payload: QuestsPayload = {
      accountId: account.accountId,
      quests: [],
      rerolls: 0,
    }
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      payload.errorMessage = 'Unknown Error'

      return payload
    }

    const response = await getQueryProfile({
      accessToken,
      accountId: account.accountId,
    })
    const profile = response.data.profileChanges[0]?.profile
    const items = profile?.items ?? {}
    const pinned = new Set(
      profile?.stats?.attributes?.client_settings?.pinnedQuestInstances ?? []
    )

    payload.rerolls =
      profile?.stats?.attributes?.quest_manager?.dailyQuestRerolls ?? 0

    Object.entries(items).forEach(([itemId, item]) => {
      if (!item.templateId.startsWith('Quest:')) {
        return
      }

      const attributes = (item.attributes ?? {}) as Record<string, unknown>
      const state = (attributes.quest_state as string) ?? 'Active'

      /** Claimed quests are history; the log shows what is still live. */
      if (state !== 'Active') {
        return
      }

      payload.quests.push({
        itemId,
        templateId: item.templateId,
        state,
        pinned: pinned.has(itemId),
        objectives: Object.entries(attributes)
          .filter(([key]) => key.startsWith('completion_'))
          .map(([key, value]) => ({
            backendName: key.replace(/^completion_/, ''),
            completed: typeof value === 'number' ? value : 0,
          })),
      })
    })

    return payload
  }

  /**
   * Replaces the pinned set wholesale — that is the only shape the endpoint
   * accepts, so the renderer sends the list it wants to end up with.
   */
  static async pin(account: AccountData, pinnedQuestIds: Array<string>) {
    const notification: QuestsPinNotification = {
      accountId: account.accountId,
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        notification.errorMessage = 'Unknown Error'
      } else {
        await setSetPinnedQuests({
          accessToken,
          accountId: account.accountId,
          pinnedQuestIds,
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      notification.errorMessage =
        error?.response?.data?.errorMessage ?? 'Unknown Error'
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.QuestsPinNotification,
      notification
    )

    await Quests.request(account)
  }
}
