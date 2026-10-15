import type { AlertsDoneSearchPlayerResponse } from '../../../types/alerts'

export type LookupOutcome = 'idle' | 'not-found' | 'private' | 'partial' | 'ok'

/**
 * Which screen the last search earns. A lookup that found the player but not
 * their alert record is `partial`, not `ok`, even though `data` is set.
 */
export function lookupOutcome(
  playerData: AlertsDoneSearchPlayerResponse | null | undefined,
): LookupOutcome {
  if (!playerData) {
    return 'idle'
  }

  if (playerData.success) {
    return 'ok'
  }

  if (playerData.isPrivate) {
    return 'private'
  }

  return playerData.data ? 'partial' : 'not-found'
}
