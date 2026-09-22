import type { BookItem, CollectionBookData } from '../../features/collection-book/types'
import { Authentication } from './authentication'
import { AccountsManager } from '../startup/accounts'

type RawItem = { templateId: string; quantity?: number; attributes?: Record<string, unknown> }
export function bookItems(items: Record<string, RawItem>): BookItem[] {
  return Object.entries(items).filter(([, item]) => /^(Hero|Worker|Defender|Schematic):/i.test(item.templateId)).map(([id, item]) => {
    const a = item.attributes ?? {}
    const text = (key: string) => typeof a[key] === 'string' ? a[key] as string : null
    return { id, templateId: item.templateId, level: typeof a.level === 'number' ? a.level : 1,
      portrait: text('portrait'), personality: text('personality'), teamBonus: text('set_bonus'),
      alterations: Array.isArray(a.alterations) ? a.alterations.filter((v): v is string => typeof v === 'string' && !!v) : [] }
  })
}
// The renderer only names the account; the main process resolves the linked
// record so tokens never travel over IPC.
export async function requestCollectionBook(accountId: string): Promise<CollectionBookData> {
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('Choose a valid Epic account.')
  const account = AccountsManager.getAccounts().get(accountId)
  if (!account) throw new Error('Select a linked account.')
  const accessToken = await Authentication.verifyAccessToken(account)
  if (!accessToken) throw new Error('Epic authentication expired. Sign in again.')
  const profiles = await Promise.all(['campaign', 'collection_book_people0', 'collection_book_schematics0'].map(async profileId => {
    const response = await fetch(`https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=${profileId}&rvn=-1`, {
      method: 'POST', headers: { Authorization: `bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error(`Epic could not load ${profileId} (HTTP ${response.status}). Try Refresh.`)
    const body = await response.json() as { profileChanges?: { profile?: { accountId?: string; profileId?: string; items: Record<string, RawItem>; stats?: { attributes?: { collection_book?: { maxBookXpLevelAchieved?: number } } } } }[] }
    const profile = body.profileChanges?.find(change => change.profile)?.profile
    if (!profile?.items || (profile.accountId && profile.accountId !== accountId) || (profile.profileId && profile.profileId !== profileId)) throw new Error('Epic returned an incomplete or mismatched profile. Try Refresh.')
    return profile
  }))
  const resources: Record<string, number> = {}
  for (const item of Object.values(profiles[0].items)) {
    if (/^(AccountResource|Ingredient):/i.test(item.templateId)) resources[item.templateId.toLowerCase()] = (resources[item.templateId.toLowerCase()] ?? 0) + (item.quantity ?? 0)
  }
  return { accountId, fetchedAt: new Date().toISOString(), slotted: [...bookItems(profiles[1].items), ...bookItems(profiles[2].items)], inventory: bookItems(profiles[0].items), resources,
    highestLevel: profiles[0].stats?.attributes?.collection_book?.maxBookXpLevelAchieved ?? null }
}
