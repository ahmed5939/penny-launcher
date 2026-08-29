import { RuntimeLog } from '../runtime-log'
import { Expeditions } from '../core/expeditions'
import { Authentication } from '../core/authentication'
import { AccountsManager } from './accounts'
import { DataDirectory } from './data-directory'
import { NativeNotifications } from './notifications'
import {
  getQueryProfile,
  setClaimCollectedResources,
  setCollectExpedition,
  setRecycleItemBatch,
  setStartExpedition,
} from '../../services/endpoints/mcp'

export const expeditionRewardTypes = [
  'Supply Run',
  'Survivor Scouting',
  'Trap Run',
  'Crafting Run',
  'Wood Gathering',
  'Ore Mining',
] as const

export type AutoExpeditionConfig = {
  enabled: boolean
  rewardTypes: Array<string>
  lastActivity?: string
  lastCollected?: number
  lastSent?: number
  lastCollectedRewards?: Array<string>
  lastSentRewards?: Array<string>
  notificationsEnabled?: boolean
  nextRunAt?: string
  lastError?: string
  history?: Array<AutoExpeditionHistoryEntry>
  recycleBelow?: 'off' | 'Common' | 'Uncommon' | 'Rare' | 'Epic'
}

export type AutoExpeditionHistoryEntry = {
  action: 'started' | 'collected' | 'start-error' | 'collect-error'
  expedition: string
  rewards?: Array<string>
  success?: boolean
  timestamp: string
}

export type AutoExpeditionsData = Record<string, AutoExpeditionConfig>
export type AutoExpeditionResult = {
  success: boolean
  collected: number
  sent: number
  errors: Array<string>
}

const defaults: AutoExpeditionsData = {}
const accountDefaults: AutoExpeditionConfig = {
  enabled: false,
  rewardTypes: [],
  notificationsEnabled: true,
  recycleBelow: 'off',
}
const cycleInterval = 60 * 60 * 1000
const initialDelay = 2 * 1000
const expeditionSquads = [
  { id: 'Squad_Expedition_ExpeditionSquadOne', capacity: 3, vehicle: 'Land' },
  { id: 'Squad_Expedition_ExpeditionSquadTwo', capacity: 5, vehicle: 'Land' },
  { id: 'Squad_Expedition_ExpeditionSquadThree', capacity: 4, vehicle: 'Sea' },
  { id: 'Squad_Expedition_ExpeditionSquadFour', capacity: 5, vehicle: 'Sea' },
  { id: 'Squad_Expedition_ExpeditionSquadFive', capacity: 3, vehicle: 'Air' },
  { id: 'Squad_Expedition_ExpeditionSquadSix', capacity: 4, vehicle: 'Air' },
]

const strategyFragments: Record<string, Array<string>> = {
  Survivors: ['survivorscouting', 'managers', 'peoplerun', 'rescue'],
  Heroes: ['heroes', 'warparty'],
  Traps: ['traprun', 'traps', 'craftingingredients'],
  Weapons: ['weapons'],
  Materials: ['supplyrun', 'craftingrun', 'resourcerun', 'miningore', 'choppingwood'],
  // Migrate the original launcher controls without invalidating saved settings.
  'Survivor Scouting': ['survivorscouting'],
  'Supply Run': ['supplyrun'],
  'Trap Run': ['traprun'],
  'Crafting Run': ['craftingrun'],
  'Wood Gathering': ['choppingwood'],
  'Ore Mining': ['miningore'],
}

function matchesStrategy(templateId: string, strategies: Array<string>) {
  const template = templateId.toLowerCase()
  return strategies.some((strategy) =>
    (strategyFragments[strategy] ?? [strategy.toLowerCase()]).some((fragment) =>
      template.includes(fragment)
    )
  )
}

function notificationData(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function appendHistory(
  config: AutoExpeditionConfig,
  entry: AutoExpeditionHistoryEntry
) {
  config.history = [...(config.history ?? []), entry].slice(-250)
}

const recycleRarity: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
}

function itemRarity(templateId: string) {
  const id = templateId.toLowerCase()
  if (id.includes('_sr_')) return 5
  if (id.includes('_vr_')) return 4
  if (id.includes('_r_')) return 3
  if (id.includes('_uc_')) return 2
  return 1
}

export class AutoExpeditions {
  private static timer: ReturnType<typeof setTimeout> | undefined
  private static running = false
  private static runningAccounts = new Set<string>()

  static async getData() {
    const data = await DataDirectory.getAutoExpeditionsFile(defaults)
    const migrations: Record<string, string> = {
      'Survivor Scouting': 'Survivors',
      'Supply Run': 'Materials',
      'Crafting Run': 'Materials',
      'Wood Gathering': 'Materials',
      'Ore Mining': 'Materials',
      'Trap Run': 'Traps',
    }

    Object.values(data).forEach((config) => {
      config.notificationsEnabled ??= true
      config.recycleBelow ??= 'off'
      config.rewardTypes = [
        ...new Set(config.rewardTypes.map((type) => migrations[type] ?? type)),
      ]
    })

    return data
  }

  static async update(accountId: string, partial: Partial<AutoExpeditionConfig>) {
    const data = await AutoExpeditions.getData()
    data[accountId] = {
      ...accountDefaults,
      // Record<> types this as always present, but a brand-new account has
      // no entry yet — the defaults above are what fill it in.
      ...data[accountId],
      ...partial,
    }
    await DataDirectory.updateAutoExpeditionsFile(data)

    if (data[accountId].enabled && data[accountId].rewardTypes.length > 0) {
      void AutoExpeditions.ensureStarted([accountId])
    }

    return data
  }

  static async run(accountId: string): Promise<AutoExpeditionResult> {
    const result: AutoExpeditionResult = {
      success: false,
      collected: 0,
      sent: 0,
      errors: [],
    }
    const account = AccountsManager.getAccounts().get(accountId)
    const data = await AutoExpeditions.getData()
    const config = data[accountId]

    if (!account) return { ...result, errors: ['Account not found'] }
    if (!config?.enabled) {
      return { ...result, errors: ['Auto-expeditions are not enabled for this account'] }
    }
    if (AutoExpeditions.runningAccounts.has(accountId)) {
      return { ...result, errors: ['An automatic expedition cycle is already running'] }
    }

    AutoExpeditions.runningAccounts.add(accountId)
    try {
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) throw new Error('Could not authenticate this account')

      let board = await Expeditions.getExpeditions(account)
      const campaign = await getQueryProfile({ accessToken, accountId })
      let currentItems = campaign.data.profileChanges[0]?.profile.items ?? {}
      const collectors = Object.entries(
        currentItems
      )
        .filter(([, item]) => item.templateId === 'CollectedResource:expedition_token')
        .map(([itemId]) => itemId)
      if (collectors.length > 0) {
        try {
          await setClaimCollectedResources({ accessToken, accountId, collectorIds: collectors })
        } catch (error) {
          RuntimeLog.error('auto-expeditions:claim-research', error)
        }
      }
      RuntimeLog.info(
        'auto-expeditions:board',
        `${accountId}: ${board.slots.length} total, ${board.slots.filter((slot) => slot.state === 'available').length} available, filters=${config.rewardTypes.join(',')}`
      )
      const collectedRewards: Array<string> = []
      for (const slot of board.slots.filter((item) => item.state === 'ready')) {
        try {
          const beforeIds = new Set(Object.keys(currentItems))
          const response = await setCollectExpedition({
            accessToken,
            accountId,
            expeditionId: slot.itemId,
            expeditionTemplate: slot.templateId,
          })
          const responseData = response.data as typeof response.data & {
            notifications?: Array<unknown>
          }
          const notifications = (responseData.notifications ?? []).map(notificationData)
          const confirmation = notifications.find(
            (item) => item && 'bExpeditionSucceeded' in item
          )
          if (!confirmation) throw new Error('Epic did not confirm the expedition result')
          const succeeded = confirmation.bExpeditionSucceeded === true
          const afterCollection = await getQueryProfile({ accessToken, accountId })
          currentItems = afterCollection.data.profileChanges[0]?.profile.items ?? {}
          const newItems = Object.entries(currentItems).filter(
            ([itemId]) => !beforeIds.has(itemId)
          )
          const rewards = newItems.map(([, item]) => item.templateId)

          if (succeeded && config.recycleBelow && config.recycleBelow !== 'off') {
            const threshold = recycleRarity[config.recycleBelow]
            const loadoutHeroes = new Set<string>()
            Object.values(currentItems).forEach((item) => {
              if (!item.templateId.includes('CampaignHeroLoadout')) return
              const members = (item.attributes as {
                crew_members?: Record<string, string>
              }).crew_members
              Object.values(members ?? {}).forEach((id) => loadoutHeroes.add(id))
            })
            const recyclable = newItems
              .filter(([itemId, item]) => {
                const attributes = item.attributes as {
                  favorite?: boolean
                  squad_id?: string
                  squad_slot_idx?: number
                }
                return (
                  /^(Hero|Schematic|Worker|Defender):/.test(item.templateId) &&
                  itemRarity(item.templateId) <= threshold &&
                  !attributes.favorite &&
                  !loadoutHeroes.has(itemId) &&
                  !attributes.squad_id &&
                  !(typeof attributes.squad_slot_idx === 'number' && attributes.squad_slot_idx >= 0)
                )
              })
              .map(([itemId]) => itemId)

            if (recyclable.length > 0) {
              await setRecycleItemBatch({ accessToken, accountId, targetItemIds: recyclable })
              const verified = await getQueryProfile({ accessToken, accountId })
              currentItems = verified.data.profileChanges[0]?.profile.items ?? {}
              const recycled = recyclable.filter((itemId) => !currentItems[itemId])
              RuntimeLog.info(
                'auto-expeditions:recycled',
                `${accountId}: ${recycled.length}/${recyclable.length} verified`
              )
            }
          }
          result.collected += 1
          collectedRewards.push(...(rewards.length > 0 ? rewards : [slot.name]))
          appendHistory(config, {
            action: 'collected', expedition: slot.templateId, rewards,
            success: succeeded, timestamp: new Date().toISOString(),
          })
        } catch (error) {
          appendHistory(config, {
            action: 'collect-error', expedition: slot.templateId,
            timestamp: new Date().toISOString(),
          })
          RuntimeLog.error('auto-expeditions:collect', error)
        }
      }

      // Refresh after every dispatch. Epic mutates hero/squad state each time,
      // so reusing a board can accidentally assign the same hero twice.
      const sentRewards: Array<string> = []
      for (let attempts = 0; attempts < 6; attempts += 1) {
        board = await Expeditions.getExpeditions(account)
        const occupied = board.slots.filter((item) => item.state !== 'available').length
        if (occupied >= 6) break

        const slot = board.slots
          .filter((item) => item.state === 'available')
          .filter((item) => matchesStrategy(item.templateId, config.rewardTypes))
          .filter((item) => item.durationMinutes <= 1320)
          .filter(
            (item) =>
              item.suggestedHeroIds.length > 0 &&
              item.suggestedHeroIds.length >= item.criteria.length
          )
          .filter(
            (item) =>
              item.targetPower <= 0 ||
              item.suggestedPower >= Math.ceil(item.targetPower * 0.8)
          )
          .sort(
            (left, right) =>
              right.tier - left.tier || right.targetPower - left.targetPower
          )[0]

        if (!slot) {
          RuntimeLog.info(
            'auto-expeditions:no-match',
            `${accountId}: ${board.slots
              .filter((item) => item.state === 'available')
              .map(
                (item) =>
                  `${item.name}[heroes=${item.suggestedHeroIds.length},criteria=${item.criteria.length}]`
              )
              .join(', ')}`
          )
          break
        }

        const usedSquads = new Set(
          board.slots
            .filter((item) => item.state !== 'available')
            .map((item) => item.squadId)
            .filter((squadId): squadId is string => Boolean(squadId))
            .map((squadId) => squadId.toLowerCase())
        )
        const availableSquads = expeditionSquads.filter(
          (squad) =>
            squad.vehicle === slot.vehicle &&
            !usedSquads.has(squad.id.toLowerCase())
        )
        let sent = false
        let lastError: unknown

        for (const squad of availableSquads) {
          const maximumHeroes = Math.min(
            squad.capacity,
            slot.suggestedHeroIds.length
          )

          for (let heroCount = maximumHeroes; heroCount >= 1; heroCount -= 1) {
            const itemIds = slot.suggestedHeroIds.slice(0, heroCount)
            try {
              const response = await setStartExpedition({
                accessToken,
                accountId,
                expeditionId: slot.itemId,
                squadId: squad.id,
                itemIds,
                slotIndices: itemIds.map((_, index) => index),
              })
              if ((response.data.profileChanges?.length ?? 0) === 0) {
                throw new Error('Epic returned no profile change for StartExpedition')
              }
              const confirmation = await Expeditions.getExpeditions(account)
              if (
                !confirmation.slots.some(
                  (item) => item.itemId === slot.itemId && item.state === 'in-flight'
                )
              ) {
                throw new Error('Epic did not confirm the expedition as running')
              }
              sent = true
              break
            } catch (error) {
              lastError = error
              const typed = error as {
                response?: { data?: unknown }
                message?: string
              }
              RuntimeLog.info(
                'auto-expeditions:dispatch-rejected',
                `${accountId}: ${slot.name}, squad=${squad.id}, heroes=${heroCount}, error=${JSON.stringify(typed.response?.data ?? typed.message)}`
              )
            }
          }

          if (sent) break
        }

        if (!sent) {
          appendHistory(config, {
            action: 'start-error',
            expedition: slot.templateId,
            timestamp: new Date().toISOString(),
          })
          throw lastError ?? new Error('No expedition squad is available')
        }
        result.sent += 1
        sentRewards.push(slot.name)
        appendHistory(config, {
          action: 'started', expedition: slot.templateId,
          timestamp: new Date().toISOString(),
        })
        RuntimeLog.info(
          'auto-expeditions:sent',
          `${accountId}: ${slot.name} (${slot.templateId})`
        )
      }

      data[accountId] = {
        ...config,
        lastActivity: new Date().toISOString(),
        lastCollected: result.collected,
        lastSent: result.sent,
        lastCollectedRewards: collectedRewards,
        lastSentRewards: sentRewards,
        lastError: undefined,
        nextRunAt: (() => {
          const earliest = board.slots
            .filter((slot) => slot.state === 'in-flight' && slot.endTime)
            .map((slot) => new Date(slot.endTime!).getTime())
            .sort((left, right) => left - right)[0]
          const minimum = Date.now() + 5 * 60 * 1000
          const maximum = Date.now() + cycleInterval
          return new Date(
            earliest ? Math.min(maximum, Math.max(minimum, earliest + 2 * 60 * 1000)) : maximum
          ).toISOString()
        })(),
      }
      await DataDirectory.updateAutoExpeditionsFile(data)
      if (
        config.notificationsEnabled !== false &&
        (result.collected > 0 || result.sent > 0)
      ) {
        NativeNotifications.send({
          title: 'Auto-expeditions',
          body: `Collected ${result.collected}; started ${result.sent}.`,
        })
      }
      result.success = true
    } catch (error) {
      const typed = error as { message?: string; response?: { data?: { errorMessage?: string } } }
      result.errors.push(
        typed.response?.data?.errorMessage ?? typed.message ?? 'Auto-expedition cycle failed'
      )
      data[accountId] = {
        ...config,
        lastError: result.errors[0],
        nextRunAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }
      await DataDirectory.updateAutoExpeditionsFile(data)
      RuntimeLog.error('caught:auto-expeditions:run', error)
    } finally {
      AutoExpeditions.runningAccounts.delete(accountId)
    }

    return result
  }

  static async ensureStarted(accountIds: Array<string>) {
    const data = await AutoExpeditions.getData()

    await Promise.allSettled(
      accountIds.map(async (accountId) => {
        const config = data[accountId]
        const account = AccountsManager.getAccounts().get(accountId)
        if (!config?.enabled || config.rewardTypes.length === 0 || !account) return

        const board = await Expeditions.getExpeditions(account)
        const hasSentExpedition = board.slots.some(
          (slot) => slot.state === 'in-flight'
        )

        if (!hasSentExpedition) await AutoExpeditions.run(accountId)
      })
    )
  }

  private static async runAll() {
    if (AutoExpeditions.running) return
    AutoExpeditions.running = true
    try {
      const data = await AutoExpeditions.getData()
      for (const [accountId, config] of Object.entries(data)) {
        if (
          config.enabled &&
          config.rewardTypes.length > 0 &&
          (!config.nextRunAt || new Date(config.nextRunAt).getTime() <= Date.now())
        ) {
          await AutoExpeditions.run(accountId)
        }
      }
    } finally {
      AutoExpeditions.running = false
    }
  }

  static start() {
    if (AutoExpeditions.timer) return
    const schedule = () => {
      AutoExpeditions.timer = setTimeout(() => {
        AutoExpeditions.runAll().finally(schedule)
      }, 60_000)
    }
    AutoExpeditions.timer = setTimeout(() => {
      AutoExpeditions.runAll().finally(schedule)
    }, initialDelay)
  }
}
