import { describe, expect, it } from 'vitest'
import { parseWorldProfile, validWorldTransfers } from './model'
const profile = (profileId: string, accountId = 'a') => ({ profileChanges: [{ profile: { profileId, accountId, items: {
  weapon: { templateId: 'Weapon:wid_assault_sr_ore_t05', quantity: 1, attributes: { durability: 0.7, level: 50, alterations: ['Alteration:damage', null], favorite: true } },
  stack1: { templateId: 'Ingredient:ore', quantity: 100 }, stack2: { templateId: 'Ingredient:ore', quantity: 200 },
  unknown: { templateId: 'NewItem:new', quantity: 1 }, empty: { templateId: 'Ammo:light', quantity: 0 },
} } }] })
describe('world inventories', () => {
  it('reads backpack and keeps separate stacks and unknown types', () => {
    const result = parseWorldProfile(profile('theater0'), 'a', 'backpack')
    expect(result.items).toHaveLength(4)
    expect(result.items.filter((i) => i.templateId === 'Ingredient:ore').map((i) => i.quantity)).toEqual([100, 200])
    expect(result.items[0]).toMatchObject({ level: 50, durability: 0.7, favorite: true, alterations: ['Alteration:damage'] })
  })
  it('requires storage profile for storage and validates account identity', () => {
    expect(parseWorldProfile(profile('outpost0'), 'a', 'storage').location).toBe('storage')
    expect(() => parseWorldProfile(profile('theater0'), 'a', 'storage')).toThrow()
    expect(() => parseWorldProfile(profile('outpost0', 'b'), 'a', 'storage')).toThrow()
  })
  it('reads crafted perks from alterationDefinitions, as Epic stores them', () => {
    const body = { profileChanges: [{ profile: { profileId: 'outpost0', accountId: 'a', items: {
      trap: { templateId: 'Trap:tid_floor_tar_sr_t05', quantity: 1, attributes: { level: 60, durability: 24, alterationDefinitions: ['Alteration:aid_ele_fire_intrin_t05', '', 'Alteration:aid_att_maxdurability_trap_t05'] } },
    } } }] }
    const [trap] = parseWorldProfile(body, 'a', 'storage').items
    expect(trap.alterations).toEqual(['Alteration:aid_ele_fire_intrin_t05', 'Alteration:aid_att_maxdurability_trap_t05'])
    expect(trap.alterationSlots).toEqual(['Alteration:aid_ele_fire_intrin_t05', null, 'Alteration:aid_att_maxdurability_trap_t05'])
  })
  it('reads the Ventures backpack from theater2 only', () => {
    const result = parseWorldProfile(profile('theater2'), 'a', 'ventures')
    expect(result.location).toBe('ventures')
    expect(result.items).toHaveLength(4)
    expect(() => parseWorldProfile(profile('theater0'), 'a', 'ventures')).toThrow()
    const tools = { profileChanges: [{ profile: { profileId: 'theater2', accountId: 'a', items: { edit: { templateId: 'Weapon:edittool', quantity: 1 }, wall: { templateId: 'Weapon:buildingitemdata_wall', quantity: 1 } } } }] }
    expect(parseWorldProfile(tools, 'a', 'ventures').items).toEqual([])
  })
  it('distinguishes a missing profile from a genuinely empty inventory', () => {
    expect(() => parseWorldProfile({}, 'a', 'backpack')).toThrow()
    expect(parseWorldProfile({ profileChanges: [{ profile: { accountId: 'a', profileId: 'theater0', items: {} } }] }, 'a', 'backpack').items).toEqual([])
  })
})

describe('validWorldTransfers', () => {
  it('passes well-formed moves and rejects malformed ones', () => {
    expect(validWorldTransfers([{ itemId: 'abc-123', quantity: 5, toStorage: true }])).toEqual([{ itemId: 'abc-123', quantity: 5, toStorage: true }])
    expect(() => validWorldTransfers([])).toThrow()
    expect(() => validWorldTransfers([{ itemId: 'abc', quantity: 0, toStorage: true }])).toThrow()
    expect(() => validWorldTransfers([{ itemId: '../x', quantity: 1, toStorage: false }])).toThrow()
    expect(() => validWorldTransfers([{ itemId: 'abc', quantity: 1 }])).toThrow()
  })
})
