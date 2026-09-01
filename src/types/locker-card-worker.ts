import type { CosmeticMeta } from '../kernel/core/locker-catalog'
import type { LockerCardResult } from '../kernel/core/locker-card'

export type LockerCardWorkerRequest = {
  type: 'render'
  payload: {
    cosmetics: Array<CosmeticMeta>
    directory: string
    displayName: string
    subtitle: string
  }
}

export type LockerCardWorkerResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; result: LockerCardResult }
  | { type: 'error'; message: string }
