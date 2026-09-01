import type {
  LockerCardWorkerRequest,
  LockerCardWorkerResponse,
} from '../types/locker-card-worker'

import { renderLockerCard } from './core/locker-card'

const parent = process.parentPort

if (!parent) {
  throw new Error('Locker card worker requires an Electron parent port')
}

const send = (message: LockerCardWorkerResponse) => {
  parent.postMessage(message)
}

parent.on('message', (event) => {
  const request = event.data as LockerCardWorkerRequest

  if (request.type !== 'render') {
    return
  }

  void renderLockerCard({
    ...request.payload,
    onProgress: (done, total) => send({ type: 'progress', done, total }),
  })
    .then((result) => send({ type: 'result', result }))
    .catch((error: unknown) => {
      send({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    })
})
