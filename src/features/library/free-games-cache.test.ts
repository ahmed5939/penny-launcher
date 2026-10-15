import type { FreeGamesResponse } from './free-games'
import type { FreeGamesState } from './free-games-cache'

import { describe, expect, it, vi } from 'vitest'

import { createFreeGamesCache } from './free-games-cache'

const week: FreeGamesResponse = { now: [], next: [], fetchedAt: '2026-10-15T00:00:00.000Z' }

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Every request the cache makes stays pending until the test settles it, so replies can land in any order. */
function setup() {
  const pending: Array<{
    refresh: boolean
    resolve: (value: FreeGamesResponse) => void
    reject: (reason: unknown) => void
  }> = []
  const requestFreeGames = vi.fn(
    (refresh: boolean) =>
      new Promise<FreeGamesResponse>((resolve, reject) => {
        pending.push({ refresh, resolve, reject })
      })
  )
  const cache = createFreeGamesCache(requestFreeGames)
  let state: FreeGamesState = { data: null, error: false, loading: true }

  cache.subscribe((patch) => {
    state = { ...state, ...patch }
  })

  return { cache, pending, requestFreeGames, state: () => state }
}

describe('createFreeGamesCache', () => {
  it('keeps the newest success when older refreshes fail afterwards', async () => {
    const { cache, pending, requestFreeGames, state } = setup()

    cache.load()
    pending[0].reject(new Error('offline'))
    await flush()
    expect(state()).toMatchObject({ data: null, error: true, loading: false })

    cache.refresh()
    cache.refresh()
    expect(state()).toMatchObject({ data: null, error: true, loading: true })

    pending[2].resolve(week)
    await flush()
    expect(state()).toMatchObject({ data: week, error: false, loading: false })

    pending[1].reject(new Error('timeout'))
    await flush()
    expect(state()).toMatchObject({ data: week, error: false, loading: false })

    cache.load()
    expect(requestFreeGames).toHaveBeenCalledTimes(3)
  })

  it('ignores an older failure while a newer refresh is still pending', async () => {
    const { cache, pending, state } = setup()

    cache.load()
    cache.refresh()
    pending[0].reject(new Error('offline'))
    await flush()
    expect(state()).toMatchObject({ data: null, error: false, loading: true })

    pending[1].resolve(week)
    await flush()
    expect(state()).toMatchObject({ data: week, error: false, loading: false })
  })

  it('does not let an older success replace a newer failure', async () => {
    const { cache, pending, state } = setup()

    cache.load()
    cache.refresh()
    pending[1].reject(new Error('offline'))
    await flush()
    expect(state()).toMatchObject({ data: null, error: true, loading: false })

    pending[0].resolve(week)
    await flush()
    expect(state()).toMatchObject({ data: null, error: true, loading: false })
  })
})
