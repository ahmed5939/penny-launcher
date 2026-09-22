import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../kernel/core/authentication', () => ({ Authentication: { verifyAccessToken: vi.fn(async () => 'test-token') } }))
vi.mock('../../kernel/startup/accounts', () => ({ AccountsManager: { getAccounts: () => new Map([[accountId, { accountId }]]) } }))
import { requestCollectionBook } from '../../kernel/core/collection-book'
import { matchesSlot } from './match'
const accountId = 'a'.repeat(32)
const account = { accountId }
const item = { templateId: 'Worker:workerbasic_c_t02', attributes: { level: 20, portrait: 'WorkerPortrait:example', personality: 'Homebase.Worker.Personality.IsPragmatic', set_bonus: 'Homebase.Worker.SetBonus.IsTrapDurabilityHigh', secret: 'must-not-cross-ipc' } }
afterEach(() => vi.unstubAllGlobals())
describe('live collection book', () => {
  it('queries all three profiles and only returns required item fields', async () => {
    const fetcher = vi.fn(async (url: string) => {
      const profileId = new URL(url).searchParams.get('profileId')
      return { ok: true, json: async () => ({ profileChanges: [{profile: { accountId: account.accountId, profileId, items: profileId==='campaign'? {resource:{templateId:'AccountResource:peoplexp',quantity:123},copy:item}:profileId==='collection_book_people0'?{survivor:item}:{} }}] }) }
    })
    vi.stubGlobal('fetch', fetcher)
    const result = await requestCollectionBook(accountId)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(result.slotted).toHaveLength(1)
    expect(result.inventory).toHaveLength(1)
    expect(result.slotted[0].portrait).toBe('WorkerPortrait:example')
    expect(result.resources['accountresource:peoplexp']).toBe(123)
    expect(JSON.stringify(result)).not.toContain('must-not-cross-ipc')
    expect(fetcher.mock.calls.every(([url])=>url.includes('/QueryProfile?'))).toBe(true)
  })
  it('rejects incomplete profiles instead of presenting empty slots', async () => {
    vi.stubGlobal('fetch', async () => ({ok:true,json:async()=>({profileChanges:[]})}))
    await expect(requestCollectionBook(accountId)).rejects.toThrow('incomplete or mismatched')
  })
  it('rejects accounts that are not linked locally', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(requestCollectionBook('c'.repeat(32))).rejects.toThrow('linked account')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects profiles for another account', async () => {
    vi.stubGlobal('fetch', async () => ({ok:true,json:async()=>({profileChanges:[{profile:{accountId:'b'.repeat(32),items:{}}}]})}))
    await expect(requestCollectionBook(accountId)).rejects.toThrow('mismatched')
  })
  it('matches survivor slots using personality as well as template', () => {
    const i={id:'copy',templateId:item.templateId,level:20,portrait:null,personality:item.attributes.personality,teamBonus:null,alterations:[]}
    const s={id:'slot',name:'Survivor',rarity:'Common',allowed:['workerbasic_c_t02'],personalities:['homebase.worker.personality.ispragmatic'],templateId:item.templateId}
    expect(matchesSlot(i,s)).toBe(true)
    expect(matchesSlot({...i,personality:'Homebase.Worker.Personality.IsCooperative'},s)).toBe(false)
  })
})
