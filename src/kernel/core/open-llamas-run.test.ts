import type { Items } from '../../features/expeditions/model'
import type { OpenLlamasProgress, RecycleChoice } from '../../features/open-llamas/model'

import { describe, expect, it } from 'vitest'

import { buildPreview } from '../../features/open-llamas/model'
import { RECYCLE_BATCH_SIZE, runOpenLlamas, type OpenLlamasClient } from './open-llamas-run'

const accountId = 'a'.repeat(32)
const HOLIDAY = 'CardPack:cardpack_event_holiday'
const MINI = 'CardPack:cardpack_basic_mini'
const UPGRADE = 'CardPack:cardpack_bronze'

function packs(templateId: string, count: number, prefix: string, quantity = 1): Items {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}-${String(i).padStart(4, '0')}`, { templateId, quantity }]))
}

const clone = (items: Items): Items => JSON.parse(JSON.stringify(items))

type Loot = { templateId: string; quantity?: number; attributes?: Record<string, unknown> }

/**
 * A campaign profile behind a fake `OpenCardPackBatch` / `RecycleItemBatch`.
 * Every request body is kept so tests can read exactly what was submitted.
 */
class FakeEpic implements OpenLlamasClient {
  items: Items
  openRequests: Array<{ cardPackItemIds: Array<string> }> = []
  recycleRequests: Array<{ targetItemIds: Array<string> }> = []
  queries = 0
  private nextId = 0

  /** What one pack drops. */
  loot: (templateId: string) => Array<Loot> = () => [{ templateId: 'Worker:workerbasic_c_t01' }, { templateId: 'AccountResource:heroxp', quantity: 250 }]
  /** Packs one GUID gives up per request: the whole stack by default. */
  perRequest: (quantity: number) => number = (quantity) => quantity
  /** Runs before each read; tests change the inventory here. */
  onQuery: (query: number, epic: FakeEpic) => void = () => undefined
  /** Throw from a request, after (or instead of) applying it. */
  openFailure: (request: number) => { apply: boolean; error: unknown } | null = () => null
  recycleFailure: (request: number) => { apply: boolean; error: unknown } | null = () => null
  queryFailure: (query: number) => boolean = () => false
  replyWithoutLoot = false

  constructor(items: Items) {
    this.items = clone(items)
  }

  async queryProfile() {
    this.queries += 1
    this.onQuery(this.queries, this)
    if (this.queryFailure(this.queries)) throw new Error('network')
    return clone(this.items)
  }

  async openCardPacks(cardPackItemIds: Array<string>) {
    this.openRequests.push({ cardPackItemIds: [...cardPackItemIds] })
    const failure = this.openFailure(this.openRequests.length)
    if (failure && !failure.apply) throw failure.error

    const notifications: Array<unknown> = []
    for (const itemId of cardPackItemIds) {
      const pack = this.items[itemId]
      if (!pack?.templateId.startsWith('CardPack:')) throw Object.assign(new Error('not a pack'), { response: { status: 400, data: { errorCode: 'errors.com.epicgames.fortnite.item_not_found' } } })
      const opened = this.perRequest(pack.quantity ?? 1)
      pack.quantity = (pack.quantity ?? 1) - opened
      if (pack.quantity <= 0) delete this.items[itemId]
      for (let n = 0; n < opened; n++) {
        const items = this.loot(pack.templateId).map((drop) => {
          const isResource = drop.templateId.startsWith('AccountResource:')
          const itemGuid = isResource ? Object.keys(this.items).find((id) => this.items[id].templateId === drop.templateId) ?? `res-${drop.templateId}` : `reward-${this.nextId++}`
          const existing = this.items[itemGuid]
          this.items[itemGuid] = { templateId: drop.templateId, quantity: (isResource && existing ? existing.quantity ?? 0 : 0) + (drop.quantity ?? 1), attributes: drop.attributes }
          return { itemType: drop.templateId, itemGuid, itemProfile: 'campaign', quantity: drop.quantity ?? 1 }
        })
        notifications.push({ type: 'cardPackResult', primary: true, lootGranted: { tierGroupName: '', items } })
      }
    }

    if (failure) throw failure.error
    return { profileId: 'campaign', profileChanges: [], notifications: this.replyWithoutLoot ? [] : notifications }
  }

  async recycleItems(targetItemIds: Array<string>) {
    this.recycleRequests.push({ targetItemIds: [...targetItemIds] })
    const failure = this.recycleFailure(this.recycleRequests.length)
    if (failure && !failure.apply) throw failure.error
    targetItemIds.forEach((itemId) => delete this.items[itemId])
    if (failure) throw failure.error
    return { profileChanges: [{ changeType: 'fullProfileUpdate' }] }
  }

  submitted() {
    return this.openRequests.flatMap((request) => request.cardPackItemIds)
  }
}

const networkError = () => Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })
const refusal = (status = 400) => Object.assign(new Error('refused'), { response: { status, data: { errorMessage: 'Operation not allowed' } } })

async function run(
  items: Items,
  epic: FakeEpic,
  request: { templateIds?: unknown; count?: number | null; recycle?: RecycleChoice },
  options: { catalogRarity?: (templateId: string) => string | null; isCancelled?: () => boolean } = {}
) {
  const preview = buildPreview(accountId, 'preview', items)
  const updates: Array<OpenLlamasProgress> = []
  const result = await runOpenLlamas({
    preview,
    request: { accountId, previewId: 'preview', count: null, recycle: 'none', ...request },
    client: epic,
    onProgress: (progress) => updates.push(progress),
    ...options,
  })
  return { result, updates }
}

describe('Open Llamas run: the exclusion invariant', () => {
  it('never submits an excluded Mini Llama across a multi-batch run', async () => {
    const items = { ...packs(HOLIDAY, 60, 'holiday'), ...packs(MINI, 1000, 'mini') }
    const epic = new FakeEpic(items)
    const { result } = await run(items, epic, { templateIds: [HOLIDAY] })

    expect(result).toMatchObject({ status: 'done', target: 60, opened: 60, packsLeft: 1000 })
    expect(epic.openRequests.map((request) => request.cardPackItemIds.length)).toEqual([25, 25, 10])
    const miniIds = new Set(Object.keys(packs(MINI, 1000, 'mini')))
    for (const request of epic.openRequests) {
      expect(Object.keys(request)).toEqual(['cardPackItemIds'])
      expect(request.cardPackItemIds.filter((id) => miniIds.has(id))).toEqual([])
    }
    expect(new Set(epic.submitted()).size).toBe(60)
    for (const id of miniIds) expect(epic.items[id]).toEqual({ templateId: MINI, quantity: 1 })
  })

  it('opens only the one included type and leaves every other untouched', async () => {
    const items = { ...packs(HOLIDAY, 3, 'holiday'), ...packs(MINI, 4, 'mini'), ...packs(UPGRADE, 2, 'upgrade') }
    const epic = new FakeEpic(items)
    const { result } = await run(items, epic, { templateIds: [UPGRADE] })

    expect(result).toMatchObject({ status: 'done', opened: 2 })
    expect(epic.submitted().sort()).toEqual(['upgrade-0000', 'upgrade-0001'])
    for (const [id, item] of Object.entries(items)) {
      if (item.templateId !== UPGRADE) expect(epic.items[id]).toEqual(item)
    }
  })

  it.each([
    ['an empty selection', { templateIds: [] }],
    ['no selection at all', { templateIds: undefined }],
    ['an unknown type', { templateIds: ['CardPack:never_owned'] }],
    ['a known type alongside an unknown one', { templateIds: [HOLIDAY, 'CardPack:never_owned'] }],
  ])('rejects %s without opening anything or falling back to all types', async (_, request) => {
    const items = { ...packs(HOLIDAY, 3, 'holiday'), ...packs(MINI, 3, 'mini') }
    const epic = new FakeEpic(items)
    const { result, updates } = await run(items, epic, request)

    expect(result.status).toBe('failed')
    expect(result.message).toBeTruthy()
    expect(epic.openRequests).toEqual([])
    expect(epic.queries).toBe(0)
    expect(updates.at(-1)?.status).toBe('failed')
  })
})

describe('Open Llamas run: the number to open', () => {
  it('opens every included pack when blank, and exactly the number otherwise', async () => {
    const items = { ...packs(HOLIDAY, 30, 'holiday'), ...packs(MINI, 30, 'mini') }
    const all = new FakeEpic(items)
    expect((await run(items, all, { templateIds: [HOLIDAY, MINI] })).result.opened).toBe(60)

    const some = new FakeEpic(items)
    const { result } = await run(items, some, { templateIds: [HOLIDAY], count: 27 })
    expect(result).toMatchObject({ status: 'done', target: 27, opened: 27 })
    // Stable order: the first 27 Holiday GUIDs.
    expect(some.submitted()).toEqual(Object.keys(packs(HOLIDAY, 27, 'holiday')))
  })

  it('rejects a number above the included pool instead of adding excluded types', async () => {
    const items = { ...packs(HOLIDAY, 10, 'holiday'), ...packs(MINI, 100, 'mini') }
    const epic = new FakeEpic(items)
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], count: 11 })

    expect(result.status).toBe('failed')
    expect(epic.openRequests).toEqual([])
  })

  it('never lets a stack carry the run past the number, even if Epic opens one pack per request', async () => {
    const items = { a: { templateId: HOLIDAY, quantity: 3 }, b: { templateId: HOLIDAY, quantity: 5 }, c: { templateId: HOLIDAY, quantity: 1 } }
    const epic = new FakeEpic(items)
    epic.perRequest = () => 1
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], count: 4 })

    expect(result).toMatchObject({ status: 'done', opened: 4 })
    expect(epic.items.b).toEqual({ templateId: HOLIDAY, quantity: 5 })
    expect(epic.submitted().every((id) => id === 'a' || id === 'c')).toBe(true)
  })
})

describe('Open Llamas run: inventory that changed', () => {
  it.each([
    ['disappeared', (epic: FakeEpic) => delete epic.items['holiday-0001']],
    ['changed type', (epic: FakeEpic) => (epic.items['holiday-0001'].templateId = MINI)],
    ['changed quantity', (epic: FakeEpic) => (epic.items['holiday-0001'].quantity = 2)],
  ])('stops before opening when a selected GUID %s since the preview', async (_, change) => {
    const items = packs(HOLIDAY, 5, 'holiday')
    const epic = new FakeEpic(items)
    epic.onQuery = (query, fake) => {
      if (query === 1) change(fake)
    }
    const { result } = await run(items, epic, { templateIds: [HOLIDAY] })

    expect(result.status).toBe('stopped')
    expect(epic.openRequests).toEqual([])
  })

  it('ignores excluded-pack changes and never opens packs acquired after the preview', async () => {
    const items = { ...packs(HOLIDAY, 30, 'holiday'), ...packs(MINI, 5, 'mini') }
    const epic = new FakeEpic(items)
    epic.onQuery = (query, fake) => {
      if (query === 1) {
        delete fake.items['mini-0000']
        fake.items['late-holiday'] = { templateId: HOLIDAY, quantity: 1 }
        fake.items['late-mini'] = { templateId: MINI, quantity: 1 }
      }
    }
    const { result } = await run(items, epic, { templateIds: [HOLIDAY] })

    expect(result).toMatchObject({ status: 'done', opened: 30 })
    expect(epic.submitted()).not.toContain('late-holiday')
    expect(epic.items['late-holiday']).toBeDefined()
  })

  it('stops before submitting a GUID whose type changed between batches', async () => {
    const items = packs(HOLIDAY, 40, 'holiday')
    const epic = new FakeEpic(items)
    // Read 1 is the refresh, read 2 follows the first opening request.
    epic.onQuery = (query, fake) => {
      if (query === 2) fake.items['holiday-0030'].templateId = MINI
    }
    const { result } = await run(items, epic, { templateIds: [HOLIDAY] })

    expect(result).toMatchObject({ status: 'stopped', opened: 25 })
    expect(epic.openRequests).toHaveLength(1)
    expect(epic.submitted()).not.toContain('holiday-0030')
  })
})

describe('Open Llamas run: recycling', () => {
  const rarities = [['c', 'Common'], ['uc', 'Uncommon'], ['r', 'Rare'], ['vr', 'Epic'], ['sr', 'Legendary'], ['ur', 'Mythic']] as const
  const catalogRarity = (templateId: string) => rarities.find(([token]) => templateId.includes(`_${token}_`))?.[1] ?? null

  it.each([
    ['none', 0],
    ['below-uncommon', 1],
    ['below-rare', 2],
    ['below-epic', 3],
    ['below-legendary', 4],
    ['below-mythic', 5],
  ] as const)('%s recycles the %i lowest rarities and never Mythic', async (recycle, recycledPerPack) => {
    const items = packs(HOLIDAY, 2, 'holiday')
    const epic = new FakeEpic(items)
    epic.loot = () => [...rarities.map(([token]) => ({ templateId: `Hero:hid_commando_x_${token}_t01` })), { templateId: 'AccountResource:heroxp', quantity: 1000 }]
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], recycle }, { catalogRarity })

    expect(result).toMatchObject({ status: 'done', opened: 2, recycled: recycledPerPack * 2, kept: (6 - recycledPerPack) * 2 })
    const recycledIds = epic.recycleRequests.flatMap((request) => request.targetItemIds)
    expect(recycledIds).toHaveLength(recycledPerPack * 2)
    for (const request of epic.recycleRequests) expect(Object.keys(request)).toEqual(['targetItemIds'])
    expect(Object.values(epic.items).filter((item) => item.templateId.includes('_ur_'))).toHaveLength(2)
    if (recycle === 'none') expect(epic.recycleRequests).toEqual([])
  })

  it('keeps Legendary rewards when the item database cannot confirm them', async () => {
    const items = packs(HOLIDAY, 1, 'holiday')
    const epic = new FakeEpic(items)
    epic.loot = () => [{ templateId: 'Hero:hid_x_sr_t01' }, { templateId: 'Hero:hid_y_sr_t01' }]
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], recycle: 'below-mythic' }, { catalogRarity: (id) => (id.includes('hid_y') ? 'Mythic' : null) })

    expect(result).toMatchObject({ recycled: 0, kept: 2 })
    expect(epic.recycleRequests).toEqual([])
  })

  it('never recycles pre-existing, favourited, assigned, quest, unknown or unsupported rewards', async () => {
    const items: Items = { ...packs(HOLIDAY, 1, 'holiday'), 'reward-0': { templateId: 'Worker:workerbasic_c_t01', quantity: 1 } }
    const epic = new FakeEpic(items)
    epic.loot = () => [
      { templateId: 'Worker:workerbasic_c_t01' },
      { templateId: 'Worker:workerbasic_c_t01', attributes: { favorite: true } },
      { templateId: 'Worker:workerbasic_c_t01', attributes: { squad_id: 'squad_attribute_medicine_emtsquad', squad_slot_idx: 2 } },
      { templateId: 'Worker:managerquestdoctor_c_t01' },
      { templateId: 'Worker:workerbasic_t01' },
      { templateId: 'Weapon:wid_sniper_c_t01' },
      { templateId: 'AccountResource:heroxp', quantity: 500 },
    ]
    // The first reward reuses `reward-0`, a GUID that existed before the run.
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], recycle: 'below-epic' })

    expect(epic.recycleRequests).toEqual([])
    expect(result).toMatchObject({ status: 'done', recycled: 0, kept: 6 })
  })

  it('recycles in batches of at most 100 GUIDs, each confirmed by the inventory', async () => {
    const items = packs(HOLIDAY, 60, 'holiday')
    const epic = new FakeEpic(items)
    epic.loot = () => Array.from({ length: 6 }, () => ({ templateId: 'Worker:workerbasic_c_t01' }))
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], recycle: 'below-uncommon' })

    expect(result).toMatchObject({ status: 'done', opened: 60, recycled: 360, kept: 0 })
    expect(Math.max(...epic.recycleRequests.map((request) => request.targetItemIds.length))).toBeLessThanOrEqual(RECYCLE_BATCH_SIZE)
  })
})

describe('Open Llamas run: failures', () => {
  it('keeps confirmed totals and flags an ambiguous opening request without retrying it', async () => {
    const items = packs(HOLIDAY, 60, 'holiday')
    const epic = new FakeEpic(items)
    epic.openFailure = (request) => (request === 2 ? { apply: true, error: networkError() } : null)
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], recycle: 'below-uncommon' })

    expect(epic.openRequests).toHaveLength(2)
    expect(result).toMatchObject({ status: 'stopped', opened: 50, recycled: 25 })
    expect(result.uncertain).toMatch(/25 packs/)
    expect(result.message).toMatch(/No automatic retry/)
  })

  it('reports a refused request plainly, with nothing uncertain', async () => {
    const items = packs(HOLIDAY, 60, 'holiday')
    const epic = new FakeEpic(items)
    epic.openFailure = (request) => (request === 2 ? { apply: false, error: refusal(429) } : null)
    const { result } = await run(items, epic, { templateIds: [HOLIDAY] })

    expect(result).toMatchObject({ status: 'stopped', opened: 25, uncertain: null })
    expect(result.message).toMatch(/rate-limiting/)
  })

  it('says what may have happened when neither the request nor the check answered', async () => {
    const items = packs(HOLIDAY, 30, 'holiday')
    const epic = new FakeEpic(items)
    epic.openFailure = () => ({ apply: true, error: networkError() })
    epic.queryFailure = (query) => query > 1
    const { result } = await run(items, epic, { templateIds: [HOLIDAY] })

    expect(result).toMatchObject({ status: 'stopped', opened: 0 })
    expect(result.uncertain).toMatch(/may have gone through/)
  })

  it('does not count packs it could not confirm after an accepted request', async () => {
    const items = packs(HOLIDAY, 10, 'holiday')
    const epic = new FakeEpic(items)
    epic.queryFailure = (query) => query === 2
    const { result } = await run(items, epic, { templateIds: [HOLIDAY] })

    expect(result).toMatchObject({ status: 'stopped', opened: 0 })
    expect(result.uncertain).toMatch(/probably opened/)
  })

  it('separates uncertain recycling from both totals', async () => {
    const items = packs(HOLIDAY, 2, 'holiday')
    const epic = new FakeEpic(items)
    epic.loot = () => [{ templateId: 'Worker:workerbasic_c_t01' }, { templateId: 'Worker:workerbasic_r_t01' }]
    epic.recycleFailure = () => ({ apply: true, error: networkError() })
    epic.queryFailure = (query) => query === 3
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], recycle: 'below-uncommon' })

    expect(epic.recycleRequests).toHaveLength(1)
    expect(result).toMatchObject({ status: 'stopped', opened: 2, recycled: 0, kept: 2 })
    expect(result.uncertain).toMatch(/2 items/)
  })

  it('stops rather than guess when Epic does not list the rewards', async () => {
    const items = packs(HOLIDAY, 5, 'holiday')
    const epic = new FakeEpic(items)
    epic.replyWithoutLoot = true
    const { result } = await run(items, epic, { templateIds: [HOLIDAY], recycle: 'below-epic' })

    expect(result).toMatchObject({ status: 'stopped', opened: 5, recycled: 0, kept: 0 })
    expect(epic.recycleRequests).toEqual([])
  })

  it('cancels between requests and counts the request already made', async () => {
    const items = packs(HOLIDAY, 100, 'holiday')
    const epic = new FakeEpic(items)
    const { result } = await run(items, epic, { templateIds: [HOLIDAY] }, { isCancelled: () => epic.openRequests.length >= 1 })

    expect(result).toMatchObject({ status: 'cancelled', opened: 25 })
    expect(epic.openRequests).toHaveLength(1)
  })
})

describe('Open Llamas run: progress', () => {
  it('reports compact totals once per batch, however many packs there are', async () => {
    const items = { ...packs(HOLIDAY, 2000, 'holiday'), ...packs(MINI, 450, 'mini') }
    const epic = new FakeEpic(items)
    const { result, updates } = await run(items, epic, { templateIds: [HOLIDAY], recycle: 'below-uncommon' })

    expect(result).toMatchObject({ status: 'done', opened: 2000, recycled: 2000, kept: 0, packsLeft: 450 })
    expect(updates.length).toBeLessThanOrEqual(2000 / 25 + 2)
    const keys = Object.keys(result).sort()
    for (const update of updates) {
      expect(Object.keys(update).sort()).toEqual(keys)
      expect(JSON.stringify(update).length).toBeLessThan(600)
    }
    expect(updates.at(-1)).toEqual(result)
  })
})
