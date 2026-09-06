import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), send: vi.fn() }))
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile, mkdir: vi.fn(), writeFile: vi.fn() }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
vi.mock('../startup/data-directory', () => ({ DataDirectory: { getDataDirectoryPath: () => '/cache' } }))
vi.mock('../startup/windows/main', () => ({ MainWindow: { instance: { webContents: { send: mocks.send } } } }))
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

it('shares concurrent reads, reuses warm data, then releases it and reloads from disk', async () => {
  vi.useFakeTimers()
  mocks.readFile.mockResolvedValue(JSON.stringify({
    version: 8, fetchedAt: new Date().toISOString(), records: { example: {} }, ratings: {}, alterationPools: {},
  }))
  const { ItemDatabase } = await import('./item-database')
  await Promise.all([ItemDatabase.request(), ItemDatabase.request()])
  expect(mocks.readFile).toHaveBeenCalledTimes(1)
  await ItemDatabase.request()
  expect(mocks.readFile).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(60_000)
  await ItemDatabase.request()
  expect(mocks.readFile).toHaveBeenCalledTimes(2)
  expect(mocks.send.mock.calls.at(-1)?.[1].total).toBe(1)
})
