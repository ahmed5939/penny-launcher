import { RuntimeLog } from '../runtime-log'
import { Expeditions } from '../core/expeditions'
import { Authentication } from '../core/authentication'
import { AccountsManager } from './accounts'
import { DataDirectory } from './data-directory'
import { setCollectExpedition, setStartExpedition } from '../../services/endpoints/mcp'

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
}

export type AutoExpeditionsData = Record<string, AutoExpeditionConfig>
export type AutoExpeditionResult = {
  success: boolean
  collected: number
  sent: number
  errors: Array<string>
}

const defaults: AutoExpeditionsData = {}
const cycleInterval = 60 * 60 * 1000
const initialDelay = 30 * 1000

export class AutoExpeditions {
  private static timer: ReturnType<typeof setTimeout> | undefined
  private static running = false

  static async getData() {
    return DataDirectory.getAutoExpeditionsFile(defaults)
  }

  static async update(accountId: string, partial: Partial<AutoExpeditionConfig>) {
    const data = await AutoExpeditions.getData()
    data[accountId] = {
      enabled: false,
      rewardTypes: [],
      ...data[accountId],
      ...partial,
    }
    await DataDirectory.updateAutoExpeditionsFile(data)
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

    try {
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) throw new Error('Could not authenticate this account')

      let board = await Expeditions.getExpeditions(account)
      const collectedRewards: Array<string> = []
      for (const slot of board.slots.filter((item) => item.state === 'ready')) {
        await setCollectExpedition({
          accessToken,
          accountId,
          expeditionId: slot.itemId,
          expeditionTemplate: slot.templateId,
        })
        result.collected += 1
        collectedRewards.push(slot.name)
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
          .filter((item) => config.rewardTypes.includes(item.name))
          .filter(
            (item) =>
              Boolean(item.squadId) &&
              item.criteria.length > 0 &&
              item.suggestedHeroIds.length === item.criteria.length
          )
          .sort((left, right) => right.tier - left.tier)[0]

        if (!slot?.squadId) break
        await setStartExpedition({
          accessToken,
          accountId,
          expeditionId: slot.itemId,
          squadId: slot.squadId,
          itemIds: slot.suggestedHeroIds,
          slotIndices: slot.suggestedHeroIds.map((_, index) => index),
        })
        result.sent += 1
        sentRewards.push(slot.name)
      }

      data[accountId] = {
        ...config,
        lastActivity: new Date().toISOString(),
        lastCollected: result.collected,
        lastSent: result.sent,
        lastCollectedRewards: collectedRewards,
        lastSentRewards: sentRewards,
      }
      await DataDirectory.updateAutoExpeditionsFile(data)
      result.success = true
    } catch (error) {
      const typed = error as { message?: string; response?: { data?: { errorMessage?: string } } }
      result.errors.push(
        typed.response?.data?.errorMessage ?? typed.message ?? 'Auto-expedition cycle failed'
      )
      RuntimeLog.error('caught:auto-expeditions:run', error)
    }

    return result
  }

  private static async runAll() {
    if (AutoExpeditions.running) return
    AutoExpeditions.running = true
    try {
      const data = await AutoExpeditions.getData()
      for (const [accountId, config] of Object.entries(data)) {
        if (config.enabled && config.rewardTypes.length > 0) {
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
      }, cycleInterval)
    }
    AutoExpeditions.timer = setTimeout(() => {
      AutoExpeditions.runAll().finally(schedule)
    }, initialDelay)
  }
}
