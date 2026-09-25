import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AutomationHistoryStore } from './automation-history-store'
import { AUTOMATION_HISTORY_RETENTION_MS } from '../../lib/automation/history'
import type { RewardsNotification } from '../../types/notifications'
let directory: string
let file: string
const now = new Date('2026-09-25T12:00:00Z').getTime()
const entry = (id: string, createdAt = new Date(now).toISOString()): RewardsNotification => ({ id, accountId: 'a', createdAt, rewards: { wood: 2 }, accolades: { totalMissionXPRedeemed: 0, totalQuestXPRedeemed: 0 } })
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  directory = await mkdtemp(path.join(tmpdir(), 'penny-history-'))
  file = path.join(directory, 'automation-history.json')
})
afterEach(async () => { vi.useRealTimers(); await rm(directory, { recursive: true, force: true }) })
it('restores records after restart, including updates to an existing receipt', async () => {
  const store = new AutomationHistoryStore(file)
  await store.record(entry('one'))
  await store.record({ ...entry('one'), rewards: { wood: 2, xp: 5 } })
  const restarted = new AutomationHistoryStore(file)
  expect(await restarted.list()).toEqual([{ ...entry('one'), rewards: { wood: 2, xp: 5 } }])
})
it('retains exactly 30 days and removes expired entries from disk on read', async () => {
  const store = new AutomationHistoryStore(file)
  const boundary = entry('boundary', new Date(now - AUTOMATION_HISTORY_RETENTION_MS).toISOString())
  await store.record(boundary)
  await store.record(entry('expired', new Date(now - AUTOMATION_HISTORY_RETENTION_MS - 1).toISOString()))
  await store.record(entry('recent'))
  expect((await store.list()).map((e) => e.id)).toEqual(['boundary', 'recent'])
  vi.setSystemTime(now + 1)
  expect((await store.list()).map((e) => e.id)).toEqual(['recent'])
  expect(JSON.parse(await readFile(file, 'utf8')).entries.map((e: RewardsNotification) => e.id)).toEqual(['recent'])
})
it('serializes concurrent automations without dropping receipts', async () => {
  const store = new AutomationHistoryStore(file)
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.record(entry(String(i)))))
  expect(await new AutomationHistoryStore(file).list()).toHaveLength(20)
})
it('preserves corrupt history instead of replacing it with an empty ledger', async () => {
  await writeFile(file, '{broken')
  const store = new AutomationHistoryStore(file)
  await expect(store.record(entry('one'))).rejects.toThrow('preserved')
  await expect(store.list()).rejects.toThrow('preserved')
  expect(await readFile(file, 'utf8')).toBe('{broken')
})
