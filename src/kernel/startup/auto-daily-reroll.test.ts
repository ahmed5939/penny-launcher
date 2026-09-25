import { recordAutomationHistory } from './automation-history'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  login: vi.fn(),
  query: vi.fn(),
  reroll: vi.fn(),
  auth: vi.fn(),
  account: vi.fn(),
  snapshot: vi.fn(),
}))
vi.mock('./automation-history', () => ({ recordAutomationHistory: vi.fn() }))
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(async (file: string) => {
    if (!mocks.files.has(file))
      throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    return mocks.files.get(file)
  }),
  writeFile: vi.fn(async (file: string, data: string) => {
    mocks.files.set(file, data)
  }),
  rename: vi.fn(async (from: string, to: string) => {
    mocks.files.set(to, mocks.files.get(from)!)
    mocks.files.delete(from)
  }),
}))
vi.mock('./data-directory', () => ({
  DataDirectory: { getDataDirectoryPath: () => '/test' },
}))
vi.mock('./accounts', () => ({
  AccountsManager: { getAccountById: mocks.account },
}))
vi.mock('../core/authentication', () => ({
  Authentication: { verifyAccessToken: mocks.auth },
}))
vi.mock('../core/item-database', () => ({
  ItemDatabase: { snapshot: mocks.snapshot },
}))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
vi.mock('../../services/endpoints/mcp', () => ({
  getQueryProfile: mocks.query,
  setClientQuestLogin: mocks.login,
  setFortRerollDailyQuest: mocks.reroll,
}))

async function service() {
  return (await import('./auto-daily-reroll')).AutoDailyReroll
}

describe('daily reroll worker', () => {
  const settings = (config: Record<string, unknown>) => {
    const file = [...mocks.files.keys()][0]
    mocks.files.set(file, JSON.stringify({ a: config }))
  }
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T12:00:00Z'))
    mocks.files.clear()
    mocks.files.set(
      '/test/auto-daily-reroll.json'.replaceAll(
        '/',
        process.platform === 'win32' ? '\\' : '/',
      ),
      JSON.stringify({ a: { enabled: true, keep: [] } }),
    )
    mocks.account.mockReturnValue({ accountId: 'a' })
    mocks.auth.mockResolvedValue('test-token')
    mocks.login.mockResolvedValue({ data: { profileChanges: [] } })
    mocks.snapshot.mockResolvedValue({
      records: {
        'quest:daily_test': {
          name: 'Daily test',
          objectives: [{ backendName: 'kills', count: 100 }],
        },
      },
    })
    mocks.query.mockResolvedValue({
      data: {
        profileChanges: [
          {
            profile: {
              stats: {
                attributes: { quest_manager: { dailyQuestRerolls: 1 } },
              },
              items: {
                quest1: {
                  templateId: 'Quest:daily_test',
                  attributes: { quest_state: 'Active', completion_kills: 0 },
                },
              },
            },
          },
        ],
      },
    })
    mocks.reroll.mockResolvedValue({
      data: { notifications: [{ type: 'dailyQuestReroll' }] },
    })
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('updates quests independently at 00:01 without querying or rerolling', async () => {
    settings({ enabled: false, updateQuests: true, keep: [] })
    const worker = await service()
    vi.setSystemTime(new Date('2026-09-20T00:00:59Z'))
    await worker.tick()
    expect(mocks.login).not.toHaveBeenCalled()
    vi.setSystemTime(new Date('2026-09-20T00:01:00Z'))
    await worker.tick()
    await worker.tick()
    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.query).not.toHaveBeenCalled()
    expect(mocks.reroll).not.toHaveBeenCalled()
    vi.resetModules()
    await (await service()).tick()
    expect(mocks.login).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-09-21T00:01:00Z'))
    await (await service()).tick()
    expect(mocks.login).toHaveBeenCalledTimes(2)
  })

  it('updates at reset then rerolls at 00:04 without another quest update', async () => {
    const worker = await service()
    vi.setSystemTime(new Date('2026-09-20T00:01:00Z'))
    await worker.tick()
    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.reroll).not.toHaveBeenCalled()
    vi.setSystemTime(new Date('2026-09-20T00:04:00Z'))
    await worker.tick()
    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.reroll).toHaveBeenCalledTimes(1)
  })

  it('blocks reroll until a failed quest update successfully retries', async () => {
    mocks.login.mockResolvedValueOnce({ data: { errorCode: 'failed' } })
    const worker = await service()
    await worker.tick()
    await worker.tick()
    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.query).not.toHaveBeenCalled()
    expect(mocks.reroll).not.toHaveBeenCalled()
    vi.setSystemTime(new Date('2026-09-20T12:15:00Z'))
    await worker.tick()
    expect(mocks.login).toHaveBeenCalledTimes(2)
    expect(mocks.reroll).toHaveBeenCalledTimes(1)
  })

  it('enforces the update dependency and retains updates when reroll is disabled', async () => {
    vi.setSystemTime(new Date('2026-09-20T00:00:00Z'))
    const worker = await service()
    let result = await worker.update('a', {
      enabled: true,
      updateQuests: false,
      keep: [],
    })
    expect(result.accounts.a.updateQuests).toBe(true)
    result = await worker.update('a', { enabled: false, keep: [] })
    expect(result.accounts.a.updateQuests).toBe(true)
    result = await worker.update('a', {
      enabled: false,
      updateQuests: false,
      keep: [],
    })
    expect(result.accounts.a.updateQuests).toBe(false)
    vi.setSystemTime(new Date('2026-09-20T12:00:00Z'))
    await worker.tick()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('does not mark an unconfirmed quest update successful', async () => {
    mocks.login.mockResolvedValue({ data: {} })
    const worker = await service()
    await worker.tick()
    const result = await worker.status()
    expect(result.accounts.a.updatedDay).toBeUndefined()
    expect(result.accounts.a.lastUpdateResult).toContain('Could not update')
    expect(mocks.reroll).not.toHaveBeenCalled()
  })

  it('keeps standalone updates working if the quest catalogue is unavailable', async () => {
    settings({ enabled: false, updateQuests: true, keep: [] })
    mocks.snapshot.mockRejectedValue(new Error('offline'))
    const worker = await service()
    await worker.tick()
    const result = await worker.status()
    expect(result.questDataUnavailable).toBe(true)
    expect(result.accounts.a.updatedDay).toBe('2026-09-20')
    expect(mocks.reroll).not.toHaveBeenCalled()
  })

  it('refreshes before querying and only spends one reroll across restart', async () => {
    const worker = await service()
    await Promise.all([worker.tick(), worker.tick()])
    expect(mocks.login.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.query.mock.invocationCallOrder[0],
    )
    expect(mocks.reroll).toHaveBeenCalledWith({
      accountId: 'a',
      accessToken: 'test-token',
      questId: 'quest1',
    })
    vi.resetModules()
    await (await service()).tick()
    expect(mocks.reroll).toHaveBeenCalledTimes(1)
  })
  it('does not retry ambiguous outcomes, even after restart', async () => {
    mocks.reroll.mockRejectedValue(new Error('timeout'))
    await (await service()).tick()
    vi.resetModules()
    await (await service()).tick()
    expect(mocks.reroll).toHaveBeenCalledTimes(1)
    expect((await (await service()).status()).accounts.a.lastResult).toContain(
      'outcome unknown',
    )
  })
  it('requires an Epic reroll notification before reporting success', async () => {
    mocks.reroll.mockResolvedValue({ data: { profileChanges: [] } })
    const worker = await service()
    await worker.tick()
    expect(recordAutomationHistory).toHaveBeenCalledWith(expect.objectContaining({ source: 'Auto daily reroll', outcome: 'info', description: expect.stringContaining('did not confirm') }))
    expect((await worker.status()).accounts.a.lastResult).toContain(
      'did not confirm',
    )
  })
  it('never submits when Epic reports no allowance', async () => {
    mocks.query.mockResolvedValue({
      data: {
        profileChanges: [
          {
            profile: {
              items: {},
              stats: {
                attributes: { quest_manager: { dailyQuestRerolls: 0 } },
              },
            },
          },
        ],
      },
    })
    const worker = await service()
    await worker.tick()
    expect(mocks.reroll).not.toHaveBeenCalled()
    expect((await worker.status()).accounts.a.lastResult).toContain(
      'already used',
    )
  })
  it('honors disabling while authentication is in flight', async () => {
    mocks.auth.mockImplementation(async () => {
      const file = [...mocks.files.keys()][0]
      mocks.files.set(file, JSON.stringify({ a: { enabled: false, keep: [] } }))
      return 'test-token'
    })
    await (await service()).tick()
    expect(mocks.reroll).not.toHaveBeenCalled()
  })
  it('ignores removed accounts', async () => {
    mocks.account.mockReturnValue(undefined)
    await (await service()).tick()
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.reroll).not.toHaveBeenCalled()
  })
  it('waits fifteen minutes after authentication failure', async () => {
    mocks.auth.mockResolvedValue(null)
    const worker = await service()
    await worker.tick()
    await worker.tick()
    expect(mocks.auth).toHaveBeenCalledTimes(1)
    expect(mocks.reroll).not.toHaveBeenCalled()
    vi.setSystemTime(new Date('2026-09-20T12:16:00Z'))
    await worker.tick()
    expect(mocks.auth).toHaveBeenCalledTimes(2)
  })
  it('rejects untrusted settings and does not overwrite a damaged file', async () => {
    const worker = await service()
    await expect(
      worker.update('a', {
        enabled: true,
        keep: [],
        attemptedDay: 'yesterday',
      }),
    ).rejects.toThrow()
    const file = [...mocks.files.keys()][0]
    mocks.files.set(file, 'broken')
    await expect(
      worker.update('a', { enabled: true, keep: [] }),
    ).rejects.toThrow()
    expect(mocks.files.get(file)).toBe('broken')
  })
})
