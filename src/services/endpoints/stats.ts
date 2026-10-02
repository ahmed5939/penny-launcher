import { statsService } from '../config/stats'

/** One account's lifetime stats, `{ stats: { br_…: number } }`. */
export function getAccountStats({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return statsService.get<unknown>(`/statsv2/account/${accountId}`, {
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}
