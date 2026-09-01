import type { CosmeticMeta } from '../core/locker-catalog'
import type { LockerCardResult } from '../core/locker-card'
import type {
  LockerCardWorkerRequest,
  LockerCardWorkerResponse,
} from '../../types/locker-card-worker'

import path from 'node:path'
import { utilityProcess } from 'electron'

export class LockerCardWorker {
  static render(
    payload: {
      cosmetics: Array<CosmeticMeta>
      directory: string
      displayName: string
      subtitle: string
    },
    onProgress: (done: number, total: number) => void
  ) {
    return new Promise<LockerCardResult>((resolve, reject) => {
      const child = utilityProcess.fork(
        path.join(__dirname, 'locker-card-worker.js'),
        [],
        { serviceName: 'Penny Locker Card Renderer' }
      )
      let settled = false
      let timeout: NodeJS.Timeout | null = null

      const finish = (settle: () => void) => {
        if (settled) {
          return
        }

        settled = true
        if (timeout) {
          clearTimeout(timeout)
        }
        child.removeAllListeners()
        child.kill()
        settle()
      }

      timeout = setTimeout(() => {
        finish(() => reject(new Error('Locker card rendering timed out')))
      }, 20 * 60 * 1_000)

      child.on('message', (message: LockerCardWorkerResponse) => {
        if (message.type === 'progress') {
          onProgress(message.done, message.total)
        } else if (message.type === 'result') {
          finish(() => resolve(message.result))
        } else if (message.type === 'error') {
          finish(() => reject(new Error(message.message)))
        }
      })
      child.once('error', (_type, location) => {
        finish(() =>
          reject(new Error(`Locker card renderer failed at ${location}`))
        )
      })
      child.once('exit', (code) => {
        if (!settled) {
          finish(() =>
            reject(new Error(`Locker card renderer exited with code ${code}`))
          )
        }
      })
      child.once('spawn', () => {
        child.postMessage({
          type: 'render',
          payload,
        } satisfies LockerCardWorkerRequest)
      })
    })
  }
}
