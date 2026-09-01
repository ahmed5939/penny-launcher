import { describe, expect, it } from 'vitest'

import { buildCosmeticsCatalog } from './locker-catalog'
import {
  buildCompanionCollection,
  companionBaseId,
  listCatalogCompanions,
} from './locker-companions'

const catalog = buildCosmeticsCatalog({
  br: [
    {
      id: 'Companion_SitPlant',
      name: 'Bonesy',
      description: 'An adventure-loving everydog.',
      type: { backendValue: 'CosmeticCompanion' },
      rarity: { value: 'uncommon' },
      images: { smallIcon: 'https://example.test/bonesy.png' },
    },
    {
      id: 'Companion_Flourcut',
      name: 'The Best Cat',
      description: '  ',
      type: { backendValue: 'CosmeticCompanion' },
      rarity: { value: 'uncommon' },
    },
    {
      id: 'Companion_DroneGravy',
      name: 'Groot',
      type: { backendValue: 'CosmeticCompanion' },
      rarity: { value: 'marvel' },
      series: { value: 'MARVEL SERIES', colors: ['c4231eff', '6b0f0dff'] },
    },
    {
      id: 'Companion_Placeholder',
      name: undefined,
      type: { backendValue: 'CosmeticCompanion' },
    },
    {
      id: 'Mimosa_Random',
      name: 'Random',
      type: { backendValue: 'CosmeticCompanion' },
    },
    {
      id: 'CID_001_Athena_Commando_F',
      name: 'Renegade Raider',
      type: { backendValue: 'AthenaCharacter' },
    },
  ],
})

describe('companionBaseId', () => {
  it('drops the pose suffix and lowercases', () => {
    expect(companionBaseId('Companion_Flourcut:70c')).toBe('companion_flourcut')
    expect(companionBaseId('companion_sitplant')).toBe('companion_sitplant')
  })
})

describe('listCatalogCompanions', () => {
  it('keeps only named, real sidekicks', () => {
    expect(listCatalogCompanions(catalog).map((item) => item.id)).toEqual([
      'Companion_SitPlant',
      'Companion_Flourcut',
      'Companion_DroneGravy',
    ])
  })
})

describe('buildCompanionCollection', () => {
  it('flags ownership from either prefix, with or without a pose', () => {
    const entries = buildCompanionCollection(catalog, [
      'CosmeticMimosa:companion_flourcut:70c',
      'CosmeticCompanion:Companion_DroneGravy',
      'AthenaCharacter:CID_001_Athena_Commando_F',
    ])

    expect(
      entries.map((entry) => [entry.id, entry.owned])
    ).toEqual([
      ['Companion_DroneGravy', true],
      ['Companion_Flourcut', true],
      ['Companion_SitPlant', false],
    ])
  })

  it('decorates each entry from the catalogue', () => {
    const entries = buildCompanionCollection(catalog, [])
    const groot = entries.find((entry) => entry.id === 'Companion_DroneGravy')

    expect(groot).toMatchObject({
      templateId: 'CosmeticCompanion:Companion_DroneGravy',
      backendType: 'CosmeticCompanion',
      owned: false,
      series: 'MARVEL SERIES',
    })

    const sitPlant = entries.find((entry) => entry.id === 'Companion_SitPlant')
    const flourcut = entries.find((entry) => entry.id === 'Companion_Flourcut')

    expect(sitPlant).toMatchObject({
      name: 'Bonesy',
      description: 'An adventure-loving everydog.',
      imageUrl: 'https://example.test/bonesy.png',
      rarity: 'uncommon',
      resolved: true,
    })
    expect(flourcut?.description).toBeNull()
  })

  it('sorts owned first, then by name', () => {
    const entries = buildCompanionCollection(catalog, ['companion_sitplant'])

    expect(entries.map((entry) => entry.name)).toEqual([
      'Bonesy',
      'Groot',
      'The Best Cat',
    ])
  })

  it('is empty when the catalogue never loaded', () => {
    expect(buildCompanionCollection(buildCosmeticsCatalog({}), [])).toEqual([])
  })
})
