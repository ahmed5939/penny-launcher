import { recordAutomationHistory } from './automation-history'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  dueDay,
  updateDueDay,
  normalizeDailyPreferences,
  isDailyRerollQuest,
  selectDailyQuest,
} from '../../features/daily-reroll/policy'
import type {
  DailyRerollData,
  DailyRerollStatus,
} from '../../features/daily-reroll/policy'
import { Authentication } from '../core/authentication'
import { ItemDatabase } from '../core/item-database'
import { AccountsManager } from './accounts'
import { DataDirectory } from './data-directory'
import { RuntimeLog } from '../runtime-log'
import {
  getQueryProfile,
  setClientQuestLogin,
  setFortRerollDailyQuest,
} from '../../services/endpoints/mcp'

const preferences = z
  .object({
    enabled: z.boolean(),
    updateQuests: z.boolean().optional(),
    keep: z
      .array(
        z
          .string()
          .max(200)
          .regex(/^quest:daily/i),
      )
      .max(500),
  })
  .strict()
const configSchema = preferences.extend({
  updatedDay: z.string().optional(),
  updateRetryAt: z.number().optional(),
  lastUpdateActivity: z.string().optional(),
  lastUpdateResult: z.string().optional(),
  checkedDay: z.string().optional(),
  attemptedDay: z.string().optional(),
  retryAt: z.number().optional(),
  lastActivity: z.string().optional(),
  lastResult: z.string().optional(),
})

export class AutoDailyReroll {
  private static timer: ReturnType<typeof setInterval> | undefined
  private static running = false
  private static writes: Promise<unknown> = Promise.resolve()

  private static get file() {
    return path.join(
      DataDirectory.getDataDirectoryPath(),
      'auto-daily-reroll.json',
    )
  }

  private static async read(): Promise<DailyRerollData> {
    try {
      const data = z
        .record(configSchema)
        .parse(JSON.parse(await readFile(this.file, 'utf8')))
      for (const config of Object.values(data)) {
        config.updateQuests = config.enabled || config.updateQuests === true
      }
      return data
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw new Error(
        'Could not read daily reroll settings; no quests were changed.',
      )
    }
  }

  private static change(edit: (data: DailyRerollData) => void) {
    const operation = this.writes.then(async () => {
      const data = await this.read()
      edit(data)
      await mkdir(path.dirname(this.file), { recursive: true })
      await writeFile(`${this.file}.tmp`, JSON.stringify(data, null, 2), 'utf8')
      await rename(`${this.file}.tmp`, this.file)
      return data
    })
    this.writes = operation.catch(() => {})
    return operation
  }

  static async status(): Promise<DailyRerollStatus> {
    await this.writes
    let questDataUnavailable = false
    const [accounts, database] = await Promise.all([
      this.read(),
      ItemDatabase.snapshot().catch(() => {
        questDataUnavailable = true
        return { records: {} }
      }),
    ])
    return {
      accounts,
      questDataUnavailable,
      quests: Object.entries(database.records)
        .filter(
          ([id, definition]) =>
            isDailyRerollQuest(id) && definition.objectives.length > 0,
        )
        .map(([templateId, definition]) => ({
          templateId,
          name: definition.name,
          description: definition.description,
          objectives: definition.objectives.map(({ description, count }) => ({
            description,
            count,
          })),
          rewards: definition.rewards,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  }

  static async update(accountId: string, value: unknown) {
    if (!AccountsManager.getAccountById(accountId))
      throw new Error('Account not found')
    const settings = preferences.parse(value)
    await this.change((data) => {
      data[accountId] = {
        ...data[accountId],
        ...settings,
        ...normalizeDailyPreferences({ ...data[accountId], ...settings }),
        keep: [...new Set(settings.keep.map((id) => id.toLowerCase()))],
      }
    })
    this.start()
    return this.status()
  }

  static start() {
    if (this.timer) return
    const tick = () => {
      void this.tick().catch(() => {
        RuntimeLog.error(
          'auto-daily-reroll',
          new Error(
            'Daily reroll cycle failed; check settings and account sign-in.',
          ),
        )
      })
    }
    this.timer = setInterval(tick, 60_000)
    this.timer.unref()
    tick()
  }

  static async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.writes
      for (const [accountId, config] of Object.entries(await this.read())) {
        if (!AccountsManager.getAccountById(accountId)) continue
        const updateDay = updateDueDay(config, new Date())
        if (updateDay) await this.refreshQuests(accountId, updateDay)
        const day = dueDay(config, new Date())
        if (day && AccountsManager.getAccountById(accountId))
          await this.run(accountId, day)
      }
    } finally {
      this.running = false
    }
  }

  private static async refreshQuests(accountId: string, day: string) {
    try {
      await this.writes
      const config = (await this.read())[accountId]
      const account = AccountsManager.getAccountById(accountId)
      if (!account || !config || updateDueDay(config, new Date()) !== day)
        return
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) throw new Error('Authentication failed')
      await this.writes
      const latest = (await this.read())[accountId]
      if (
        !latest ||
        updateDueDay(latest, new Date()) !== day ||
        !AccountsManager.getAccountById(accountId)
      )
        return
      const result = await setClientQuestLogin({ accountId, accessToken })
      if (
        !result.data ||
        'errorCode' in result.data ||
        !('profileChanges' in result.data) ||
        !Array.isArray(result.data.profileChanges)
      ) {
        throw new Error('Quest update not confirmed')
      }
      recordAutomationHistory({ accountId, source: 'Daily quest update', description: 'Daily quests updated', outcome: 'success' })
      await this.change((data) => {
        if (!data[accountId]) return
        Object.assign(data[accountId], {
          updatedDay: day,
          updateRetryAt: undefined,
          lastUpdateActivity: new Date().toISOString(),
          lastUpdateResult: 'Daily quests updated.',
        })
      })
    } catch {
      recordAutomationHistory({ accountId, source: 'Daily quest update', description: 'Could not update daily quests. Retrying in 15 minutes.', outcome: 'error' })
      await this.change((data) => {
        if (!data[accountId]) return
        Object.assign(data[accountId], {
          updateRetryAt: Date.now() + 15 * 60_000,
          lastUpdateActivity: new Date().toISOString(),
          lastUpdateResult:
            'Could not update daily quests. Retrying in 15 minutes; reroll waits for a successful update.',
        })
      })
    }
  }

  private static async run(accountId: string, day: string) {
    let attempted = false
    const record = (message: string, done: boolean) => {
      recordAutomationHistory({ accountId, source: 'Auto daily reroll', description: message, outcome: message.startsWith('Rerolled ') ? 'success' : 'info' })
      return this.change((data) => {
        if (!data[accountId]) return
        Object.assign(data[accountId], {
          lastResult: message,
          lastActivity: new Date().toISOString(),
          ...(done
            ? { checkedDay: day, retryAt: undefined }
            : { retryAt: Date.now() + 15 * 60_000 }),
        })
      })
    }
    try {
      await this.writes
      const initial = (await this.read())[accountId]
      if (
        !initial ||
        initial.updatedDay !== day ||
        dueDay(initial, new Date()) !== day
      )
        return
      const account = AccountsManager.getAccountById(accountId)
      if (!account) return
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) throw new Error('Authentication failed')
      await this.writes
      const refreshed = (await this.read())[accountId]
      if (
        !refreshed ||
        dueDay(refreshed, new Date()) !== day ||
        !AccountsManager.getAccountById(accountId)
      )
        return
      const auth = { accountId, accessToken }
      const response = await getQueryProfile(auth)
      const profile = response.data.profileChanges?.find(
        (change) => change.profile,
      )?.profile
      if (!profile?.items) throw new Error('Campaign profile missing')
      const remaining =
        profile.stats?.attributes?.quest_manager?.dailyQuestRerolls
      if (remaining === 0) {
        await record('Daily reroll already used.', true)
        return
      }
      if (typeof remaining !== 'number' || remaining < 1)
        throw new Error('Reroll allowance unavailable')
      const database = await ItemDatabase.snapshot()
      if (
        !Object.keys(database.records).some((id) =>
          id.startsWith('quest:daily'),
        )
      )
        throw new Error('Quest data unavailable')
      // Re-read preferences after authentication/network work, including disable.
      await this.writes
      const config = (await this.read())[accountId]
      if (
        !config ||
        dueDay(config, new Date()) !== day ||
        !AccountsManager.getAccountById(accountId)
      )
        return
      const selected = selectDailyQuest(
        profile.items,
        database.records,
        config.keep,
      )
      if (!selected) {
        await record(
          'No eligible daily quest: kept, over 50% complete, or missing objective data.',
          true,
        )
        return
      }
      // Persist intent before contacting Epic. A crash or ambiguous response must
      // never spend a second reroll after restart or a settings toggle.
      let reserved = false
      await this.change((data) => {
        const current = data[accountId]
        if (
          !current ||
          dueDay(current, new Date()) !== day ||
          JSON.stringify(current.keep) !== JSON.stringify(config.keep)
        )
          return
        current.attemptedDay = day
        current.lastActivity = new Date().toISOString()
        current.lastResult =
          'Reroll submitted; confirmation pending. Will not retry today.'
        reserved = true
      })
      if (!reserved) return
      attempted = true
      const result = await setFortRerollDailyQuest({
        ...auth,
        questId: selected.itemId,
      })
      const notifications = result.data?.notifications as unknown
      const confirmed =
        !('errorCode' in result.data) &&
        Array.isArray(notifications) &&
        notifications.some((n) => n?.type === 'dailyQuestReroll')
      await record(
        confirmed
          ? `Rerolled ${selected.name}.`
          : 'Epic did not confirm the reroll. Check your quests; no retry today.',
        true,
      )
    } catch {
      await record(
        attempted
          ? 'Reroll outcome unknown. Check your quests; no retry today.'
          : 'Could not refresh account or quest data. Retrying in 15 minutes.',
        attempted,
      )
    }
  }
}
