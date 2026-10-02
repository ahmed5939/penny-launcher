import type {
  CatalogueStatus,
  SpriteCollection,
  SpritesAllPayload,
} from '../../kernel/core/sprites'

import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * Every linked account's sprites, as the last sweep left them.
 *
 * A sweep reports one account at a time, so this keeps a column per account
 * and fills each in as it lands. A new sweep does not clear the grid: each
 * column keeps its last collection until its new one arrives, which is what
 * lets a refresh leave the data on screen while the header shows progress.
 */

export type SpritesAccountColumn = {
  accountId: string
  displayName: string
  /** `reading` until this sweep reaches the account. */
  state: 'reading' | 'read' | 'failed'
  collection: SpriteCollection | null
  errorMessage: string | null
}

type SpritesAllState = {
  sweepId: string | null
  running: boolean
  total: number
  /** Accounts this sweep has reported, so a replayed message counts once. */
  landed: Array<string>
  columns: Record<string, SpritesAccountColumn>
  catalogue: CatalogueStatus | null
  catalogueError: string | null

  request: (refresh: boolean) => void
  receive: (payload: SpritesAllPayload) => void
}

export const useSpritesAllStore = create<SpritesAllState>()((set) => ({
  sweepId: null,
  running: false,
  total: 0,
  landed: [],
  columns: {},
  catalogue: null,
  catalogueError: null,

  request: (refresh) => {
    set({ running: true })
    window.electronAPI.requestSpritesAll(refresh)
  },

  receive: (payload) =>
    set((state) => {
      const fresh = payload.sweepId !== state.sweepId

      if (payload.kind === 'start') {
        if (!fresh) {
          return state
        }

        const columns = { ...state.columns }

        payload.accounts.forEach(({ accountId, displayName }) => {
          columns[accountId] = {
            accountId,
            displayName,
            state: 'reading',
            collection: columns[accountId]?.collection ?? null,
            errorMessage: null,
          }
        })

        return {
          sweepId: payload.sweepId,
          running: true,
          total: payload.total,
          landed: [],
          columns,
        }
      }

      if (payload.kind === 'done') {
        return {
          sweepId: payload.sweepId,
          running: false,
          catalogue: payload.catalogue ?? state.catalogue,
          catalogueError: payload.catalogueError ?? null,
        }
      }

      const landed = fresh ? [] : state.landed
      const previous = state.columns[payload.accountId]

      return {
        sweepId: payload.sweepId,
        running: true,
        total: payload.total,
        landed: landed.includes(payload.accountId)
          ? landed
          : [...landed, payload.accountId],
        columns: {
          ...state.columns,
          [payload.accountId]: {
            accountId: payload.accountId,
            displayName: payload.displayName,
            state: payload.collection ? 'read' : 'failed',
            // A failed read keeps the last good one on screen, flagged.
            collection: payload.collection ?? previous?.collection ?? null,
            errorMessage: payload.errorMessage ?? null,
          },
        },
      }
    }),
}))

/** Listen for sweep messages while the page is open. */
export function useSpritesAllSync() {
  const receive = useSpritesAllStore((state) => state.receive)

  useEffect(() => {
    const listener = window.electronAPI.responseSpritesAll(async (payload) => {
      receive(payload)
    })

    return () => {
      listener.removeListener()
    }
  }, [])
}
