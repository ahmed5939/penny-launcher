import { Buffer } from 'node:buffer'

import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ dialog: {} }))
vi.mock('./authentication', () => ({ Authentication: {} }))
vi.mock('../runtime-log', () => ({ RuntimeLog: {} }))
vi.mock('../../services/endpoints/mcp', () => ({}))
vi.mock('../../services/endpoints/lookup', () => ({}))

import { parseSav } from './outpost'

// Normalize Buffer views for the installed Node/TypeScript library definitions.
function concatBuffers(parts: Buffer[]) {
  return Buffer.concat(parts.map((part) => new Uint8Array(part)))
}

function gvasString(value: string) {
  const text = Buffer.from(`${value}\0`, 'latin1')
  const length = Buffer.alloc(4)

  length.writeInt32LE(text.length)

  return concatBuffers([length, text])
}

function actorRecord({
  actorState = 2,
  piece,
  spawned,
  x,
}: {
  actorState?: number
  piece: string
  spawned: boolean
  x: number
}) {
  const path = `/Game/Building/ActorBlueprints/Player/Stone/L3/PBWA_S3_${piece}.PBWA_S3_${piece}_C`
  const transform = Buffer.alloc(36)

  // Compressed upright rotation [x, sin(yaw / 2), cos(yaw / 2)].
  transform.writeFloatLE(1, 8)
  transform.writeFloatLE(x, 12)
  transform.writeFloatLE(512, 16)
  transform.writeFloatLE(768, 20)
  transform.writeFloatLE(1, 24)
  transform.writeFloatLE(1, 28)
  transform.writeFloatLE(1, 32)

  const spawnedField = Buffer.alloc(4)
  const actorData = gvasString('None')
  const actorDataSize = Buffer.alloc(4)

  spawnedField.writeUInt32LE(spawned ? 1 : 0)
  actorDataSize.writeUInt32LE(actorData.length)

  return concatBuffers([
    Buffer.alloc(16), // ActorGuid
    Buffer.from([actorState]),
    gvasString(path),
    transform,
    spawnedField,
    actorDataSize,
    actorData,
  ])
}

describe('parseSav actor records', () => {
  it('preserves sub-cell offsets instead of snapping actors to hundredths', () => {
    const result = parseSav(concatBuffers([
      Buffer.from('SavedActors', 'latin1'),
      actorRecord({ piece: 'Solid', spawned: true, x: 513 }),
      actorRecord({ piece: 'Solid', spawned: true, x: -513 }),
    ]))

    expect(result.layout?.structures.map((piece) => piece[0]))
      .toEqual([1.002, -1.002])
    expect(result.layout?.bounds).toMatchObject({ minX: -2, maxX: 2 })
  })


  it('keeps player-built structures and rejects map-owned or destroyed PBWA actors', () => {
    const raw = concatBuffers([
      Buffer.from('SavedActors', 'latin1'),
      actorRecord({ piece: 'Solid', spawned: true, x: 512 }),
      actorRecord({ piece: 'StairW', spawned: false, x: 1024 }),
      actorRecord({ actorState: 3, piece: 'Floor', spawned: true, x: 1536 }),
    ])
    const result = parseSav(raw)

    expect(result.structures).toMatchObject({
      floors: 0,
      stairs: 0,
      total: 1,
      walls: 1,
    })
    expect(result.layout?.structures).toHaveLength(1)
    expect(result.layout?.structures[0]?.slice(0, 3)).toEqual([1, 1, 1.5])
  })
})


describe('edited build classification', () => {
  it.each([
    ['WindowC', 1],
    ['DoorSide', 1],
    ['HalfWallHalf', 1],
    ['ArchwayLarge', 1],
    ['Brace', 1],
    ['BalconyI', 0],
    ['Floor_2', 0],
    ['StairSpiral', 2],
    ['RoofWall', 3],
    ['UnknownPiece', 4],
  ])('keeps %s in the correct spatial family', (piece, kind) => {
    const result = parseSav(concatBuffers([
      Buffer.from('SavedActors', 'latin1'),
      actorRecord({ piece, spawned: true, x: 512 }),
    ]))

    expect(result.layout?.structures[0]?.[4]).toBe(kind)
    expect(result.layout?.shapes).toEqual([piece])
    expect(result.structures.total).toBe(1)
  })
})


/** A placed trap actor whose record carries its schematic and perks. */
function trapRecord({ perks, tid, x }: { perks: Array<string>; tid: string; x: number }) {
  const path = '/SaveTheWorld/Items/Traps/Blueprints/Trap_Wall_Darts.Trap_Wall_Darts_C'
  const transform = Buffer.alloc(36)

  transform.writeFloatLE(1, 8)
  transform.writeFloatLE(x, 12)
  transform.writeFloatLE(512, 16)
  transform.writeFloatLE(768, 20)
  transform.writeFloatLE(1, 24)
  transform.writeFloatLE(1, 28)
  transform.writeFloatLE(1, 32)

  const spawnedField = Buffer.alloc(4)
  const actorData = Buffer.from(
    `${tid} AppliedAlterations ${perks.map((perk) => `/Alterations/${perk}.${perk}`).join(' ')} OriginalTrapLevel`,
    'latin1'
  )
  const actorDataSize = Buffer.alloc(4)

  spawnedField.writeUInt32LE(1)
  actorDataSize.writeUInt32LE(actorData.length)

  return concatBuffers([
    Buffer.alloc(16),
    Buffer.from([2]),
    gvasString(path),
    transform,
    spawnedField,
    actorDataSize,
    actorData,
  ])
}

describe('trap variants', () => {
  it('splits one trap into a card per perk roll and points each dot at its roll', () => {
    const critRoll = ['AID_Att_CritDamage_T05', 'AID_Att_Damage_T05']
    const result = parseSav(concatBuffers([
      Buffer.from('SavedActors', 'latin1'),
      trapRecord({ perks: critRoll, tid: 'TID_Wall_Darts_SR_T05', x: 512 }),
      trapRecord({ perks: [...critRoll].reverse(), tid: 'TID_Wall_Darts_SR_T05', x: 1024 }),
      trapRecord({ perks: ['AID_Att_Durability_T05', 'AID_Att_Durability_T05'], tid: 'TID_Wall_Darts_SR_T05', x: 1536 }),
    ]))

    expect(result.traps.map((trap) => [trap.id, trap.count])).toEqual([
      ['Wall Darts#1', 2],
      ['Wall Darts#2', 1],
    ])
    expect(result.traps[1].perks).toEqual([
      { count: 2, templateId: 'Alteration:aid_att_durability_t05' },
    ])
    expect(result.traps[0].alterations).toEqual([
      'Alteration:aid_att_critdamage_t05',
      'Alteration:aid_att_damage_t05',
    ])
    expect(result.traps[1].alterations).toHaveLength(2)
    expect(result.traps.reduce((total, trap) => total + trap.count, 0)).toBe(3)

    const layout = result.layout!

    expect(layout.traps.map((trap) => layout.trapVariants?.[trap[6]!])).toEqual([
      'Wall Darts#1',
      'Wall Darts#1',
      'Wall Darts#2',
    ])
    expect(result.perks.find((perk) => perk.templateId === 'Alteration:aid_att_durability_t05')?.count).toBe(2)
  })
})
