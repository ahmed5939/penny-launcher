import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import {
  getQueryProfile,
  setAbandonExpedition,
  setCollectExpedition,
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
        .catch(() => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.ExpeditionsResponse,
            {
              [account.accountId]: {
                accountId: account.accountId,
                errorMessage: 'Unknown Error',
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
      entry.errorMessage = 'Unknown Error'

      return entry
    }

    const response = await getQueryProfile({
      accessToken,
      accountId: account.accountId,
    })
    const items = response.data.profileChanges[0]?.profile.items ?? {}
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

      entry.slots.push({
        itemId,
        templateId: item.templateId,
        ...parseExpeditionTemplate(item.templateId),
        criteria: parseCriteria(attributes.expedition_criteria ?? []),
        state,
        endTime,
        expiresAt: attributes.expedition_expiration_end_time ?? null,
        minTargetPower: attributes.expedition_min_target_power ?? 0,
        maxTargetPower: attributes.expedition_max_target_power ?? 0,
        squadId: attributes.expedition_squad_id ?? null,
        successChance: attributes.expedition_success_chance ?? 0,
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
      //
    }

    await Expeditions.request([account])
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
