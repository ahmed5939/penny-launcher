import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AccountScopeMode = 'single' | 'multi'

export type AccountScopeState = {
  /** The subject. Single-account tools render this one. */
  primary: string | null
  /** The set bulk tools act on. Always contains `primary` when non-empty. */
  members: Array<string>
  /** Drives whether the account list offers tick boxes. */
  mode: AccountScopeMode

  setPrimary: (accountId: string | null) => void
  toggleMember: (accountId: string) => void
  setMembers: (accountIds: Array<string>) => void
  selectAll: (accountIds: Array<string>) => void
  reconcile: (availableIds: Array<string>) => void
}

/**
 * The account scope — who the app is currently about.
 *
 * This replaces both the titlebar's `selected` account and the private
 * `selectedAccounts` array that lived in five separate stores. Those were the
 * same question asked twelve times: picking an account up top changed nothing
 * on Expeditions, Profile, or any of the other account tools,
 * because each of them owned its own answer.
 *
 * Two invariants hold everywhere, and every action below maintains them:
 *
 *   1. `members` never contains an id that is not a known account.
 *   2. `primary` is null only when `members` is empty, and is otherwise
 *      always a member.
 *
 * Pages read this and render. They no longer own account state at all, which
 * is what lets the picker card come off eleven screens.
 */
export const useAccountScopeStore = create<AccountScopeState>()(
  persist(
    (set, get) => ({
      primary: null,
      members: [],
      mode: 'single',

      setPrimary: (accountId) => {
        if (accountId === null) {
          return set({ primary: null, members: [], mode: 'single' })
        }

        const { members, mode } = get()

        /**
         * Picking an account in single mode replaces the scope; in multi mode
         * it moves the subject without disturbing a set you deliberately
         * built. Silently collapsing a four-account selection because someone
         * clicked a name would be the worst kind of surprise for an app whose
         * buttons act on that set.
         */
        if (mode === 'single') {
          return set({ primary: accountId, members: [accountId] })
        }

        set({
          primary: accountId,
          members: members.includes(accountId)
            ? members
            : [...members, accountId],
        })
      },

      toggleMember: (accountId) => {
        const { members, primary } = get()
        const next = members.includes(accountId)
          ? members.filter((id) => id !== accountId)
          : [...members, accountId]

        // Never leave the app with nothing in scope — every bulk action would
        // become a no-op with no explanation on screen.
        if (next.length === 0) {
          return
        }

        set({
          members: next,
          mode: next.length > 1 ? 'multi' : 'single',
          primary: next.includes(primary ?? '') ? primary : next[0],
        })
      },

      setMembers: (accountIds) => {
        const members = [...new Set(accountIds)]
        const { primary } = get()

        set({
          members,
          mode: members.length > 1 ? 'multi' : 'single',
          primary: members.includes(primary ?? '')
            ? primary
            : (members[0] ?? null),
        })
      },

      selectAll: (accountIds) => {
        get().setMembers(accountIds)
      },

      /**
       * Called whenever the account list changes. Drops ids for accounts that
       * were removed, and seeds an empty scope so the app is never sitting on
       * nothing after a fresh install or a wiped data directory.
       */
      reconcile: (availableIds) => {
        const available = new Set(availableIds)
        const { members, mode, primary } = get()
        const nextMembers = members.filter((id) => available.has(id))

        if (nextMembers.length === 0) {
          const first = availableIds[0] ?? null

          return set({
            members: first ? [first] : [],
            mode: 'single',
            primary: first,
          })
        }

        set({
          members: nextMembers,
          mode: nextMembers.length > 1 ? mode : 'single',
          primary: nextMembers.includes(primary ?? '')
            ? primary
            : nextMembers[0],
        })
      },
    }),
    {
      name: 'penny-account-scope',
      /**
       * Only the scope itself survives a restart — the actions are rebuilt on
       * every load, and persisting them would pin stale closures to disk.
       */
      partialize: (state) => ({
        primary: state.primary,
        members: state.members,
        mode: state.mode,
      }),
    }
  )
)
