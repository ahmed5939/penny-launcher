import type { Items } from '../expeditions/model'

import { describe, expect, it } from 'vitest'

import {
  buildPreview,
  freezeRun,
  includedTypeIds,
  openedRewards,
  openingRecycleTargets,
  parseOpenCount,
  planOpening,
  readPackStacks,
  recycleChoices,
  recycleRarityRank,
  selectedPackCount,
  templateRarityRank,
} from './model'

const accountId = 'a'.repeat(32)
const HOLIDAY = 'CardPack:cardpack_event_holiday'
const MINI = 'CardPack:cardpack_basic_mini'
const UPGRADE = 'CardPack:cardpack_bronze'

function packs(templateId: string, count: number, prefix: string, quantity = 1): Items {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}-${String(i).padStart(4, '0')}`, { templateId, quantity }]))
}

describe('pack inventory', () => {
  it('reads only CardPack items, counting quantities rather than GUIDs', () => {
    const items: Items = {
      ...packs(HOLIDAY, 2, 'h', 3),
      voucher: { templateId: 'AccountResource:voucher_cardpack_bronze', quantity: 9 },
      ticket: { templateId: 'AccountResource:currency_xrayllama', quantity: 500 },
      hero: { templateId: 'Hero:hid_commando_007_r_t01', quantity: 1 },
      empty: { templateId: MINI, quantity: 0 },
    }
    const preview = buildPreview(accountId, 'p', items)

    expect(preview.total).toBe(6)
    expect(preview.types).toEqual([{ templateId: HOLIDAY, quantity: 6, openable: 6, stacks: 2 }])
  })

  it('keeps choice packs out of the openable stacks', () => {
    const preview = buildPreview(accountId, 'p', {
      choice: { templateId: 'CardPack:cardpack_choice_hero_r', quantity: 1 },
      options: { templateId: UPGRADE, quantity: 1, attributes: { options: [{ itemType: 'Hero:x' }] } },
      plain: { templateId: UPGRADE, quantity: 1 },
    })

    expect(preview.total).toBe(3)
    expect(preview.stacks.map((stack) => stack.itemId)).toEqual(['plain'])
    expect(preview.types.find((type) => type.templateId === 'CardPack:cardpack_choice_hero_r')?.openable).toBe(0)
    expect(preview.types.find((type) => type.templateId === UPGRADE)).toMatchObject({ quantity: 2, openable: 1 })
  })

  it('orders stacks by template id, then GUID, independent of insertion order', () => {
    const stacks = readPackStacks({ z: { templateId: MINI }, b: { templateId: HOLIDAY }, a: { templateId: HOLIDAY } })
    // `cardpack_basic_mini` sorts before `cardpack_event_holiday`.
    expect(stacks.map((stack) => stack.itemId)).toEqual(['z', 'a', 'b'])
  })
})

describe('selection and planning', () => {
  const preview = buildPreview(accountId, 'p', { ...packs(HOLIDAY, 60, 'h'), ...packs(MINI, 1000, 'm'), ...packs(UPGRADE, 5, 'u') })

  it('includes everything by default and excludes by exact template id', () => {
    expect(includedTypeIds(preview, new Set())).toHaveLength(3)
    const included = new Set(includedTypeIds(preview, new Set([MINI])))
    expect([...included]).toEqual([UPGRADE, HOLIDAY].sort())
    expect(selectedPackCount(preview, included)).toBe(65)
  })

  it('validates the number to open against the selected packs only', () => {
    expect(parseOpenCount('', 65)).toEqual({ ok: true, value: null })
    expect(parseOpenCount(' 30 ', 65)).toEqual({ ok: true, value: 30 })
    for (const bad of ['0', '-3', '1.5', '1e3', 'abc', '+4', '66', '99999999999999999999']) {
      expect(parseOpenCount(bad, 65).ok).toBe(false)
    }
    expect(parseOpenCount('', 0)).toMatchObject({ ok: false })
  })

  it('plans in stable order and never splits or overshoots a stack', () => {
    const stacks = readPackStacks({ s5: { templateId: HOLIDAY, quantity: 5 }, s1: { templateId: HOLIDAY, quantity: 1 }, m1: { templateId: MINI, quantity: 1 } })
    expect(planOpening(stacks, null)).toMatchObject({ target: 7, total: 7 })
    const three = planOpening(stacks, 3)
    expect(three.stacks.map((stack) => stack.itemId)).toEqual(['m1', 's1'])
    expect(three.total).toBe(2)
    expect(planOpening(stacks, 7).perType).toEqual({ [MINI]: 1, [HOLIDAY]: 6 })
    // In order: m1, s1, then s5 would overshoot 6 — skipped, not split.
    expect(planOpening(stacks, 6)).toMatchObject({ target: 6, total: 2 })
  })
})

describe('freezeRun', () => {
  const preview = buildPreview(accountId, 'p', { ...packs(HOLIDAY, 60, 'h'), ...packs(MINI, 1000, 'm'), choice: { templateId: 'CardPack:cardpack_choice_all_r' } })
  const request = { accountId, previewId: 'p', templateIds: [HOLIDAY], count: null, recycle: 'none' }

  it('freezes only included GUIDs', () => {
    const result = freezeRun(preview, request)
    if (!result.ok) throw new Error(result.error)
    expect(result.run.pool).toHaveLength(60)
    expect(result.run.pool.every((stack) => stack.templateId === HOLIDAY)).toBe(true)
    expect(Object.isFrozen(result.run.pool)).toBe(true)
    expect(result.run.plan.target).toBe(60)
  })

  it.each([
    ['empty selection', { templateIds: [] }],
    ['missing selection', { templateIds: undefined }],
    ['unknown type', { templateIds: ['CardPack:not_owned'] }],
    ['choice-only type', { templateIds: ['CardPack:cardpack_choice_all_r'] }],
    ['duplicate type', { templateIds: [HOLIDAY, HOLIDAY] }],
    ['non-string type', { templateIds: [42] }],
    ['zero', { count: 0 }],
    ['fraction', { count: 1.5 }],
    ['above the included pool', { count: 61 }],
    ['unknown recycle choice', { recycle: 'everything' }],
    ['another account', { accountId: 'b'.repeat(32) }],
    ['stale preview', { previewId: 'old' }],
  ])('rejects %s without falling back to all types', (_, patch) => {
    expect(freezeRun(preview, { ...request, ...patch }).ok).toBe(false)
  })

  it('refuses a number only a split stack could meet', () => {
    const stacked = buildPreview(accountId, 'p', { s: { templateId: HOLIDAY, quantity: 5 } })
    expect(freezeRun(stacked, { ...request, count: 3 })).toMatchObject({ ok: false })
  })
})

describe('rarity', () => {
  it('reads one rarity token and refuses ambiguous ids', () => {
    expect(templateRarityRank('Worker:workerbasic_c_t01')).toBe(1)
    expect(templateRarityRank('Schematic:sid_assault_auto_vr_ore_t01')).toBe(4)
    expect(templateRarityRank('Hero:hid_commando_033_halloweenquestsoldier_sr_t01')).toBe(5)
    expect(templateRarityRank('Schematic:sid_c_thing_r_t01')).toBeNull()
    expect(templateRarityRank('Defender:did_defender_t01')).toBeNull()
  })

  it('needs the database to confirm Legendary, and any disagreement keeps the item', () => {
    expect(recycleRarityRank('Hero:hid_x_sr_t01')).toBeNull()
    expect(recycleRarityRank('Hero:hid_x_sr_t01', 'Legendary')).toBe(5)
    expect(recycleRarityRank('Hero:hid_x_sr_t01', 'Mythic')).toBeNull()
    expect(recycleRarityRank('Worker:managerdoctor_vr_t01', 'Legendary')).toBeNull()
    expect(recycleRarityRank('Worker:workerbasic_r_t01')).toBe(3)
    expect(recycleRarityRank('Hero:hid_x_ur_t01', 'Mythic')).toBe(6)
  })

  it('labels the six choices exactly', () => {
    expect(recycleChoices.map((choice) => choice.label)).toEqual(['No Auto Recycle', 'Below Uncommon', 'Below Rare', 'Below Epic', 'Below Legendary', 'Below Mythic'])
  })
})

describe('openingRecycleTargets', () => {
  const rarities = [['c', 'Common'], ['uc', 'Uncommon'], ['r', 'Rare'], ['vr', 'Epic'], ['sr', 'Legendary'], ['ur', 'Mythic']] as const
  const after: Items = Object.fromEntries(rarities.map(([token]) => [`new-${token}`, { templateId: `Worker:workerbasic_${token}_t01`, quantity: 1 }]))
  const rewards = rarities.map(([token]) => ({ templateId: `Worker:workerbasic_${token}_t01`, quantity: 1, itemId: `new-${token}` }))
  const catalog = (templateId: string) => rarities.find(([token]) => templateId.includes(`_${token}_`))?.[1]

  it.each([
    ['none', []],
    ['below-uncommon', ['c']],
    ['below-rare', ['c', 'uc']],
    ['below-epic', ['c', 'uc', 'r']],
    ['below-legendary', ['c', 'uc', 'r', 'vr']],
    ['below-mythic', ['c', 'uc', 'r', 'vr', 'sr']],
  ] as const)('%s recycles exactly %j', (choice, expected) => {
    const targets = openingRecycleTargets(rewards, { after, before: {}, catalogRarity: catalog, choice, preRun: new Set() })
    expect(targets.map((target) => target.itemId)).toEqual(expected.map((token) => `new-${token}`))
  })

  it('keeps everything that is old, protected, unknown or out of scope', () => {
    const base = { templateId: 'Worker:workerbasic_c_t01', quantity: 1 }
    const items: Items = {
      old: base,
      runOld: base,
      fav: { ...base, attributes: { favorite: true } },
      squad: { ...base, attributes: { squad_id: 'squad_attribute_medicine_emtsquad', squad_slot_idx: 1 } },
      crew: { ...base },
      loadout: { templateId: 'CampaignHeroLoadout:defaultloadout', attributes: { crew_members: { commanderslot: 'crew' } } },
      quest: { templateId: 'Worker:managerquestdoctor_c_t01', quantity: 1 },
      unknown: { templateId: 'Worker:workerbasic_t01', quantity: 1 },
      resource: { templateId: 'AccountResource:heroxp', quantity: 500 },
      weapon: { templateId: 'Weapon:wid_sniper_c_t01', quantity: 1 },
      stacked: { ...base, quantity: 2 },
    }
    const candidates = [
      { ...base, itemId: 'old' },
      { ...base, itemId: 'runOld' },
      { ...base, itemId: 'fav' },
      { ...base, itemId: 'squad' },
      { ...base, itemId: 'crew' },
      { templateId: 'Worker:managerquestdoctor_c_t01', quantity: 1, itemId: 'quest' },
      { templateId: 'Worker:workerbasic_t01', quantity: 1, itemId: 'unknown' },
      { templateId: 'AccountResource:heroxp', quantity: 500, itemId: 'resource' },
      { templateId: 'Weapon:wid_sniper_c_t01', quantity: 1, itemId: 'weapon' },
      { ...base, itemId: 'stacked' },
      { ...base, itemId: 'missing' },
      { ...base },
    ]
    const targets = openingRecycleTargets(candidates, { after: items, before: { old: base }, choice: 'below-mythic', preRun: new Set(['runOld']) })
    expect(targets).toEqual([])
  })
})

describe('openedRewards', () => {
  it('reads loot notifications and de-duplicates GUIDs', () => {
    const body = {
      notifications: [
        { type: 'cardPackResult', lootGranted: { items: [{ itemType: 'Worker:workerbasic_c_t01', itemGuid: 'w1', quantity: 1 }, { itemType: 'AccountResource:heroxp', quantity: 100 }] } },
        { type: 'cardPackResult', lootGranted: { items: [{ itemType: 'Worker:workerbasic_c_t01', itemGuid: 'w1', quantity: 1 }] } },
      ],
    }
    expect(openedRewards(body)).toEqual([
      { templateId: 'Worker:workerbasic_c_t01', quantity: 1, itemId: 'w1' },
      { templateId: 'AccountResource:heroxp', quantity: 100 },
    ])
  })

  it('falls back to items the reply says were added', () => {
    expect(openedRewards({ profileChanges: [{ changeType: 'itemRemoved', itemId: 'pack' }, { changeType: 'itemAdded', itemId: 'w2', item: { templateId: 'Hero:hid_x_r_t01', quantity: 1 } }] })).toEqual([
      { templateId: 'Hero:hid_x_r_t01', quantity: 1, itemId: 'w2' },
    ])
    expect(openedRewards(undefined)).toEqual([])
  })
})
