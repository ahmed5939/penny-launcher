import type { OutpostBaseData, OutpostZoneInfo } from './outpost-types'

import { describe, expect, it } from 'vitest'

import {
  createReadableOutpostReport,
  readableOutpostFileName,
  serializeReadableOutpostReport,
} from './outpost-report'

const zone: OutpostZoneInfo = {
  amplifierCount: 2,
  amplifierSlots: ['A', 'B'],
  defenses: [{ completedAt: '2026-01-01T00:00:00.000Z', defense: 1 }],
  editPermissions: [{ accountId: 'builder-id', displayName: 'Builder' }],
  highestEnduranceWave: 12,
  lastSavedAt: '2026-01-02T00:00:00.000Z',
  level: 7,
  saveCount: 3,
  saveFile: 'pve01.sav',
  zoneId: 'pve_01',
  zoneName: 'Stonewood',
}

const baseData: OutpostBaseData = {
  layout: {
    bounds: { maxX: 2, maxY: 3, maxZ: 2, minX: 1, minY: 2, minZ: 2 },
    cell: 512,
    propNames: ['Tree_Pine_02'],
    props: [[4, 5, 2, 0, 33.5, 1.1, 0]],
    shapes: ['Solid'],
    structures: [[1, 2, 2, 2, 1, 3, 0, 3]],
    trapNames: ['Wall Darts'],
    traps: [[2, 3, 2, 1, 0, 2]],
  },
  perks: [{ count: 1, templateId: 'Alteration:aid_damage' }],
  saveSizeBytes: 4096,
  structures: {
    cones: 0,
    floors: 0,
    materials: { metal: 1, stone: 0, wood: 0 },
    other: 0,
    stairs: 0,
    tiers: { tier1: 0, tier2: 0, tier3: 1 },
    total: 1,
    walls: 1,
  },
  success: true,
  totalTraps: 1,
  trapItems: [{ count: 1, level: 60, templateId: 'Trap:tid_wall_darts' }],
  traps: [
    {
      category: 'wall',
      count: 1,
      displayName: 'Wall Darts',
      level: 60,
      perks: [],
      rarity: 'sr',
      templateId: 'Trap:tid_wall_darts',
      tier: 5,
    },
  ],
}

describe('createReadableOutpostReport', () => {
  it('expands compact blueprint tuples into named fields', () => {
    const report = createReadableOutpostReport({
      baseData,
      displayName: 'Penny',
      generatedAt: new Date('2026-01-03T00:00:00.000Z'),
      zone,
    })

    expect(report.blueprint?.structures[0]).toEqual({
      blueprintX: 2,
      blueprintY: -1,
      kind: 'wall',
      material: 'metal',
      piece: 'Solid',
      rotationDegrees: 270,
      sourceX: 1,
      sourceY: 2,
      sourceZ: 2,
      tier: 3,
    })
    expect(report.blueprint?.traps[0]).toMatchObject({
      category: 'wall',
      name: 'Wall Darts',
      rotationDegrees: 180,
    })
    expect(report.blueprint?.worldAssets[0]).toEqual({
      blueprintX: 5,
      blueprintY: -4,
      kind: 'tree',
      name: 'Tree_Pine_02',
      rotationDegrees: 33.5,
      scale: 1.1,
      sourceX: 4,
      sourceY: 5,
      sourceZ: 2,
    })
    expect(report.traps[0]).toMatchObject({
      name: 'Wall Darts',
      rarity: 'Legendary',
    })
    expect(report.perks[0]).toMatchObject({ name: 'Damage' })
    expect(report.trapItems[0]).toMatchObject({ name: 'Wall Darts' })
    expect(report.generatedAt).toBe('2026-01-03T00:00:00.000Z')
  })

  it('serializes as indented JSON with a final newline', () => {
    const serialized = serializeReadableOutpostReport({
      baseData,
      displayName: 'Penny',
      generatedAt: new Date('2026-01-03T00:00:00.000Z'),
      zone,
    })

    expect(serialized).toContain('\n  "schemaVersion": 1,')
    expect(serialized.endsWith('\n')).toBe(true)
    expect(JSON.parse(serialized).zone.name).toBe('Stonewood')
  })
})

describe('readableOutpostFileName', () => {
  it('creates a safe, recognisable report name', () => {
    expect(readableOutpostFileName('Twine Peaks')).toBe(
      'outpost-twine-peaks-report.json'
    )
  })
})
