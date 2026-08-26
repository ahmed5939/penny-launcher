import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

function describe(error: unknown) {
  const value = error instanceof Error
    ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
    : String(error)

  return value
    .replace(/(authorization|secret|token|password)(["'\s:=]+)[^\s,"']+/gi, '$1$2[redacted]')
    .slice(0, 12_000)
}

export class RuntimeLog {
  private static queue: Promise<void> = Promise.resolve()

  static error(scope: string, error: unknown) {
    const line = `${new Date().toISOString()} ERROR ${scope} ${describe(error)}\n`

    RuntimeLog.queue = RuntimeLog.queue
      .then(async () => {
        const directory = app.getPath('logs')
        await mkdir(directory, { recursive: true })
        await appendFile(path.join(directory, 'penny-runtime.log'), line, 'utf8')
      })
      .catch(() => {})
  }
}
