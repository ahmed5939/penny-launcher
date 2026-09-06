import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import { redactSecrets } from './secret-redaction'

function describe(error: unknown) {
  const value = error instanceof Error
    ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
    : String(error)

  return redactSecrets(value).slice(0, 12_000)
}

export class RuntimeLog {
  private static queue: Promise<void> = Promise.resolve()
  private static pending = 0
  private static lastMessage = ''
  private static lastMessageAt = 0
  private static readonly maxBytes = 2 * 1024 * 1024

  private static append(level: string, scope: string, value: unknown) {
    if (RuntimeLog.pending >= 100) return
    const message = `${level} ${describe(scope)} ${describe(value)}`
    const now = Date.now()
    if (message === RuntimeLog.lastMessage && now - RuntimeLog.lastMessageAt < 60_000) return
    RuntimeLog.lastMessage = message
    RuntimeLog.lastMessageAt = now
    const line = `${new Date(now).toISOString()} ${message}\n`
    RuntimeLog.pending += 1

    RuntimeLog.queue = RuntimeLog.queue
      .then(async () => {
        const directory = app.getPath('logs')
        await mkdir(directory, { recursive: true })
        const file = path.join(directory, 'penny-runtime.log')
        const size = await stat(file).then((value) => value.size).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return 0
          throw error
        })
        if (size + Buffer.byteLength(line) > RuntimeLog.maxBytes) {
          await rm(`${file}.1`, { force: true })
          // Discard an oversized legacy log instead of preserving an unbounded archive.
          if (size > RuntimeLog.maxBytes) await rm(file)
          else await rename(file, `${file}.1`)
        }
        await appendFile(file, line, 'utf8')
      })
      .catch(() => {})
      .finally(() => { RuntimeLog.pending -= 1 })
  }

  static error(scope: string, error: unknown) {
    RuntimeLog.append('ERROR', scope, error)
  }

  static info(scope: string, message: unknown) {
    RuntimeLog.append('INFO', scope, message)
  }
}
