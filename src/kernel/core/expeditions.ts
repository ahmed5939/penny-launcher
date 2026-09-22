import { expeditionKind, metadata, selectTeam } from '../../features/expeditions/model'
import { RuntimeLog } from '../runtime-log'
import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import {
  getQueryProfile,
  setAbandonExpedition,
  setCollectExpedition,
  setRefreshExpeditions,
  setStartExpedition,
} from '../../services/endpoints/mcp'

function parseExpeditionTemplate(templateId: string) {
  const body = templateId.toLowerCase()

  const kind =
    expeditionKind(templateId).name

  const vehicle = body.includes('_sea_')
    ? 'Sea'
    : body.includes('_air_')
      ? 'Air'
      : 'Land'

  const durationMinutes = metadata(templateId).expedition_duration_minutes ?? 0

  const tierMatch = /_t(\d+)/.exec(body)

  return {
    name: kind,
    vehicle,
    tier: tierMatch ? Number(tierMatch[1]) : 0,
    duration: durationMinutes ? `${durationMinutes} min` : 'Unknown',
    durationMinutes,
  }
}

/**
 * `expedition_criteria` entries read like `RequiresEpicHero`. The count is
 * how many hero slots the expedition needs; the rarity gates which heroes
 * are eligible.
 */
function parseCriteria(rawCriteria: unknown) {
  const criteria = Array.isArray(rawCriteria)
    ? rawCriteria
    : rawCriteria && typeof rawCriteria === 'object'
      ? ((rawCriteria as { RequiredTags?: Array<string> }).RequiredTags ?? [])
      : []
  const rarities = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common']

  return criteria.map((requirement) => {
    const rarity = rarities.find((value) => requirement.includes(value))

    return {
      rarity: rarity ?? 'Any',
      type: requirement
        .replace('Requires', '')
        .replace(rarity ?? '', '')
        .trim(),
    }
  })
}


export type ExpeditionState = 'available' | 'in-flight' | 'ready'

export type ExpeditionSlot = {
  /** Item GUID — what `CollectExpedition` wants as `expeditionId`. */
  itemId: string
  /** e.g. `Expedition:expedition_sea_supplyrun_long_t04`. */
  templateId: string
  /** Kind of expedition — "Supply Run", "Trap Run", … */
  name: string
  /** `Air` | `Land` | `Sea`. */
  vehicle: string
  tier: number
  duration: string
  durationMinutes: number
  /** One entry per hero slot the expedition needs. */
  criteria: Array<{ rarity: string; type: string }>
  state: ExpeditionState
  /** ISO date the running expedition finishes. */
  endTime: string | null
  /** ISO date an unstarted slot disappears. */
  expiresAt: string | null
  minTargetPower: number
  maxTargetPower: number
  squadId: string | null
  /** 0–1. Only meaningful once running. */
  successChance: number
  suggestedHeroIds: Array<string>
  suggestedSquadId?: string | null
  suggestedPower: number
  targetPower: number
}

export type ExpeditionsEntry = {
  accountId: string
  errorMessage?: string
  slots: Array<ExpeditionSlot>
}

export type ExpeditionsPayload = Record<string, ExpeditionsEntry>

export type ExpeditionsCollectNotification = {
  results: Array<{
    accountId: string
    collected: number
    errorMessage?: string
  }>
}

export type ExpeditionActionNotification = {
  accountId: string
  action: 'abandon' | 'collect' | 'start'
  errorMessage?: string
  expeditionId: string
}

export class Expeditions {
  static async request(accounts: Array<AccountData>) {
    accounts.forEach((account) => {
      Expeditions.getExpeditions(account)
        .then((entry) => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.ExpeditionsResponse,
            { [account.accountId]: entry } as ExpeditionsPayload
          )
        })
        .catch((error: unknown) => {
          RuntimeLog.error('caught:core/expeditions:request', error)
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.ExpeditionsResponse,
            {
              [account.accountId]: {
                accountId: account.accountId,
                errorMessage: Expeditions.errorMessage(error),
                slots: [],
              },
            } as ExpeditionsPayload
          )
        })
    })
  }

  static async getExpeditions(account: AccountData) {
    const entry: ExpeditionsEntry = {
      accountId: account.accountId,
      slots: [],
    }
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      entry.errorMessage = 'Could not authenticate this account'

      return entry
    }

    // Epic generates/replaces expired expedition offers through this MCP
    // operation. QueryProfile alone can return a stale or half-empty board.
    await setRefreshExpeditions({
      accessToken,
      accountId: account.accountId,
    })

    const response = await getQueryProfile({
      accessToken,
      accountId: account.accountId,
    })
    const items = response.data.profileChanges[0]?.profile?.items
    if (!items) throw new Error('Epic did not return a campaign profile')
    const now = Date.now()
    Object.entries(items).forEach(([itemId, item]) => {
      if (!item.templateId.startsWith('Expedition:')) {
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attributes = (item.attributes ?? {}) as Record<string, any>
      const endTime: string | null = attributes.expedition_end_time ?? null

      /**
       * A slot with no end time has never been launched. One with an end
       * time in the past is finished and waiting to be collected; anything
       * else is still out.
       */
      const hasRun = typeof endTime === 'string' && endTime.length > 0
      const state: ExpeditionState = !hasRun
        ? 'available'
        : new Date(endTime).getTime() <= now
          ? 'ready'
          : 'in-flight'

      const criteria = parseCriteria(attributes.expedition_criteria ?? [])
      const selection = selectTeam(items, item.templateId, attributes)
      const targetPower = selection.target

      const rawSuccessChance = Number(attributes.expedition_success_chance ?? 0)
      const durationMinutes = Number(
        attributes.expedition_duration_minutes ??
          (attributes.expedition_duration_seconds
            ? attributes.expedition_duration_seconds / 60
            : 0)
      )

      entry.slots.push({
        itemId,
        templateId: item.templateId,
        ...parseExpeditionTemplate(item.templateId),
        durationMinutes:
          durationMinutes > 0
            ? durationMinutes
            : (metadata(item.templateId).expedition_duration_minutes ?? 0),
        criteria,
        state,
        endTime,
        expiresAt: attributes.expedition_expiration_end_time ?? null,
        minTargetPower: attributes.expedition_min_target_power ?? 0,
        maxTargetPower: attributes.expedition_max_target_power ?? 0,
        squadId: attributes.expedition_squad_id ?? null,
        successChance:
          rawSuccessChance > 1 ? rawSuccessChance / 100 : rawSuccessChance,
        suggestedHeroIds: selection.heroIds,
        suggestedSquadId: selection.squadId,
        vehicle: selection.vehicle,
        suggestedPower: selection.power,
        targetPower,
      })
    })

    /** Ready first (actionable), then in-flight by soonest, then idle slots. */
    const order: Record<ExpeditionState, number> = {
      ready: 0,
      'in-flight': 1,
      available: 2,
    }

    entry.slots.sort((slotA, slotB) => {
      if (slotA.state !== slotB.state) {
        return order[slotA.state] - order[slotB.state]
      }

      return (slotA.endTime ?? slotA.expiresAt ?? '').localeCompare(
        slotB.endTime ?? slotB.expiresAt ?? ''
      )
    })

    return entry
  }

  static async abandon(account: AccountData, expeditionId: string) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return
      }

      await setAbandonExpedition({
        accessToken,
        accountId: account.accountId,
        expeditionId,
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/expeditions.ts', error)
    }

    await Expeditions.request([account])
  }

  static async action({
    account,
    action,
    expeditionId,
    expeditionTemplate,
    itemIds = [],
    squadId,
  }: {
    account: AccountData
    action: ExpeditionActionNotification['action']
    expeditionId: string
    expeditionTemplate?: string
    itemIds?: Array<string>
    squadId?: string
  }) {
    const payload: ExpeditionActionNotification = {
      accountId: account.accountId,
      action,
      expeditionId,
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) throw new Error('Could not authenticate this account')

      if (action === 'start') {
        if (!squadId || itemIds.length === 0) {
          throw new Error('No eligible hero team is available')
        }
        await setStartExpedition({
          accessToken,
          accountId: account.accountId,
          expeditionId,
          squadId,
          itemIds,
          slotIndices: itemIds.map((_, index) => index),
        })
      } else if (action === 'collect') {
        if (!expeditionTemplate) throw new Error('Missing expedition template')
        await setCollectExpedition({
          accessToken,
          accountId: account.accountId,
          expeditionId,
          expeditionTemplate,
        })
      } else {
        await setAbandonExpedition({
          accessToken,
          accountId: account.accountId,
          expeditionId,
        })
      }
    } catch (error: unknown) {
      const typed = error as {
        message?: string
        response?: { data?: { errorMessage?: string } }
      }
      payload.errorMessage =
        typed.response?.data?.errorMessage ?? typed.message ?? 'Action failed'
      RuntimeLog.error(`caught:core/expeditions:${action}`, error)
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ExpeditionsActionNotification,
      payload
    )
  }

  private static errorMessage(error: unknown) {
    const typed = error as {
      code?: string
      message?: string
      response?: {
        data?: { errorCode?: string; errorMessage?: string }
      }
    }

    return (
      typed.response?.data?.errorMessage ??
      typed.response?.data?.errorCode ??
      typed.message ??
      typed.code ??
      'Could not load expeditions'
    )
  }

  /**
   * Collects every finished expedition on each account. Slots are collected
   * sequentially per account because each one bumps the profile revision.
   */
  static async collect(accounts: Array<AccountData>) {
    const results: ExpeditionsCollectNotification['results'] = []

    await Promise.allSettled(
      accounts.map(async (account) => {
        const result = { accountId: account.accountId, collected: 0 } as {
          accountId: string
          collected: number
          errorMessage?: string
        }

        try {
          const accessToken =
            await Authentication.verifyAccessToken(account)

          if (!accessToken) {
            result.errorMessage = 'Unknown Error'
            results.push(result)

            return
          }

          const entry = await Expeditions.getExpeditions(account)
          const ready = entry.slots.filter((slot) => slot.state === 'ready')

          for (const slot of ready) {
            try {
              await setCollectExpedition({
                accessToken,
                accountId: account.accountId,
                expeditionId: slot.itemId,
                expeditionTemplate: slot.templateId,
              })

              result.collected += 1

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
              result.errorMessage =
                error?.response?.data?.errorMessage ?? 'Unknown Error'
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          result.errorMessage =
            error?.response?.data?.errorMessage ?? 'Unknown Error'
        }

        results.push(result)
      })
    )

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ExpeditionsCollectNotification,
      { results } as ExpeditionsCollectNotification
    )
  }
}
