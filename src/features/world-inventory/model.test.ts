import { describe, expect, it } from 'vitest'
import { parseWorldProfile } from './model'
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
  it('distinguishes a missing profile from a genuinely empty inventory', () => {
    expect(() => parseWorldProfile({}, 'a', 'backpack')).toThrow()
    expect(parseWorldProfile({ profileChanges: [{ profile: { accountId: 'a', profileId: 'theater0', items: {} } }] }, 'a', 'backpack').items).toEqual([])
  })
})
