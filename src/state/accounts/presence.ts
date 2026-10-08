import type {
  PresenceAvailability,
  PresenceSnapshot,
} from '../../types/presence'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const emptyPresenceSnapshot: PresenceSnapshot = {
  accountId: null,
  displayName: null,
  state: 'stopped',
  text: null,
  availability: null,
  pending: null,
  lastPublishedAt: null,
  expiresAt: null,
  retryAt: null,
  stoppedReason: null,
  errorCode: null,
  errorMessage: null,
}

/** What the main process last said. Never persisted: a restart starts stopped. */
export const usePresenceStore = create<{
  snapshot: PresenceSnapshot
  /** A start, update or stop is waiting on the main process. */
  busy: 'start' | 'update' | 'stop' | null
  setSnapshot: (snapshot: PresenceSnapshot) => void
  setBusy: (busy: 'start' | 'update' | 'stop' | null) => void
}>()((set) => ({
  snapshot: emptyPresenceSnapshot,
  busy: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  setBusy: (busy) => set({ busy }),
}))

/**
 * The form, remembered between launches. Remembering it never starts
 * anything: presence only ever starts from the button.
 */
export const usePresencePrefs = create<{
  text: string
  availability: PresenceAvailability
  durationMinutes: number | null
  setText: (text: string) => void
  setAvailability: (availability: PresenceAvailability) => void
  setDurationMinutes: (minutes: number | null) => void
}>()(
  persist(
    (set) => ({
      text: '',
      availability: 'online',
      durationMinutes: 60,
      setText: (text) => set({ text }),
      setAvailability: (availability) => set({ availability }),
      setDurationMinutes: (durationMinutes) => set({ durationMinutes }),
    }),
    {
      name: 'penny-presence',
      partialize: ({ text, availability, durationMinutes }) => ({
        text,
        availability,
        durationMinutes,
      }),
    }
  )
)
