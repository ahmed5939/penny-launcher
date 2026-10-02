import { describe, expect, it } from 'vitest'

import { matchesSchematicType, schematicFamily, schematicTypeOptions } from './schematic-types'

const pistol = { category: 'Ranged', subType: 'Pistol' }
const sword = { category: 'Melee', subType: 'Sword' }
const trap = { category: 'Trap', subType: null }

describe('schematic types', () => {
  it('reads weapon families from the database and trap families from the template id', () => {
    expect(schematicFamily('Schematic:sid_pistol_auto_vr_ore_t01', pistol)).toEqual({ category: 'Ranged', family: 'Pistol' })
    expect(schematicFamily('Schematic:sid_ceiling_electric_aoe_sr_t05', trap)).toEqual({ category: 'Trap', family: 'Ceiling' })
    expect(schematicFamily('Schematic:sid_floor_spikes_r_t01', trap)).toEqual({ category: 'Trap', family: 'Floor' })
    expect(schematicFamily('Schematic:ammo_bulletslight', { category: 'Ammo' })).toBeNull()
    expect(schematicFamily('Schematic:sid_pistol_auto_vr_ore_t01', null)).toBeNull()
  })

  it('matches everything, a whole category, or one family', () => {
    expect(matchesSchematicType('all', 'Schematic:x', null)).toBe(true)
    expect(matchesSchematicType('Ranged', 'Schematic:sid_pistol_auto_vr_ore_t01', pistol)).toBe(true)
    expect(matchesSchematicType('Ranged:Pistol', 'Schematic:sid_pistol_auto_vr_ore_t01', pistol)).toBe(true)
    expect(matchesSchematicType('Ranged:Sniper', 'Schematic:sid_pistol_auto_vr_ore_t01', pistol)).toBe(false)
    expect(matchesSchematicType('Melee', 'Schematic:sid_pistol_auto_vr_ore_t01', pistol)).toBe(false)
    expect(matchesSchematicType('Melee:Sword', 'Schematic:sid_edged_sword_medium_r_ore_t04', sword)).toBe(true)
    expect(matchesSchematicType('Trap:Wall', 'Schematic:sid_wall_launcher_sr_t05', trap)).toBe(true)
    expect(matchesSchematicType('Trap:Wall', 'Schematic:sid_floor_launcher_sr_t05', trap)).toBe(false)
  })

  it('lists every option once, grouped under its category', () => {
    const values = schematicTypeOptions.map((option) => option.value)
    expect(new Set(values).size).toBe(values.length)
    expect(schematicTypeOptions[0]).toEqual({ value: 'all', label: 'All types' })
    expect(schematicTypeOptions.find((option) => option.value === 'Ranged:Pistol')).toMatchObject({ label: 'Pistols', group: 'Ranged' })
    expect(schematicTypeOptions.find((option) => option.value === 'Trap')).toMatchObject({ label: 'All traps', group: 'Traps' })
  })
})
