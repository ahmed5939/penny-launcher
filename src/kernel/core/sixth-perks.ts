import { AccountsManager } from '../startup/accounts'
import { PluginBridge } from '../startup/plugin-api'
import { RuntimeLog } from '../runtime-log'
import { Authentication } from './authentication'
import { parseItems } from '../../features/sixth-perks/parse'
import type { ProfileRead, SixthPerksScan } from '../../features/sixth-perks/types'

/**
 * 6th Perks — a read-only scan of inventory schematics and, when asked, the
 * Collection Book. The renderer names an account; the main process resolves
 * it, authenticates and returns only schematic ids, template ids, levels and
 * alterations. There is no mutation channel.
 *
 * The two profiles are read independently: one failed read never means
 * missing, it means unknown.
 */
export async function requestSixthPerks(accountId: string, includeBook = false): Promise<SixthPerksScan> {
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('Choose a valid Epic account.')
  if (typeof includeBook !== 'boolean') throw new Error('Invalid Collection Book setting.')
  // Penny also emits scope refreshes with the same primary during profile loading.
  // Latch genuine primary changes, including a switch away and back mid-request.
  let selectionChanged = false
  const unsubscribe = PluginBridge.on('native-sixth-perks', 'account-scope-changed', () => {
    if (PluginBridge.getAccountScope().primary !== accountId) selectionChanged = true
  })
  try {
    const check = () => {
      const scope = PluginBridge.getAccountScope()
      if (selectionChanged || scope.primary !== accountId || !AccountsManager.getAccountById(accountId)) throw new Error('Account selection changed. Scan again.')
    }
    check()
    const account = AccountsManager.getAccountById(accountId)!
    const accessToken = await Authentication.verifyAccessToken(account)
    check()
    if (!accessToken) throw new Error('Epic authentication expired. Sign in again.')
    const read = async (profileId: string): Promise<ProfileRead> => {
      try {
        check()
        const response = await fetch(`https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=${profileId}&rvn=-1`, {
          method: 'POST', headers: {Authorization: `bearer ${accessToken}`, 'Content-Type': 'application/json'}, body: '{}', signal: AbortSignal.timeout(30000),
        })
        if (!response.ok) throw new Error(`QueryProfile ${profileId} returned HTTP ${response.status}`)
        const body = await response.json()
        check()
        const profile = body.profileChanges?.find((c: {profile?: unknown}) => c.profile)?.profile
        if (!profile?.items || typeof profile.items !== 'object' || Array.isArray(profile.items) || profile.accountId !== accountId || profile.profileId !== profileId) throw new Error(`QueryProfile ${profileId} returned an incomplete profile`)
        return {status: 'success', items: parseItems(profile.items), error: null}
      } catch (error) {
        check()
        RuntimeLog.error('sixth-perks:read', error)
        return {status: 'error', items: [], error: 'Could not load this profile. Try Scan again.'}
      }
    }
    const [inventory, book] = await Promise.all([read('campaign'), includeBook ? read('collection_book_schematics0') : Promise.resolve<ProfileRead>({status: 'skipped', items: [], error: null})])
    check()
    return {accountId, fetchedAt: new Date().toISOString(), inventory, book}
  } finally { unsubscribe() }
}
