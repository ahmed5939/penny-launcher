import { habaneroService } from '../config/habanero'

/**
 * One account's progress on every active ranked track, read with that
 * account's own token: an array of
 * `{ gameId, trackguid, accountId, rankingType, lastUpdated, currentDivision,
 *    highestDivision, promotionProgress, currentPlayerRanking }`.
 *
 * Own account, own token — the path id is the account the token belongs to.
 */
export function getRankedProgress({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return habaneroService.get<unknown>(`/trackprogress/${accountId}`, {
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}

/**
 * The active tracks' metadata — `trackguid → rankingType, beginTime, endTime,
 * season` — used only to label tracks and pick the current season. Any linked
 * account's token will do; the reply carries no per-account data. May 400 or
 * need params on some seasons, so the caller degrades gracefully.
 */
export function getRankedTracks({ accessToken }: { accessToken: string }) {
  return habaneroService.get<unknown>('/tracks/query', {
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}
