import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ send: vi.fn(), directory: '' }))
vi.mock('./windows/main', () => ({ MainWindow: { instance: { webContents: { send: mock.send } } } }))
vi.mock('./data-directory', () => ({ DataDirectory: { getDataDirectoryPath: () => mock.directory } }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
beforeEach(async () => {
  mock.directory = await mkdtemp(path.join(tmpdir(), 'penny-history-ipc-'))
  vi.resetModules()
})
afterEach(async () => { await rm(mock.directory, { recursive: true, force: true }) })
it('saves receipts even when the window is closed and restores them after restart', async () => {
  const { automationHistory, recordAutomationHistory } = await import('./automation-history')
  mock.send.mockImplementation(() => { throw new Error('Window closed') })
  recordAutomationHistory({ id: 'one', accountId: 'a', source: 'Auto-expeditions', rewards: { wood: 2 } })
  recordAutomationHistory({ id: 'one', accountId: 'a', source: 'Auto-expeditions', rewards: { wood: 2, xp: 5 } })
  expect(await automationHistory()).toHaveLength(1)
  vi.resetModules()
  const restarted = await import('./automation-history')
  expect((await restarted.automationHistory())[0].rewards).toEqual({ wood: 2, xp: 5 })
})
