import type { FreeGamesResponse } from './free-games'

export type FreeGamesState = { data: FreeGamesResponse | null; error: boolean; loading: boolean }

type Attempt = { id: number; response: Promise<FreeGamesResponse> }

/**
 * Epic's free games, shared by every mounted panel. Each request gets a
 * number and only the most recent one may write: an older reply that lands
 * late, or fails late, is dropped, so it cannot undo a newer success.
 */
export function createFreeGamesCache(requestFreeGames: (refresh: boolean) => Promise<FreeGamesResponse>) {
  let cache: Attempt | null = null
  let generation = 0
  const listeners = new Set<(patch: Partial<FreeGamesState>) => void>()

  function start(refresh: boolean) {
    const id = ++generation
    const response = requestFreeGames(refresh)

    cache = { id, response }
    response.catch(() => {
      if (cache?.id === id) cache = null
    })

    return cache
  }

  function settle(attempt: Attempt) {
    const publish = (patch: Partial<FreeGamesState>) => {
      if (attempt.id === generation) listeners.forEach((update) => update(patch))
    }

    attempt.response.then(
      (data) => publish({ data, error: false, loading: false }),
      () => publish({ data: null, error: true, loading: false })
    )
  }

  return {
    subscribe(listener: (patch: Partial<FreeGamesState>) => void) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    load() {
      settle(cache ?? start(false))
    },
    refresh() {
      const attempt = start(true)

      listeners.forEach((update) => update({ loading: true }))
      settle(attempt)
    },
  }
}
