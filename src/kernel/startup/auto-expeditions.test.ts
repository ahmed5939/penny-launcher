import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoExpeditionsData } from './auto-expeditions'
vi.mock('./automation-rewards', () => ({ AutomationRewards: { withAccount: (_id: string, work: () => Promise<unknown>) => work() } }))
const mock = vi.hoisted(() => ({ data: {} as AutoExpeditionsData, board: vi.fn(), query: vi.fn(), collect: vi.fn(), recycle: vi.fn(), start: vi.fn() }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../core/expeditions', () => ({ Expeditions: { getExpeditions: mock.board } }))
vi.mock('../core/authentication', () => ({ Authentication: { verifyAccessToken: vi.fn(async () => 'test-token') } }))
vi.mock('./accounts', () => ({ AccountsManager: { getAccounts: () => new Map([['a', { accountId: 'a' }], ['b', { accountId: 'b' }]]) } }))
vi.mock('./notifications', () => ({ NativeNotifications: { send: vi.fn() } }))
vi.mock('./data-directory', () => ({ DataDirectory: {
  getAutoExpeditionsFile: async () => structuredClone(mock.data),
  updateAutoExpeditionsFile: async (data: AutoExpeditionsData) => { mock.data = structuredClone(data) },
} }))
vi.mock('../../services/endpoints/mcp', () => ({ getQueryProfile: mock.query, setCollectExpedition: mock.collect, setRecycleItemBatch: mock.recycle, setStartExpedition: mock.start, setClaimCollectedResources: vi.fn() }))
import { AutoExpeditions } from './auto-expeditions'
const profile = (items: object) => ({ data: { profileChanges: [{ profile: { items } }] } })
describe('automatic expedition lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.data = { a: { enabled: true, rewardTypes: ['Materials'], recycleBelow: 'Rare', notificationsEnabled: false } }
    mock.board.mockReset().mockResolvedValue({ slots: [] })
    mock.board.mockResolvedValueOnce({ slots: [{ state: 'ready', itemId: 'e', templateId: 'Expedition:expedition_supplyrun_short_t01' }] })
    mock.query.mockReset().mockResolvedValue(profile({ reward: { templateId: 'Worker:worker_r_t01', quantity: 1 } }))
    mock.query.mockResolvedValueOnce(profile({}))
    mock.collect.mockReset().mockResolvedValue({ data: { notifications: [{ bExpeditionSucceeded: true, expeditionRewards: [{ itemType: 'Worker:worker_r_t01', quantity: 1, itemGuid: 'reward' }] }] } })
    mock.recycle.mockReset().mockRejectedValue(new Error('Recycling rejected'))
  })
  it('retains confirmed collection and quantities when recycling fails', async () => {
    const result = await AutoExpeditions.run('a')
    expect(result.collected).toBe(1)
    expect(result.success).toBe(false)
    expect(mock.data.a.history).toHaveLength(1)
    expect(mock.data.a.history?.[0]).toMatchObject({ action: 'collected', success: true, recyclingError: 'Recycling rejected', rewardItems: [{ quantity: 1 }] })
  })
  it('does not recycle or count an unconfirmed collection', async () => {
    mock.collect.mockResolvedValue({ data: { notifications: [] } })
    const result = await AutoExpeditions.run('a')
    expect(result.collected).toBe(0)
    expect(result.success).toBe(false)
    expect(mock.recycle).not.toHaveBeenCalled()
  })
  it('records failed expeditions without recycling', async () => {
    mock.collect.mockResolvedValue({ data: { notifications: [{ bExpeditionSucceeded: false }] } })
    await AutoExpeditions.run('a')
    expect(mock.data.a.history?.[0].success).toBe(false)
    expect(mock.recycle).not.toHaveBeenCalled()
  })
  it('preserves a disable and another account settings during collection', async () => {
    mock.collect.mockImplementationOnce(async () => {
      await AutoExpeditions.update('a', { enabled: false })
      await AutoExpeditions.update('b', { enabled: false, rewardTypes: ['Heroes'] })
      return { data: { notifications: [{ bExpeditionSucceeded: true }] } }
    })
    await AutoExpeditions.run('a')
    expect(mock.data.a.enabled).toBe(false)
    expect(mock.data.b.rewardTypes).toEqual(['Heroes'])
    expect(mock.recycle).not.toHaveBeenCalled()
    expect(mock.start).not.toHaveBeenCalled()
  })
})
