import { recordAutomationHistory } from './automation-history'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const mock = vi.hoisted(() => ({ directory: { autoExpeditionsFilePath: '' }, query: vi.fn(), recycle: vi.fn(), expeditions: vi.fn() }))
vi.mock('./automation-history', () => ({ recordAutomationHistory: vi.fn() }))
vi.mock('./data-directory', () => ({ DataDirectory: { get autoExpeditionsFilePath() { return mock.directory.autoExpeditionsFilePath }, getAutoExpeditionsFile: mock.expeditions } }))
vi.mock('./accounts', () => ({ AccountsManager: { getAccounts: () => new Map([['a', { accountId: 'a', displayName: 'Alpha' }], ['b', { accountId: 'b', displayName: 'Beta' }]]) } }))
vi.mock('../../services/endpoints/mcp', () => ({ getQueryProfile: mock.query, setRecycleItemBatch: mock.recycle }))
import { AutomationRewards } from './automation-rewards'
import { llamaRewards, rewardTotals } from '../../features/automation-rewards/model'
const loot = [{ lootResult: { items: [{ itemType: 'Worker:worker_r_t01', itemGuid: 'new', quantity: 1 }, { itemType: 'AccountResource:xp', quantity: 25 }] } }]
const profile = (items: object) => ({ data: { profileChanges: [{ profile: { items } }] } })
let directory: string
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'penny-rewards-test-'))
  mock.directory.autoExpeditionsFilePath = path.join(directory, 'auto-expeditions.json')
  mock.expeditions.mockResolvedValue({})
  mock.query.mockReset(); mock.recycle.mockReset()
})
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })
describe('automation rewards ledger', () => {
  it('records quantities with recycling off without any inventory mutations', async () => {
    await AutomationRewards.recordLlama({ accountId: 'a', accessToken: 'mock', before: {}, notifications: loot, description: 'Free llama' })
    const status = await AutomationRewards.status()
    expect(status.events[0].received).toHaveLength(2)
    expect(status.events[0].status).toBe('complete')
    expect(mock.recycle).not.toHaveBeenCalled()
    expect(mock.query).not.toHaveBeenCalled()
  })
  it('records confirmed recycled items and positive resource deltas', async () => {
    await AutomationRewards.update('a', 'Rare')
    mock.query.mockResolvedValueOnce(profile({ new: { templateId: 'Worker:worker_r_t01', quantity: 1 }, xp: { templateId: 'AccountResource:xp', quantity: 25 } })).mockResolvedValueOnce(profile({ xp: { templateId: 'AccountResource:xp', quantity: 75 } }))
    mock.recycle.mockResolvedValue({ data: { profileChanges: [{}] } })
    await AutomationRewards.recordLlama({ accountId: 'a', accessToken: 'mock', before: {}, notifications: loot, description: 'Free llama' })
    const event = (await AutomationRewards.status()).events[0]
    expect(event.recycled).toEqual([{ templateId: 'Worker:worker_r_t01', quantity: 1, itemId: 'new' }])
    expect(event.resources).toEqual([{ templateId: 'AccountResource:xp', quantity: 50 }])
    expect(recordAutomationHistory).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'Auto-llama recycling', rewards: { 'AccountResource:xp': 50 }, outcome: 'success' }))
    expect(mock.recycle).toHaveBeenCalledWith({ accountId: 'a', accessToken: 'mock', targetItemIds: ['new'] })
  })
  it('preserves receipt when recycling fails and does not claim resource gains', async () => {
    await AutomationRewards.update('a', 'Rare')
    mock.query.mockResolvedValue(profile({ new: { templateId: 'Worker:worker_r_t01', quantity: 1 } }))
    mock.recycle.mockRejectedValue(new Error('Rejected'))
    await AutomationRewards.recordLlama({ accountId: 'a', accessToken: 'mock', before: {}, notifications: loot, description: 'Free llama' })
    const event = (await AutomationRewards.status()).events[0]
    expect(event.status).toBe('error'); expect(event.received).toHaveLength(2)
    expect(event.recycled).toEqual([]); expect(event.resources).toEqual([])
  })
  it('does not recycle preexisting inventory or rewards without explicit GUIDs', async () => {
    await AutomationRewards.update('a', 'Epic')
    const items = { new: { templateId: 'Worker:worker_r_t01', quantity: 1 } }
    mock.query.mockResolvedValue(profile(items))
    await AutomationRewards.recordLlama({ accountId: 'a', accessToken: 'mock', before: items, notifications: loot, description: 'Free llama' })
    expect(mock.recycle).not.toHaveBeenCalled()
  })
  it('keeps concurrent account receipts and combines existing expedition history once', async () => {
    mock.expeditions.mockResolvedValue({ a: { history: [{ action: 'collected', expedition: 'Expedition:test', timestamp: '2026-09-20T00:00:00Z', rewardItems: [{ templateId: 'AccountResource:xp', quantity: 10 }] }] } })
    await Promise.all(['a', 'b'].map((accountId) => AutomationRewards.recordLlama({ accountId, accessToken: 'mock', before: {}, notifications: loot, description: 'Free llama' })))
    const status = await AutomationRewards.status()
    expect(status.events).toHaveLength(3)
    expect(rewardTotals(status.events, 'received').find((r) => r.templateId === 'AccountResource:xp')?.quantity).toBe(60)
    expect((await AutomationRewards.status()).events).toHaveLength(3)
  })
  it('validates settings and supports the known loot notification shapes', async () => {
    await expect(AutomationRewards.update('a', 'Legendary')).rejects.toThrow()
    await expect(AutomationRewards.update('unknown', 'Rare')).rejects.toThrow()
    for (const notification of [{ loot: { items: [{ itemType: 'AccountResource:xp', quantity: 5 }] } }, { lootGranted: { items: [{ itemType: 'AccountResource:xp', quantity: 5 }] } }, { loot: { lootGranted: { items: [{ itemType: 'AccountResource:xp', quantity: 5 }] } } }]) expect(llamaRewards([notification])).toEqual([{ templateId: 'AccountResource:xp', quantity: 5 }])
  })
})
