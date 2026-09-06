import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const environment = vi.hoisted(() => ({ directory: '' }))
vi.mock('electron', () => ({ app: { getPath: () => environment.directory } }))

afterEach(async () => {
  if (environment.directory) await rm(environment.directory, { recursive: true, force: true })
})

it('bounds log files, suppresses repeats, and drops an excessive queued burst', async () => {
  environment.directory = await mkdtemp(path.join(tmpdir(), 'penny-log-test-'))
  const { RuntimeLog } = await import('./runtime-log')
  // Await the internal writer only to ensure disk observations are complete.
  const writer = RuntimeLog as unknown as { queue: Promise<void> }
  RuntimeLog.error('repeat', 'same error')
  RuntimeLog.error('repeat', 'same error')
  await writer.queue
  const file = path.join(environment.directory, 'penny-runtime.log')
  expect((await readFile(file, 'utf8')).match(/same error/g)).toHaveLength(1)
  for (let batch = 0; batch < 5; batch += 1) {
    for (let i = 0; i < 100; i += 1) RuntimeLog.info('test', `${batch}:${i}:${'x'.repeat(12_000)}`)
    await writer.queue
  }
  expect(await readdir(environment.directory)).toEqual(expect.arrayContaining(['penny-runtime.log', 'penny-runtime.log.1']))
  for (const entry of await readdir(environment.directory)) {
    expect((await stat(path.join(environment.directory, entry))).size).toBeLessThanOrEqual(2 * 1024 * 1024)
  }
  for (let i = 0; i < 200; i += 1) RuntimeLog.info('burst', `queued-${i}`)
  await writer.queue
  const content = await readFile(file, 'utf8')
  expect(content).toContain('queued-99')
  expect(content).not.toContain('queued-100')
})
