import { Authentication } from './authentication'
import { AccountsManager } from '../startup/accounts'
import { parseWorldProfile, worldProfiles, type WorldInventoryLocation } from '../../features/world-inventory/model'
export async function requestWorldInventory(accountId: string, location: WorldInventoryLocation) {
  if (location !== 'backpack' && location !== 'storage') throw new Error('Choose Backpack or Storage.')
  const account = AccountsManager.getAccounts().get(accountId)
  if (!account) throw new Error('Select a linked account.')
  const accessToken = await Authentication.verifyAccessToken(account)
  if (!accessToken) throw new Error('Epic authentication expired. Sign in again.')
  const response = await fetch(`https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=${worldProfiles[location]}&rvn=-1`, {
    method: 'POST', headers: { Authorization: `bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Could not load ${location} (HTTP ${response.status}). Try Refresh.`)
  return parseWorldProfile(await response.json(), accountId, location)
}
