import { describe, expect, it } from 'vitest'

import {
  buildCosmeticsCatalog,
  parseBannerColor,
  prettifyCosmeticId,
  resolveCosmetic,
  splitTemplateId,
} from './locker-catalog'

const catalog = buildCosmeticsCatalog({
  br: [
    {
      id: 'CID_001_Athena_Commando_F',
      name: 'Renegade Raider',
      type: { backendValue: 'AthenaCharacter' },
      rarity: { value: 'rare' },
      series: { value: 'MARVEL SERIES', colors: ['c4231eff', '6b0f0dff'] },
      introduction: { chapter: '1', season: '1' },
      images: { smallIcon: 'https://example.test/small.png' },
      added: '2017-10-01T00:00:00Z',
    },
    {
      id: 'Companion_Flourcut',
      name: 'Flourcut',
      images: { icon: 'https://example.test/companion.png' },
      rarity: { value: 'epic' },
    },
  ],
  instruments: [
    {
      id: 'SparksGuitar:Sparks_Foo_Guitar',
      name: 'Foo Guitar',
      rarity: { value: 'rare' },
      images: { small: 'https://example.test/guitar.png' },
    },
  ],
  cars: [
    {
      id: 'Body_Akuma',
      vehicleId: 'VCID_BodyAkumaT1',
      name: 'Nissan Fairlady Z',
      rarity: { value: 'uncommon' },
      images: { small: 'https://example.test/car.png' },
    },
  ],
  tracks: [
    {
      id: 'SID_Placeholder_02',
      devName: 'butterbarnhoedown',
      title: 'Butter Barn Hoedown',
      albumArt: 'https://cdn.example.test/track.jpg',
    },
  ],
  banners: [
    {
      id: 'AchievementGoGnome',
      name: 'Homebase Banner',
      images: { smallIcon: 'https://example.test/banner.png' },
    },
  ],
  bannerColors: [{ id: 'DefaultColor2', color: 'RedH0' }],
})

describe('splitTemplateId', () => {
  it('splits on the first colon only, so companion variants survive', () => {
    expect(splitTemplateId('CosmeticMimosa:companion_flourcut:70c')).toEqual({
      backendType: 'CosmeticMimosa',
      id: 'companion_flourcut:70c',
    })
  })

  it('treats an id with no prefix as all id', () => {
    expect(splitTemplateId('cid_001')).toEqual({
      backendType: '',
      id: 'cid_001',
    })
  })
})

describe('prettifyCosmeticId', () => {
  it('turns a slug into something readable and drops the variant', () => {
    expect(prettifyCosmeticId('companion_flourcut:70c')).toBe(
      'Companion Flourcut'
    )
  })
})

describe('parseBannerColor', () => {
  it('reads the hue form', () => {
    expect(parseBannerColor('RedH0')).toBe('#D92626')
  })

  it('darkens and lightens the same hue differently', () => {
    expect(parseBannerColor('RedH0Dark')).not.toBe(parseBannerColor('RedH0'))
    expect(parseBannerColor('RedH0Light')).not.toBe(parseBannerColor('RedH0'))
  })

  it('reads the embedded-hex form and scales each channel independently', () => {
    expect(parseBannerColor('Gray666666FF')).toBe('#666666')
    expect(parseBannerColor('Gray666666FFDark')).toBe('#3D3D3D')
  })

  it('gives up rather than guessing on an unknown token', () => {
    expect(parseBannerColor('SomethingNew')).toBeNull()
    expect(parseBannerColor(undefined)).toBeNull()
  })
})

describe('resolveCosmetic', () => {
  it('resolves a BR cosmetic with its series palette', () => {
    const meta = resolveCosmetic(catalog, 'AthenaCharacter:cid_001_athena_commando_f')

    expect(meta.name).toBe('Renegade Raider')
    expect(meta.rarity).toBe('rare')
    expect(meta.seriesColors).toEqual(['c4231eff', '6b0f0dff'])
    expect(meta.chapter).toBe(1)
    expect(meta.resolved).toBe(true)
  })

  it('finds an instrument published with its prefix baked into the id', () => {
    expect(
      resolveCosmetic(catalog, 'SparksGuitar:Sparks_Foo_Guitar').name
    ).toBe('Foo Guitar')
  })

  it('finds a car part by the vehicle id the locker equips it as', () => {
    expect(
      resolveCosmetic(catalog, 'VehicleCosmetics_Body:VCID_BodyAkumaT1').name
    ).toBe('Nissan Fairlady Z')
  })

  it('finds a jam track by its dev name and uses the album art', () => {
    const meta = resolveCosmetic(catalog, 'SparksSong:butterbarnhoedown')

    expect(meta.name).toBe('Butter Barn Hoedown')
    expect(meta.imageUrl).toBe('https://cdn.example.test/track.jpg')
  })

  it('strips a companion variant before looking the base item up', () => {
    expect(
      resolveCosmetic(catalog, 'CosmeticMimosa:companion_flourcut:70c').name
    ).toBe('Flourcut')
  })

  it('turns a banner colour into an actual colour and no picture', () => {
    const meta = resolveCosmetic(catalog, 'HomebaseBannerColor:defaultcolor2')

    expect(meta.color).toBe('#D92626')
    expect(meta.imageUrl).toBeNull()
  })

  it('names an id no catalogue knows off its own slug', () => {
    const meta = resolveCosmetic(catalog, 'AthenaCharacter:cid_from_the_future')

    expect(meta.name).toBe('Cid From The Future')
    expect(meta.resolved).toBe(false)
    expect(meta.rarity).toBe('common')
  })
})
