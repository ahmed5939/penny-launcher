import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import rulesData from '../../../rare-item-finder-assets/slot-rules.json'

const accountId = 'a'.repeat(32)
const accounts = new Map<string, { accountId: string }>([[accountId, { accountId }]])
const mocks = vi.hoisted(() => ({ verify: vi.fn(async () => 'test-only-token'), snapshot: vi.fn() }))
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => process.cwd() } }))
vi.mock('./authentication', () => ({ Authentication: { verifyAccessToken: mocks.verify } }))
vi.mock('./item-database', () => ({ ItemDatabase: { snapshot: mocks.snapshot } }))
vi.mock('../startup/accounts', () => ({ AccountsManager: { getAccounts: () => accounts } }))

import { loadSlotRules, requestRareItemScan } from './rare-item-finder'

const old = 'Alteration:aid_att_melee_critchance'
const fullProfile = (profileId: string, items: Record<string, unknown>, owner = accountId) => ({
  profileChanges: [{ changeType: 'fullProfileUpdate', profile: { profileId, accountId: owner, rvn: 7, items } }],
})
const itemsFor = (profileId: string) =>
  profileId === 'campaign' || profileId === 'collection_book_schematics0'
    ? { a: { templateId: 'Schematic:sid_assault_auto_sr_ore_t01', quantity: 1, attributes: { alterations: [old] } } }
    : { a: { templateId: 'Trap:tid_wall_launcher_sr_t01', attributes: { alterationDefinitions: [old] } } }
const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
type Fetcher = (url: string, init: RequestInit) => Promise<unknown>
const profileOf = (url: string) => new URL(url).searchParams.get('profileId')!

describe('rare item finder main-process scan', () => {
  beforeEach(() => {
    mocks.verify.mockClear()
    mocks.snapshot.mockResolvedValue({ total: 0, records: {}, ratings: {} })
    accounts.set(accountId, { accountId })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('loads the bundled slot rules from the extra-resource directory', async () => {
    const rules = await loadSlotRules()
    expect(Object.keys(rules.items).length).toBe(Object.keys((rulesData as { items: object }).items).length)
  })

  it('reuses parsed rules after strong-cache eviction while memory retains them', async () => {
    vi.useFakeTimers()
    try {
      const rules = await loadSlotRules()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(await loadSlotRules()).toBe(rules)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads all four profiles with the host token and returns token-free, classified results', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal('fetch', (async (url, init) => { calls.push({ url, init }); return ok(fullProfile(profileOf(url), itemsFor(profileOf(url)))) }) as Fetcher)
    const scan = await requestRareItemScan(accountId)
    expect(calls.map((c) => profileOf(c.url))).toEqual(['campaign', 'collection_book_schematics0', 'theater0', 'outpost0'])
    expect(calls.every((c) => c.url.includes(`/profile/${accountId}/client/QueryProfile?`) && c.url.includes('rvn=-1'))).toBe(true)
    expect(calls.every((c) => (c.init.headers as Record<string, string>).Authorization === 'bearer test-only-token')).toBe(true)
    expect(scan.counts.complete).toBe(true)
    expect(scan.counts.legacy).toBe(4)
    expect(scan.counts.eligible).toBe(1)
    expect(JSON.stringify(scan)).not.toContain('test-only-token')
  })

  it('a partial read failure keeps the other profiles and is not reported complete', async () => {
    vi.stubGlobal('fetch', (async (url) => {
      const id = profileOf(url)
      return id === 'theater0' ? ok({ errorCode: 'errors.com.epicgames.forbidden', errorMessage: 'secret' }, 403) : ok(fullProfile(id, itemsFor(id)))
    }) as Fetcher)
    const scan = await requestRareItemScan(accountId)
    const failed = scan.profiles.find((p) => p.sourceId === 'theater0')!
    expect(failed.status).toBe('error')
    expect(failed.error?.message).toBe('Epic refused access to this operation for this profile.')
    expect(JSON.stringify(scan)).not.toContain('secret')
    expect(scan.counts.legacy).toBe(3)
    expect(scan.counts.complete).toBe(false)
  })

  it('rejects mismatched accounts and delta-only responses instead of showing an empty inventory', async () => {
    vi.stubGlobal('fetch', (async (url) => {
      const id = profileOf(url)
      return id === 'campaign' ? ok(fullProfile(id, {}, 'b'.repeat(32))) : id === 'outpost0' ? ok({ profileChanges: [{ changeType: 'itemAttrChanged' }] }) : ok(fullProfile(id, itemsFor(id)))
    }) as Fetcher)
    const scan = await requestRareItemScan(accountId)
    expect(scan.profiles.find((p) => p.sourceId === 'campaign')?.error?.message).toMatch(/different account/)
    expect(scan.profiles.find((p) => p.sourceId === 'outpost0')?.error?.message).toMatch(/not a full inventory/)
    expect(scan.counts.complete).toBe(false)
  })

  it('never contacts Epic for an invalid or unlinked account', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(requestRareItemScan('not-an-id')).rejects.toThrow('valid Epic account')
    await expect(requestRareItemScan('c'.repeat(32))).rejects.toThrow('linked account')
    expect(fetcher).not.toHaveBeenCalled()
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('prefers live item-database records and falls back to the bundled snapshot', async () => {
    mocks.snapshot.mockResolvedValue({ total: 1, records: { 'schematic:sid_assault_auto_sr_ore_t01': { name: 'Live Name', rarity: 'Legendary', tier: 1, image: 'live.png', description: null } }, ratings: {} })
    vi.stubGlobal('fetch', (async (url) => ok(fullProfile(profileOf(url), itemsFor(profileOf(url))))) as Fetcher)
    const live = await requestRareItemScan(accountId)
    // Extracted rule names win where they exist; the record still supplies artwork.
    expect(live.profiles[0].items[0].image).toBe('live.png')
    mocks.snapshot.mockRejectedValue(new Error('offline'))
    const offline = await requestRareItemScan(accountId)
    expect(offline.profiles[0].items[0].name).toBeTruthy()
    expect(offline.counts.complete).toBe(true)
  })
})
