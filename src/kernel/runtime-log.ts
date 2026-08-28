import { appendFile, mkdir } from 'node:fs/promises'
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

  private static append(level: string, scope: string, value: unknown) {
    const line = `${new Date().toISOString()} ${level} ${scope} ${describe(value)}\n`

    RuntimeLog.queue = RuntimeLog.queue
      .then(async () => {
        const directory = app.getPath('logs')
        await mkdir(directory, { recursive: true })
        await appendFile(path.join(directory, 'penny-runtime.log'), line, 'utf8')
      })
      .catch(() => {})
  }

  static error(scope: string, error: unknown) {
    RuntimeLog.append('ERROR', scope, error)
  }

  static info(scope: string, message: unknown) {
    RuntimeLog.append('INFO', scope, message)
  }
}
