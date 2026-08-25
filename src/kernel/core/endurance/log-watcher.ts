import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * Tails FortniteGame.log by polling its size and reading only the appended
 * bytes. The client rewrites the file on every fresh launch, so a shrinking
 * size resets the offset instead of erroring.
 *
 * This is what replaces the old macro's screenshots: the log announces map
 * loads and frontend returns, which are exactly the slow transitions the
 * runner needs to wait on.
 */
export class LogWatcher {
  private offset = 0
  private timer: NodeJS.Timeout | null = null
  private reading = false
  private listeners = new Set<(line: string) => void>()

  static defaultLogPath() {
    return path.join(
      `${process.env.LOCALAPPDATA}`,
      'FortniteGame',
      'Saved',
      'Logs',
      'FortniteGame.log',
    )
  }

  constructor(private logPath = LogWatcher.defaultLogPath()) {}

  onLine(listener: (line: string) => void) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  async start() {
    if (this.timer) {
      return
    }

    // Skip history: only lines written after the watcher starts matter.
    try {
      this.offset = (await stat(this.logPath)).size

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      this.offset = 0
    }

    this.timer = setInterval(() => {
      this.poll().catch(() => {})
    }, 500)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Resolves when a line matching the pattern appears, or with null on
   * timeout. Never rejects — a missing log file just means waiting.
   */
  waitFor(
    pattern: RegExp,
    timeoutMs: number,
    abort?: { aborted: boolean },
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const done = (value: string | null) => {
        clearTimeout(timer)
        clearInterval(abortTimer)
        unsubscribe()
        resolve(value)
      }
      const unsubscribe = this.onLine((line) => {
        if (pattern.test(line)) {
          done(line)
        }
      })
      const timer = setTimeout(() => done(null), timeoutMs)
      const abortTimer = setInterval(() => {
        if (abort?.aborted) {
          done(null)
        }
      }, 250)
    })
  }

  private async poll() {
    if (this.reading) {
      return
    }

    this.reading = true

    try {
      const { size } = await stat(this.logPath)

      if (size < this.offset) {
        // New session truncated the file; start over from the top.
        this.offset = 0
      }

      if (size === this.offset) {
        return
      }

      const chunk = await new Promise<string>((resolve, reject) => {
        let data = ''

        createReadStream(this.logPath, {
          start: this.offset,
          end: size - 1,
          encoding: 'utf8',
        })
          .on('data', (part) => {
            data += part
          })
          .on('end', () => resolve(data))
          .on('error', reject)
      })

      this.offset = size

      for (const line of chunk.split(/\r?\n/)) {
        if (!line) {
          continue
        }

        for (const listener of this.listeners) {
          listener(line)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Log file missing (game not started yet) — keep polling.
    } finally {
      this.reading = false
    }
  }
}
