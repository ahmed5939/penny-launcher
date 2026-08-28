import type { CosmeticMeta } from './locker-catalog'
import type { LockerItemsResponse } from '../../types/services/locker'

import { describe, expect, it } from 'vitest'

import {
  buildLoadoutPayload,
  filterForCard,
  ownedForSlot,
  parseEquippedSlots,
} from './locker-loadout'

const locker: LockerItemsResponse = {
  activeLoadoutGroup: {
    loadouts: {
      'CosmeticLoadout:LoadoutSchema_Character': {
        shuffleType: 'DISABLED',
        loadoutSlots: [
          {
            slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Character',
            equippedItemId: 'AthenaCharacter:cid_001',
            itemCustomizations: [{ channelTag: 'Material' }],
          },
          {
            slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Pickaxe',
            equippedItemId: 'AthenaPickaxe:pickaxe_001',
          },
          {
            slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Backpack',
          },
        ],
      },
      'CosmeticLoadout:LoadoutSchema_SomethingEpicAddedLater': {
        shuffleType: 'RANDOM',
        loadoutSlots: [
          {
            slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Unknown',
            equippedItemId: 'Whatever:thing_001',
          },
        ],
      },
    },
  },
}

function cosmetic(overrides: Partial<CosmeticMeta>): CosmeticMeta {
  return {
    templateId: 'AthenaCharacter:cid_001',
    backendType: 'AthenaCharacter',
    id: 'cid_001',
    name: 'Outfit',
    imageUrl: null,
    rarity: 'rare',
    series: null,
    seriesColors: null,
    color: null,
    chapter: 1,
    added: null,
    resolved: true,
    ...overrides,
  }
}

describe('parseEquippedSlots', () => {
  it('flattens every schema and keeps empty slots as empty', () => {
    expect(parseEquippedSlots(locker)).toEqual({
      character: 'AthenaCharacter:cid_001',
      pickaxe: 'AthenaPickaxe:pickaxe_001',
      backpack: null,
    })
  })

  it('is empty rather than throwing for a locker Epic never sent', () => {
    expect(parseEquippedSlots(undefined)).toEqual({})
    expect(parseEquippedSlots({})).toEqual({})
  })
})

describe('buildLoadoutPayload', () => {
  it('changes only the target slot and preserves schemas it does not know', () => {
    const payload = buildLoadoutPayload(
      locker,
      'character',
      'AthenaCharacter:cid_999'
    )

    expect(
      payload['CosmeticLoadout:LoadoutSchema_Character'].loadoutSlots
    ).toEqual([
      {
        slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Character',
        equippedItemId: 'AthenaCharacter:cid_999',
        itemCustomizations: [],
      },
      {
        slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Pickaxe',
        equippedItemId: 'AthenaPickaxe:pickaxe_001',
        itemCustomizations: [],
      },
      {
        slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Backpack',
        itemCustomizations: [],
      },
    ])

    /*
     * The whole payload replaces the locker, so a schema this app has never
     * heard of has to survive the round trip or it is silently wiped.
     */
    expect(
      payload['CosmeticLoadout:LoadoutSchema_SomethingEpicAddedLater']
    ).toEqual({
      shuffleType: 'RANDOM',
      loadoutSlots: [
        {
          slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Unknown',
          equippedItemId: 'Whatever:thing_001',
          itemCustomizations: [],
        },
      ],
    })
  })

  it('drops the slot when unequipping and leaves the rest alone', () => {
    const payload = buildLoadoutPayload(locker, 'pickaxe', null)
    const slots =
      payload['CosmeticLoadout:LoadoutSchema_Character'].loadoutSlots

    expect(
      slots.map((slot) => slot.slotTemplate)
    ).toEqual([
      'CosmeticLoadoutSlotTemplate:LoadoutSlot_Character',
      'CosmeticLoadoutSlotTemplate:LoadoutSlot_Backpack',
    ])
  })

  it('adds a slot the account has never filled under its own schema', () => {
    const payload = buildLoadoutPayload(
      locker,
      'guitar',
      'SparksGuitar:sparks_guitar_001'
    )

    expect(payload['CosmeticLoadout:LoadoutSchema_Sparks']).toEqual({
      shuffleType: 'DISABLED',
      loadoutSlots: [
        {
          slotTemplate: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Guitar',
          equippedItemId: 'SparksGuitar:sparks_guitar_001',
          itemCustomizations: [],
        },
      ],
    })
    /* And the schemas that were already there are still there. */
    expect(
      payload['CosmeticLoadout:LoadoutSchema_Character'].loadoutSlots
    ).toHaveLength(3)
  })

  it('does not resurrect a slot that was never there when unequipping', () => {
    expect(buildLoadoutPayload(locker, 'guitar', null)).not.toHaveProperty(
      'CosmeticLoadout:LoadoutSchema_Sparks'
    )
  })
})

describe('ownedForSlot', () => {
  const owned = [
    cosmetic({}),
    cosmetic({
      templateId: 'AthenaDance:eid_floss',
      backendType: 'AthenaDance',
      id: 'eid_floss',
    }),
    cosmetic({
      templateId: 'AthenaGlider:glider_001',
      backendType: 'AthenaGlider',
      id: 'glider_001',
    }),
  ]

  it('offers only what the slot accepts', () => {
    expect(
      ownedForSlot(owned, 'emote3').map((item) => item.id)
    ).toEqual(['eid_floss'])
    expect(
      ownedForSlot(owned, 'character').map((item) => item.id)
    ).toEqual(['cid_001'])
  })

  it('offers the same car parts to both car bodies', () => {
    const body = cosmetic({
      templateId: 'VehicleCosmetics_Body:body_akuma',
      backendType: 'VehicleCosmetics_Body',
      id: 'body_akuma',
    })

    expect(ownedForSlot([body], 'vehicleBody')).toHaveLength(1)
    expect(ownedForSlot([body], 'suvBody')).toHaveLength(1)
  })
})

describe('filterForCard', () => {
  const owned = [
    cosmetic({ rarity: 'legendary', chapter: 1 }),
    cosmetic({
      templateId: 'AthenaDance:eid_floss',
      backendType: 'AthenaDance',
      id: 'eid_floss',
      rarity: 'rare',
      chapter: 4,
    }),
    cosmetic({
      templateId: 'SparksSong:sid_song',
      backendType: 'SparksSong',
      id: 'sid_song',
      rarity: 'common',
      chapter: null,
    }),
  ]
  const noFilters = {
    groups: [],
    rarities: [],
    chapters: [],
    equippedOnly: false,
  }

  it('keeps everything when nothing is selected', () => {
    expect(filterForCard(owned, noFilters, new Set())).toHaveLength(3)
  })

  it('narrows by group, rarity and chapter together', () => {
    expect(
      filterForCard(
        owned,
        { ...noFilters, groups: ['outfit', 'emote'] },
        new Set()
      ).map((item) => item.id)
    ).toEqual(['cid_001', 'eid_floss'])

    expect(
      filterForCard(
        owned,
        { ...noFilters, rarities: ['LEGENDARY'] },
        new Set()
      ).map((item) => item.id)
    ).toEqual(['cid_001'])

    expect(
      filterForCard(owned, { ...noFilters, chapters: [4] }, new Set()).map(
        (item) => item.id
      )
    ).toEqual(['eid_floss'])
  })

  it('drops items with no known chapter once a chapter is chosen', () => {
    expect(
      filterForCard(owned, { ...noFilters, chapters: [1, 4] }, new Set())
    ).toHaveLength(2)
  })

  it('restricts to the equipped set when asked', () => {
    expect(
      filterForCard(
        owned,
        { ...noFilters, equippedOnly: true },
        new Set(['SparksSong:sid_song'])
      ).map((item) => item.id)
    ).toEqual(['sid_song'])
  })
})
