import { recordAutomationHistory } from './automation-history'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DataDirectory } from './data-directory'
import { AccountsManager } from './accounts'
import { getQueryProfile, setRecycleItemBatch } from '../../services/endpoints/mcp'
import { recyclableRewards, resourceGains, type Items } from '../../features/expeditions/model'
import { llamaRewards, recycleLevels, type RecycleLevel, type RewardEvent, type RewardsStatus } from '../../features/automation-rewards/model'
import type { AutoExpeditionsData } from './auto-expeditions'

type Store = { version: 1; llamaRecycling: Record<string, RecycleLevel>; events: RewardEvent[] }
export class AutomationRewards {
  private static queue: Promise<unknown> = Promise.resolve()
  private static accounts = new Map<string, Promise<unknown>>()
  static withAccount<T>(accountId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.accounts.get(accountId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(work)
    this.accounts.set(accountId, next)
    void next.finally(() => { if (this.accounts.get(accountId) === next) this.accounts.delete(accountId) }).catch(() => undefined)
    return next
  }
  private static file() { return path.join(path.dirname(DataDirectory.autoExpeditionsFilePath), 'automation-rewards.json') }
  private static async read(): Promise<Store> {
    try {
      const data = JSON.parse(await readFile(this.file(), 'utf8'))
      if (data.version !== 1 || !Array.isArray(data.events) || !data.llamaRecycling) throw new Error('Invalid rewards ledger')
      return data
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, llamaRecycling: {}, events: [] }
      throw new Error('Reward history could not be read. Existing history was preserved.')
    }
  }
  private static change(edit: (store: Store) => void) {
    const work = this.queue.then(async () => {
      const store = await this.read()
      edit(store)
      const file = this.file(), temporary = file + '.' + randomUUID() + '.tmp'
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(temporary, JSON.stringify(store), 'utf8')
      await rename(temporary, file)
    })
    this.queue = work.catch(() => undefined)
    return work
  }
  static async update(accountId: string, level: unknown) {
    if (!AccountsManager.getAccounts().has(accountId) || !recycleLevels.includes(level as RecycleLevel)) throw new Error('Invalid account or recycling rarity')
    await this.change((s) => { s.llamaRecycling[accountId] = level as RecycleLevel })
    return this.status()
  }
  static async status(): Promise<RewardsStatus> {
    await this.queue
    const store = await this.read()
    const expeditionData = await DataDirectory.getAutoExpeditionsFile<AutoExpeditionsData>({})
    const events = [...store.events]
    for (const [accountId, config] of Object.entries(expeditionData)) {
      for (const [index, entry] of (config.history ?? []).entries()) {
        if (entry.action !== 'collected') continue
        events.push({ id: `expedition:${accountId}:${entry.expeditionId ?? index}:${entry.timestamp}`, accountId, source: 'expeditions', timestamp: entry.timestamp,
          description: entry.expedition, received: entry.rewardItems ?? [], recycled: entry.recycledItems ?? [], resources: entry.recyclingGains ?? [],
          status: entry.recyclingError ? 'error' : 'complete', error: entry.recyclingError ?? (!entry.rewardItems ? 'Legacy collection: item quantities were not recorded.' : undefined) })
      }
    }
    const accounts = [...AccountsManager.getAccounts().values()].map((a) => ({ accountId: a.accountId, name: a.customDisplayName || a.displayName }))
    for (const event of events) if (!accounts.some((a) => a.accountId === event.accountId)) accounts.push({ accountId: event.accountId, name: 'Removed account · ' + event.accountId.slice(-6) })
    return { accounts, llamaRecycling: store.llamaRecycling, events: events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)) }
  }
  static async recordLlama({ accountId, accessToken, before, notifications, description }: {
    accountId: string; accessToken: string; before: Items; notifications: unknown; description: string
  }) {
    const event: RewardEvent = { id: randomUUID(), accountId, source: 'llamas', timestamp: new Date().toISOString(), description,
      received: llamaRewards(notifications), recycled: [], resources: [], status: 'received' }
    // Persist the receipt first. A subsequent recycle failure cannot discard it.
    if (!event.received.length) { event.status = 'error'; event.error = 'Purchase returned no recognized reward details. Nothing was recycled.' }
    await this.change((s) => { s.events.push(event) })
    if (!event.received.length) {
      recordAutomationHistory({ accountId, source: 'Auto-llamas', description: event.error, outcome: 'error' })
      return
    }
    try {
      const level = (await this.read()).llamaRecycling[accountId] ?? 'off'
      if (level !== 'off') {
        const response = await getQueryProfile({ accountId, accessToken })
        const items = response.data.profileChanges?.[0]?.profile?.items
        if (!items) throw new Error('Could not verify inventory; nothing was recycled.')
        const targets = recyclableRewards(event.received, before, items, level)
        if (targets.length) {
          // Reread just before mutation so switching Off during the query is respected.
          const latest = (await this.read()).llamaRecycling[accountId] ?? 'off'
          const selected = recyclableRewards(targets, before, items, latest)
          if (selected.length) {
            event.status = 'recycling'
            await this.change((s) => { s.events[s.events.findIndex((e) => e.id === event.id)] = event })
            const recycled = await setRecycleItemBatch({ accountId, accessToken, targetItemIds: selected.map((r) => r.itemId!) })
            if (!recycled.data.profileChanges?.length) throw new Error('Epic did not confirm recycling. No automatic retry will be made.')
            const verified = await getQueryProfile({ accountId, accessToken })
            const after = verified.data.profileChanges?.[0]?.profile?.items
            if (!after) throw new Error('Recycling was sent but the result could not be verified. No automatic retry will be made.')
            event.recycled = selected.filter((r) => !after[r.itemId!])
            event.resources = resourceGains(items, after)
            if (event.recycled.length !== selected.length) throw new Error('Some items were not confirmed recycled.')
          }
        }
      }
      event.status = 'complete'
    } catch (error) {
      event.status = 'error'
      event.error = error instanceof Error ? error.message : 'Recycling failed'
    }
    await this.change((s) => { s.events[s.events.findIndex((e) => e.id === event.id)] = event })
    if (event.recycled.length || event.error) {
      const rewards: Record<string, number> = {}
      for (const reward of event.resources) rewards[reward.templateId] = (rewards[reward.templateId] ?? 0) + reward.quantity
      recordAutomationHistory({ accountId, source: 'Auto-llama recycling', rewards,
        description: event.error ?? `Recycled ${event.recycled.length} items`, outcome: event.error ? 'error' : 'success' })
    }
  }
}
