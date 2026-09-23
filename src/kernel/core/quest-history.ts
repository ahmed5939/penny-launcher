import { Authentication } from './authentication'
import { AccountsManager } from '../startup/accounts'
import { parseQuestHistory } from '../../features/quest-history/model'

/** Read-only. Account id in, main-process account lookup, no token leaves this file. */
export async function requestQuestHistory(accountId: string) {
  const account = AccountsManager.getAccounts().get(accountId)
  if (!account) throw new Error('Select a linked account.')
  const accessToken = await Authentication.verifyAccessToken(account)
  if (!accessToken) throw new Error('Epic authentication expired. Sign in again.')
  const response = await fetch(`https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=campaign&rvn=-1`, {
    method: 'POST', headers: { Authorization: `bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Could not load quest history (HTTP ${response.status}). Try Refresh.`)
  return parseQuestHistory(await response.json(), accountId)
}
