import { recordAutomationHistory } from './automation-history'
import { confirmedRewards, expeditionKind, recyclableRewards, resourceGains, rewardTypes, type Reward, type Items } from '../../features/expeditions/model'
import { RuntimeLog } from '../runtime-log'
import { AutomationRewards } from './automation-rewards'
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

export const expeditionRewardTypes = rewardTypes

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
  rewardItems?: Reward[]
  recycledItems?: Reward[]
  recyclingGains?: Reward[]
  recyclingError?: string
  error?: string
  expeditionId?: string
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
function matchesStrategy(templateId: string, strategies: Array<string>) {
  return strategies.includes(expeditionKind(templateId).category)
}

function notificationData(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function appendHistory(
  accountId: string,
  config: AutoExpeditionConfig,
  entry: AutoExpeditionHistoryEntry
) {
  config.history = [...(config.history ?? []), entry]
  publishHistory(accountId, entry)
}

function publishHistory(accountId: string, entry: AutoExpeditionHistoryEntry) {
  const rewards: Record<string, number> = {}
  for (const reward of [...(entry.rewardItems ?? []), ...(entry.recyclingGains ?? [])]) {
    rewards[reward.templateId] = (rewards[reward.templateId] ?? 0) + reward.quantity
  }
  recordAutomationHistory({
    id: `expedition:${accountId}:${entry.expeditionId ?? entry.expedition}:${entry.timestamp}:${entry.action}`,
    accountId, createdAt: entry.timestamp, source: 'Auto-expeditions', rewards,
    description: `${entry.action}: ${entry.expedition}${entry.success === false ? ' (unsuccessful)' : ''}${entry.recycledItems?.length ? ` · recycled ${entry.recycledItems.length} items` : ''}${entry.error || entry.recyclingError ? ` · ${entry.error || entry.recyclingError}` : ''}`,
    outcome: entry.error || entry.recyclingError || entry.success === false ? 'error' : 'success',
  })
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

  private static writes: Promise<unknown> = Promise.resolve()

  private static save(accountId: string, partial: Partial<AutoExpeditionConfig>) {
    const work = AutoExpeditions.writes.then(async () => {
      const data = await AutoExpeditions.getData()
      data[accountId] = { ...accountDefaults, ...data[accountId], ...partial }
      await DataDirectory.updateAutoExpeditionsFile(data)
      return data
    })
    AutoExpeditions.writes = work.catch(() => undefined)
    return work
  }

  static async update(accountId: string, partial: Partial<AutoExpeditionConfig>) {
    const settings: Partial<AutoExpeditionConfig> = {}
    if (typeof partial.enabled === 'boolean') settings.enabled = partial.enabled
    if (typeof partial.notificationsEnabled === 'boolean') settings.notificationsEnabled = partial.notificationsEnabled
    if (Array.isArray(partial.rewardTypes)) settings.rewardTypes = [...new Set(partial.rewardTypes.filter((type) => rewardTypes.includes(type)))]
    if (partial.recycleBelow && ['off', 'Common', 'Uncommon', 'Rare', 'Epic'].includes(partial.recycleBelow)) settings.recycleBelow = partial.recycleBelow
    settings.nextRunAt = new Date().toISOString()
    const data = await AutoExpeditions.save(accountId, settings)

    if (data[accountId].enabled && data[accountId].rewardTypes.length > 0) {
      void AutoExpeditions.ensureStarted([accountId])
    }

    return data
  }

  static async run(accountId: string): Promise<AutoExpeditionResult> {
    return AutomationRewards.withAccount(accountId, () => AutoExpeditions.runUnlocked(accountId))
  }

  private static async runUnlocked(accountId: string): Promise<AutoExpeditionResult> {
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
      if (!(await AutoExpeditions.getData())[accountId]?.enabled) return result

      let board = await Expeditions.getExpeditions(account)
      if (board.errorMessage) throw new Error(board.errorMessage)
      const campaign = await getQueryProfile({ accessToken, accountId })
      let currentItems = campaign.data.profileChanges[0]?.profile?.items
      if (!currentItems) throw new Error('Could not verify campaign inventory')
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
          const latest = (await AutoExpeditions.getData())[accountId]
          if (!latest?.enabled) break
          const beforeItems: Items = currentItems
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
          if (!confirmation || typeof confirmation.bExpeditionSucceeded !== 'boolean') throw new Error('Epic did not confirm the expedition result')
          const succeeded = confirmation.bExpeditionSucceeded === true
          const rewardItems = confirmedRewards(confirmation.expeditionRewards)
          const rewards = rewardItems.map((reward) => reward.quantity + ' × ' + reward.templateId)
          const history: AutoExpeditionHistoryEntry = {
            action: 'collected', expedition: slot.templateId, expeditionId: slot.itemId,
            rewards, rewardItems, success: succeeded, timestamp: new Date().toISOString(),
          }
          result.collected += 1
          collectedRewards.push(...rewards)
          appendHistory(accountId, config, history)
          // Save confirmation before optional inventory/recycling work. A secondary
          // failure must never erase a confirmed collection or its reward ledger.
          await AutoExpeditions.save(accountId, { history: config.history })
          try {
            const afterCollection = await getQueryProfile({ accessToken, accountId })
            const inventory = afterCollection.data.profileChanges[0]?.profile?.items
            if (!inventory) throw new Error('Could not verify inventory after collection')
            currentItems = inventory
            const recyclingSettings = (await AutoExpeditions.getData())[accountId]
            if (succeeded && recyclingSettings?.enabled && recyclingSettings.recycleBelow !== 'off') {
              const selected = recyclableRewards(rewardItems, beforeItems, currentItems, recyclingSettings.recycleBelow ?? 'off')
              if (selected.length) {
                const beforeRecycle = currentItems
                const recycled = await setRecycleItemBatch({ accessToken, accountId, targetItemIds: selected.map((r) => r.itemId!) })
                if (!recycled.data.profileChanges?.length) throw new Error('Epic did not confirm recycling')
                const verified = await getQueryProfile({ accessToken, accountId })
                const afterRecycle = verified.data.profileChanges[0]?.profile?.items
                if (!afterRecycle) throw new Error('Could not verify recycling result')
                currentItems = afterRecycle
                history.recycledItems = selected.filter((r) => !afterRecycle[r.itemId!])
                history.recyclingGains = resourceGains(beforeRecycle, afterRecycle)
                if (history.recycledItems.length !== selected.length) throw new Error('Some rewards were not confirmed recycled')
              }
            }
          } catch (error) {
            history.recyclingError = error instanceof Error ? error.message : 'Reward inventory verification failed'
            result.errors.push(history.recyclingError)
          }
          publishHistory(accountId, history)
          await AutoExpeditions.save(accountId, { history: config.history })
        } catch (error) {
          appendHistory(accountId, config, {
            action: 'collect-error', expedition: slot.templateId,
            expeditionId: slot.itemId,
            error: error instanceof Error ? error.message : 'Collection failed',
            timestamp: new Date().toISOString(),
          })
          result.errors.push(error instanceof Error ? error.message : 'Collection failed')
          RuntimeLog.error('auto-expeditions:collect', error)
        }
      }

      // Refresh after every dispatch. Epic mutates hero/squad state each time,
      // so reusing a board can accidentally assign the same hero twice.
      const sentRewards: Array<string> = []
      for (let attempts = 0; attempts < 6; attempts += 1) {
        const latest = (await AutoExpeditions.getData())[accountId]
        if (!latest?.enabled) break
        board = await Expeditions.getExpeditions(account)
        if (board.errorMessage) throw new Error(board.errorMessage)
        const occupied = board.slots.filter((item) => item.state !== 'available').length
        if (occupied >= 6) break

        const slot = board.slots
          .filter((item) => item.state === 'available')
          .filter((item) => matchesStrategy(item.templateId, latest.rewardTypes))
          .filter((item) => item.durationMinutes > 0 && item.durationMinutes <= 1320)
          .filter((item) => item.suggestedSquadId && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()))
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

        try {
          const response = await setStartExpedition({
            accessToken, accountId, expeditionId: slot.itemId,
            squadId: slot.suggestedSquadId!, itemIds: slot.suggestedHeroIds,
            slotIndices: slot.suggestedHeroIds.map((_, index) => index),
          })
          if (!response.data.profileChanges?.length) throw new Error('Epic returned no start confirmation')
          board = await Expeditions.getExpeditions(account)
          if (!board.slots.some((item) => item.itemId === slot.itemId && item.state === 'in-flight')) throw new Error('Expedition start could not be verified')
        } catch (error) {
          appendHistory(accountId, config, { action: 'start-error', expedition: slot.templateId, expeditionId: slot.itemId, timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : 'Start failed' })
          throw error
        }
        result.sent += 1
        sentRewards.push(slot.name)
        appendHistory(accountId, config, {
          action: 'started', expedition: slot.templateId, expeditionId: slot.itemId,
          timestamp: new Date().toISOString(),
        })
        await AutoExpeditions.save(accountId, { history: config.history })
        RuntimeLog.info(
          'auto-expeditions:sent',
          `${accountId}: ${slot.name} (${slot.templateId})`
        )
      }

      const runtime: Partial<AutoExpeditionConfig> = {
        history: config.history,
        lastActivity: new Date().toISOString(),
        lastCollected: result.collected,
        lastSent: result.sent,
        lastCollectedRewards: collectedRewards,
        lastSentRewards: sentRewards,
        lastError: result.errors.join('; ') || undefined,
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
      await AutoExpeditions.save(accountId, runtime)
      if (
        config.notificationsEnabled !== false &&
        (result.collected > 0 || result.sent > 0)
      ) {
        NativeNotifications.send({
          title: 'Auto-expeditions',
          body: `Collected ${result.collected}; started ${result.sent}.`,
        })
      }
      result.success = result.errors.length === 0
    } catch (error) {
      const typed = error as { message?: string; response?: { data?: { errorMessage?: string } } }
      result.errors.push(
        typed.response?.data?.errorMessage ?? typed.message ?? 'Auto-expedition cycle failed'
      )
      const runtime: Partial<AutoExpeditionConfig> = {
        history: config.history,
        lastError: result.errors[0],
        nextRunAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }
      await AutoExpeditions.save(accountId, runtime)
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
