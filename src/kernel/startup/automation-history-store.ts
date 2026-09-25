import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { RewardsNotification } from '../../types/notifications'
import { isRecentAutomationEvent } from '../../lib/automation/history'

const entrySchema = z.object({
  id: z.string(), accountId: z.string(), createdAt: z.string(),
  rewards: z.record(z.number().finite()),
  accolades: z.object({ totalMissionXPRedeemed: z.number().finite(), totalQuestXPRedeemed: z.number().finite() }),
  source: z.string().optional(), description: z.string().optional(),
  outcome: z.enum(['success', 'error', 'info']).optional(),
})
const schema = z.object({ version: z.literal(1), entries: z.array(entrySchema) })

/** Serialize reads and atomic writes so concurrent automations cannot lose receipts. */
export class AutomationHistoryStore {
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private file: string) {}

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work)
    this.queue = next.catch(() => undefined)
    return next
  }

  private async read(): Promise<RewardsNotification[]> {
    try {
      return schema.parse(JSON.parse(await readFile(this.file, 'utf8'))).entries
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw new Error('Automation history could not be read. Existing history was preserved.')
    }
  }

  private async write(entries: RewardsNotification[]) {
    await mkdir(path.dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify({ version: 1, entries }), { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.file)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  async flush(): Promise<void> {
    await this.queue
  }

  list(): Promise<RewardsNotification[]> {
    return this.serialize(async () => {
      const saved = await this.read()
      const recent = saved.filter((entry) => isRecentAutomationEvent(entry.createdAt))
      if (recent.length !== saved.length) await this.write(recent)
      return recent.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    })
  }

  record(entry: RewardsNotification): Promise<void> {
    return this.serialize(async () => {
      const valid = entrySchema.parse(entry)
      const entries = new Map((await this.read()).map((item) => [item.id, item]))
      entries.set(valid.id, valid)
      await this.write([...entries.values()].filter((item) => isRecentAutomationEvent(item.createdAt)))
    })
  }
}
