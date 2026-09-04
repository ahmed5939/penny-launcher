import { describe, expect, it } from 'vitest'

import {
  propLabel,
  structureCentre,
  trapCentre,
} from './-blueprint-geometry'

describe('structureCentre', () => {
  it('uses the saved actor pivot for every piece kind', () => {
    expect(structureCentre([-7, 0.5, 1.5, 1, 1, 0, 0, 3])).toEqual({
      x: -7,
      y: 0.5,
      z: 1.5,
    })
    expect(structureCentre([-7, 0.5, 1.5, 1, 0, 0, 0, 3])).toEqual({
      x: -7,
      y: 0.5,
      z: 1.5,
    })
    expect(structureCentre([-8.5, 1, 0, 1, 2, 3, 0, 1])).toEqual({
      x: -8.5,
      y: 1,
      z: 0,
    })
  })
})

describe('trapCentre', () => {
  it('centres floor and ceiling traps but keeps wall traps on their plane', () => {
    expect(trapCentre([-7, 1.5, 1.5, 0, 0, 2])).toEqual({ x: -7, y: 1, z: 1.5 })
    expect(trapCentre([-7, 1.5, 4.5, 2, 0, 0])).toEqual({ x: -7, y: 2, z: 4.5 })
    expect(trapCentre([-7, 1.5, 3, 1, 0, 1])).toEqual({ x: -7, y: 1.5, z: 3 })
  })
})

describe('propLabel', () => {
  it('turns class names into readable labels', () => {
    expect(propLabel('Tree_Pine_02')).toBe('Tree Pine 02')
    expect(propLabel('Prop_Rocks_Piles_3')).toBe('Rocks Piles 3')
    expect(propLabel('Tiered_Short_Ammo_3_Parent')).toBe('Short Ammo 3')
  })
})
