import { describe, expect, it } from 'vitest'
import { worldItemDisplay, worldPerkDisplay } from './display'
import { parseWorldProfile } from './model'
describe('crafted weapon presentation', () => {
  it('resolves Dragon’s Roar with the weapon art and material tier', () => {
    expect(worldItemDisplay('Weapon:wid_assault_dragon_sr_crystal_t05', {})).toMatchObject({ name: "Dragon's Roar", image: 'T-Icon-Weapons-SK-Dragon-Assault.png', rarity: 'Legendary', displayTier: 'Sunbeam' })
  })
  it('resolves each roll tier independently of weapon rarity', () => {
    const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
    for (let tier = 1; tier <= 5; tier++) expect(worldPerkDisplay(`Alteration:aid_att_critdamage_t0${tier}`, {}).rarity).toBe(rarities[tier-1])
    expect(worldPerkDisplay('Alteration:aid_att_critdamage_t05', {}).description).toBe('+135% Crit Damage')
    expect(worldPerkDisplay('Alteration:aid_att_ranged_critchance', {}).description).toContain('Crit Chance')
  })
  it('retains empty slots and repeated perks and labels unknown perks honestly', () => {
    const item = parseWorldProfile({ profileChanges: [{ profile: { profileId: 'theater0', accountId: 'a', items: { w: { templateId: 'Weapon:x', attributes: { alterations: ['Alteration:aid_att_critdamage_t05', '', 'Alteration:aid_att_critdamage_t05'] } } } } }] }, 'a', 'backpack').items[0]
    expect(item.alterationSlots).toEqual(['Alteration:aid_att_critdamage_t05', null, 'Alteration:aid_att_critdamage_t05'])
    expect(worldPerkDisplay(null, {}).description).toBe('Empty perk slot')
    expect(worldPerkDisplay('Alteration:new_unknown', {}).rarity).toBeNull()
    expect(worldPerkDisplay('Alteration:new_unknown', {}).description).toContain('Unrecognized')
  })
})
