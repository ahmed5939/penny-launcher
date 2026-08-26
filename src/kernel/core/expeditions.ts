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

/**
 * Expedition metadata, decoded from the template id.
 *
 * The classification and the duration figures follow PennyDB's own reading
 * of these ids (`ExpeditionsManager.jsx`) rather than being guessed — Epic
 * ships the marketing names ("Cache Grab") in game data we do not have, so
 * the *kind* of expedition is the useful label.
 *
 * @see https://github.com/ahmed5939/pennydb
 */
const expeditionKinds: Array<[string, string]> = [
  ['supplyrun', 'Supply Run'],
  ['survivorscouting', 'Survivor Scouting'],
  ['traprun', 'Trap Run'],
  ['craftingrun', 'Crafting Run'],
  ['choppingwood', 'Wood Gathering'],
  ['miningore', 'Ore Mining'],
]

const expeditionDurations: Array<[string, string, number]> = [
  ['_short_', 'Short', 20],
  ['_medium_', 'Medium', 75],
  ['_long_', 'Long', 168],
]

function parseExpeditionTemplate(templateId: string) {
  const body = templateId.toLowerCase()

  const kind =
    expeditionKinds.find(([token]) => body.includes(token))?.[1] ??
    'Expedition'

  const vehicle = body.includes('_sea_')
    ? 'Sea'
    : body.includes('_air_')
      ? 'Air'
      : 'Land'

  const duration = expeditionDurations.find(([token]) =>
    body.includes(token)
  )

  const tierMatch = /_t(\d+)/.exec(body)

  return {
    name: kind,
    vehicle,
    tier: tierMatch ? Number(tierMatch[1]) : 0,
    duration: duration?.[1] ?? 'Quick',
    durationMinutes: duration?.[2] ?? 10,
  }
}

/**
 * `expedition_criteria` entries read like `RequiresEpicHero`. The count is
 * how many hero slots the expedition needs; the rarity gates which heroes
 * are eligible.
 */
function parseCriteria(criteria: Array<string>) {
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

const rarityPower: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
}

function heroRarity(templateId: string) {
  const id = templateId.toLowerCase()
  if (id.includes('_sr_')) return 'Legendary'
  if (id.includes('_vr_')) return 'Epic'
  if (id.includes('_r_')) return 'Rare'
  if (id.includes('_uc_')) return 'Uncommon'
  return 'Common'
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

  private static async getExpeditions(account: AccountData) {
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
    const items = response.data.profileChanges[0]?.profile.items ?? {}
    const now = Date.now()
    const occupiedExpeditionSquads = new Set(
      Object.values(items)
        .filter((item) => item.templateId.startsWith('Expedition:'))
        .map((item) => item.attributes as Record<string, unknown>)
        .filter((attributes) => Boolean(attributes.expedition_end_time))
        .map((attributes) => `${attributes.expedition_squad_id ?? ''}`)
        .filter(Boolean)
    )
    const heroes = Object.entries(items)
      .filter(([, item]) => item.templateId.startsWith('Hero:'))
      .map(([itemId, item]) => {
        const attributes = item.attributes as {
          building_slot_used?: number
          level?: number
          squad_id?: string
        }
        const rarity = heroRarity(item.templateId)

        return {
          itemId,
          level: attributes.level ?? 1,
          rarity,
          squadId: attributes.squad_id ?? '',
          usedInLoadout: (attributes.building_slot_used ?? 0) > 0,
        }
      })
      .filter(
        (hero) =>
          !hero.usedInLoadout && !occupiedExpeditionSquads.has(hero.squadId)
      )
      .sort(
        (heroA, heroB) =>
          rarityPower[heroB.rarity] - rarityPower[heroA.rarity] ||
          heroB.level - heroA.level
      )

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
      const remainingHeroes = [...heroes]
      const suggestedHeroes = criteria.flatMap((requirement) => {
        const minimum = rarityPower[requirement.rarity] ?? 0
        const index = remainingHeroes.findIndex(
          (hero) => rarityPower[hero.rarity] >= minimum
        )

        return index < 0 ? [] : remainingHeroes.splice(index, 1)
      })

      const rawSuccessChance = Number(attributes.expedition_success_chance ?? 0)

      entry.slots.push({
        itemId,
        templateId: item.templateId,
        ...parseExpeditionTemplate(item.templateId),
        criteria,
        state,
        endTime,
        expiresAt: attributes.expedition_expiration_end_time ?? null,
        minTargetPower: attributes.expedition_min_target_power ?? 0,
        maxTargetPower: attributes.expedition_max_target_power ?? 0,
        squadId: attributes.expedition_squad_id ?? null,
        successChance:
          rawSuccessChance > 1 ? rawSuccessChance / 100 : rawSuccessChance,
        suggestedHeroIds: suggestedHeroes.map((hero) => hero.itemId),
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
