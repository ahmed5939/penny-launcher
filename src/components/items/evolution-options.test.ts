import { describe, expect, it } from 'vitest'

import type { ItemRecord } from '../../kernel/core/item-database'

import { evolutionOptions } from './evolution-options'

const record = (tierUpResult: string, alternateTierUpResult?: string) =>
  ({ tierUpResult, alternateTierUpResult }) as ItemRecord

describe('evolutionOptions', () => {
  it('offers tier-four materials for a PL 77 weapon with the correct recipe indices', () => {
    expect(evolutionOptions(record('Schematic:weapon_ore_t04', 'Schematic:weapon_crystal_t04'), 3)).toEqual([
      { label: 'Evolve to Obsidian', conversionIndex: 0 },
      { label: 'Evolve to Shadowshard', conversionIndex: 1 },
    ])
  })

  it('preserves recipe indices when a weapon lists crystal first', () => {
    expect(evolutionOptions(record('Schematic:weapon_crystal_t04', 'Schematic:weapon_ore_t04'), 3)).toEqual([
      { label: 'Evolve to Shadowshard', conversionIndex: 0 },
      { label: 'Evolve to Obsidian', conversionIndex: 1 },
    ])
  })

  it('only offers the available path for weapons without an alternate recipe', () => {
    expect(evolutionOptions(record('Schematic:launcher_ore_t04'), 3)).toEqual([
      { label: 'Evolve to Obsidian', conversionIndex: 0 },
    ])
  })

  it.each([
    ['ore', 'Brightcore'], ['crystal', 'Sunbeam'],
  ])('keeps the %s path when evolving to tier five', (path, material) => {
    expect(evolutionOptions(record(`Schematic:weapon_${path}_t05`), 4)).toEqual([
      { label: `Evolve to ${material}`, conversionIndex: 0 },
    ])
  })

  it('keeps generic evolution available for non-weapons', () => {
    expect(evolutionOptions(record('Hero:hero_sr_t04'), 3)).toEqual([
      { label: 'Evolve to tier 4', conversionIndex: 0 },
    ])
  })
})
