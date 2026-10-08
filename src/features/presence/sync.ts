import type {
  PresenceRequest,
  PresenceResult,
} from '../../types/presence'

import { useEffect } from 'react'

import { toast } from '../../lib/notifications'
import { usePresenceStore } from '../../state/accounts/presence'

/**
 * Mounted once by the shell, so the status bar and the page agree and a
 * session started from the page stays visible after leaving it.
 *
 * The main process pushes a snapshot on every change, in order; those
 * pushes are the only thing that sets the store. Replies to start/update
 * only decide which toast to show.
 */
export function usePresenceSync() {
  useEffect(() => {
    const { setSnapshot } = usePresenceStore.getState()
    let pushed = false

    const listener = window.electronAPI.onPresenceChanged((snapshot) => {
      pushed = true
      setSnapshot(snapshot)
    })

    window.electronAPI
      .getPresenceStatus()
      .then((snapshot) => {
        // A push that landed first is newer than this answer.
        if (snapshot && !pushed) {
          setSnapshot(snapshot)
        }
      })
      .catch(() => undefined)

    return () => {
      listener.removeListener()
    }
  }, [])
}

/** Bumped by Stop, so a start it cut short does not report a failure. */
let stops = 0

async function run(
  kind: 'start' | 'update',
  call: () => Promise<PresenceResult>
) {
  const store = usePresenceStore.getState()

  if (store.busy) {
    return null
  }

  const stopsBefore = stops

  store.setBusy(kind)

  try {
    const result = await call()

    if (stops !== stopsBefore) {
      return result
    }

    if (result.error) {
      // Reconnecting is information, not failure: the status still goes out.
      if (result.error.code === 'reconnecting') {
        toast.info(result.error.message)
      } else {
        toast.error(result.error.message)
      }
    } else if (kind === 'update') {
      toast.success('Status updated.')
    }

    return result
  } catch {
    toast.error(
      'Penny could not reach its presence service. Restart Penny if this keeps happening.'
    )
    return null
  } finally {
    if (usePresenceStore.getState().busy === kind) {
      usePresenceStore.getState().setBusy(null)
    }
  }
}

export function startPresence(request: PresenceRequest) {
  return run('start', () => window.electronAPI.startPresence(request))
}

export function updatePresence(request: PresenceRequest) {
  return run('update', () => window.electronAPI.updatePresence(request))
}

/** Never waits on `busy`: Stop has to work while a start is still signing in. */
export async function stopPresence() {
  stops += 1
  usePresenceStore.getState().setBusy('stop')

  try {
    await window.electronAPI.stopPresence()
  } catch {
    toast.error('Penny could not stop presence. Closing Penny stops it.')
  } finally {
    usePresenceStore.getState().setBusy(null)
  }
}
