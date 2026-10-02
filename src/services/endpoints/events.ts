import { eventsService } from '../config/events'

/**
 * The account's own competitive calendar: every event it is eligible for or
 * has played, the windows each runs, the scoring templates, and the tokens
 * (division grants, access passes) the account itself holds.
 *
 * Some deployments answer only when a `region` is named — the caller tries
 * without one first and retries with a region when Epic refuses.
 */
export function getEventsData({
  accessToken,
  accountId,
  region,
}: {
  accessToken: string
  accountId: string
  region?: string
}) {
  return eventsService.get<unknown>(
    `/api/v1/events/Fortnite/data/${accountId}`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
      params: {
        ...(region ? { region } : {}),
      },
    }
  )
}

/** The account's own results across one event's windows: score, placement, points. */
export function getEventHistory({
  accessToken,
  accountId,
  eventId,
}: {
  accessToken: string
  accountId: string
  eventId: string
}) {
  return eventsService.get<unknown>(
    `/api/v1/events/Fortnite/${eventId}/history/${accountId}`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}
