import { Authentication } from './authentication'
import { AccountsManager } from '../startup/accounts'
import { parseWorldProfile, validWorldTransfers, worldProfiles, type WorldInventoryLocation } from '../../features/world-inventory/model'
const profileUrl = (accountId: string, operation: string, profileId: string) => `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/${operation}?profileId=${profileId}&rvn=-1`
async function accessTokenFor(accountId: string) {
  const account = AccountsManager.getAccounts().get(accountId)
  if (!account) throw new Error('Select a linked account.')
  const accessToken = await Authentication.verifyAccessToken(account)
  if (!accessToken) throw new Error('Epic authentication expired. Sign in again.')
  return accessToken
}
export async function requestWorldInventory(accountId: string, location: WorldInventoryLocation) {
  if (location !== 'backpack' && location !== 'storage') throw new Error('Choose Backpack or Storage.')
  const accessToken = await accessTokenFor(accountId)
  const response = await fetch(profileUrl(accountId, 'QueryProfile', worldProfiles[location]), {
    method: 'POST', headers: { Authorization: `bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Could not load ${location} (HTTP ${response.status}). Try Refresh.`)
  return parseWorldProfile(await response.json(), accountId, location)
}
/** Moves stacks between the backpack and Storm Shield storage, the same call the game's storage screen makes. */
export async function transferWorldItems(accountId: string, transfers: unknown) {
  const operations = validWorldTransfers(transfers).map((t) => ({ ...t, newItemIdHint: '' }))
  const accessToken = await accessTokenFor(accountId)
  const response = await fetch(profileUrl(accountId, 'StorageTransfer', worldProfiles.backpack), {
    method: 'POST', headers: { Authorization: `bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ transferOperations: operations }), signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { errorMessage?: string } | null
    throw new Error(body?.errorMessage ? `Epic refused the transfer: ${body.errorMessage}` : `Could not move the items (HTTP ${response.status}). Refresh and try again.`)
  }
  return { moved: operations.length }
}
