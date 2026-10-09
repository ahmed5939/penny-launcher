import type { SixthPerksScan } from '../../features/sixth-perks/types'

import { create } from 'zustand'

/**
 * The latest 6th Perks scan, in memory only. The catalog and the planner are
 * two routes over the same scan, so it lives here rather than in either page:
 * moving between them, even mid-scan, keeps it.
 *
 * A scan belongs to one account and one Collection Book setting. Changing the
 * setting needs a new scan; switching account hides the old one, and a reply
 * that lands after a newer scan started is dropped.
 */
export type SixthPerksSession = {
  accountId: string
  includeBook: boolean
  scan: SixthPerksScan | null
  loading: boolean
  error: string | null
}

type SixthPerksState = {
  /** Off by default: book-only rolls must be asked for. */
  includeBook: boolean
  session: SixthPerksSession | null
  /** The weapon the planner sent the user to; the catalog opens it once. */
  focusWeapon: string | null

  setIncludeBook: (enabled: boolean) => void
  scan: (accountId: string) => Promise<void>
  setFocusWeapon: (weaponId: string | null) => void
}

let generation = 0

export const useSixthPerksStore = create<SixthPerksState>()((set, get) => ({
  includeBook: false,
  session: null,
  focusWeapon: null,

  setIncludeBook: (enabled) => {
    if (enabled === get().includeBook) return
    generation++
    set({ includeBook: enabled, session: null })
  },
  scan: async (accountId) => {
    const { includeBook, session } = get()
    const same = session?.accountId === accountId && session.includeBook === includeBook
    if (same && session.loading) return
    const token = ++generation
    // A rescan keeps the last result on screen; only the button spins.
    set({ session: { accountId, includeBook, scan: same ? session.scan : null, loading: true, error: null } })
    try {
      const result = await window.electronAPI.requestSixthPerks(accountId, includeBook)
      if (token !== generation) return
      if (result.accountId !== accountId) throw new Error('Mismatched account response.')
      set({ session: { accountId, includeBook, scan: result, loading: false, error: null } })
    } catch {
      if (token !== generation) return
      set((state) => ({
        session: state.session && {
          ...state.session,
          loading: false,
          error: 'Could not scan this account. Check your sign-in and try again.',
        },
      }))
    }
  },
  setFocusWeapon: (weaponId) => set({ focusWeapon: weaponId }),
}))

/** The session for this account and the current book setting, or nothing. */
export function currentSession(state: Pick<SixthPerksState, 'includeBook' | 'session'>, accountId: string | null) {
  const { session } = state
  return accountId && session?.accountId === accountId && session.includeBook === state.includeBook ? session : null
}
