import type {
  OutpostBaseData,
  OutpostTrapCategory,
  OutpostZoneInfo,
} from './outpost-types'

const materialNames = ['wood', 'stone', 'metal', 'other'] as const
const structureNames = [
  'floor',
  'wall',
  'stair',
  'roof',
  'edited-or-other',
] as const
const trapCategoryNames: Array<OutpostTrapCategory> = [
  'floor',
  'wall',
  'ceiling',
  'other',
]
const propKindNames = [
  'tree',
  'rock',
  'container',
  'world-structure',
  'other',
] as const
const rarityNames: Record<string, string> = {
  c: 'Common',
  r: 'Rare',
  sr: 'Legendary',
  uc: 'Uncommon',
  ur: 'Mythic',
  vr: 'Epic',
}

function readableTemplateName(templateId: string) {
  return templateId
    .replace(/^[^:]+:/, '')
    .replace(/^(?:aid|tid)_/i, '')
    .replace(/_t\d\d$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function readablePerks(perks: OutpostBaseData['perks']) {
  return perks.map((perk) => ({
    count: perk.count,
    name: readableTemplateName(perk.templateId),
    templateId: perk.templateId,
  }))
}

/**
 * Expand the compact tuples used by the interactive blueprint into named
 * fields that are useful outside the app. Coordinates remain in Fortnite
 * build cells; the blueprint coordinates match the quarter-turn used by the
 * on-screen drawing.
 */
function readableLayout(layout: NonNullable<OutpostBaseData['layout']>) {
  return {
    coordinateUnit: `one cell = ${layout.cell} Unreal world units`,
    sourceBounds: layout.bounds,
    structures: layout.structures.map(
      ([x, y, z, material, kind, yaw, shapeIndex, tier]) => ({
        blueprintX: y,
        blueprintY: -x,
        kind: structureNames[kind] ?? 'unknown',
        material: materialNames[material] ?? 'unknown',
        piece: layout.shapes[shapeIndex] ?? 'unknown',
        rotationDegrees: (yaw % 4) * 90,
        sourceX: x,
        sourceY: y,
        sourceZ: z,
        tier,
      })
    ),
    traps: layout.traps.map(([x, y, z, category, nameIndex, yaw]) => ({
      blueprintX: y,
      blueprintY: -x,
      category: trapCategoryNames[category] ?? 'other',
      name: layout.trapNames[nameIndex] ?? 'Unknown trap',
      rotationDegrees: ((yaw ?? 0) % 4) * 90,
      sourceX: x,
      sourceY: y,
      sourceZ: z,
    })),
    worldAssets: layout.props.map(
      ([x, y, z, kind, yawDegrees, scale, nameIndex]) => ({
        blueprintX: y,
        blueprintY: -x,
        kind: propKindNames[kind] ?? 'other',
        name: layout.propNames[nameIndex] ?? 'Unknown',
        rotationDegrees: yawDegrees,
        scale,
        sourceX: x,
        sourceY: y,
        sourceZ: z,
      })
    ),
  }
}

export function createReadableOutpostReport({
  baseData,
  displayName,
  generatedAt = new Date(),
  zone,
}: {
  baseData: OutpostBaseData
  displayName: string
  generatedAt?: Date
  zone: OutpostZoneInfo
}) {
  const trapNamesByTemplateId = new Map(
    baseData.traps.flatMap((trap) =>
      trap.templateId ? [[trap.templateId, trap.displayName] as const] : []
    )
  )

  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    account: displayName,
    zone: {
      id: zone.zoneId,
      name: zone.zoneName,
      shieldLevel: zone.level,
      highestEnduranceWave: zone.highestEnduranceWave,
      amplifiers: zone.amplifierCount,
      amplifierSlots: zone.amplifierSlots,
      builders: zone.editPermissions,
      defenses: zone.defenses,
      cloudSave: {
        fileName: zone.saveFile,
        lastSavedAt: zone.lastSavedAt,
        saveCount: zone.saveCount,
        sizeBytes: baseData.saveSizeBytes,
      },
    },
    scan: {
      success: baseData.success,
      warning: baseData.warning ?? null,
      error: baseData.error ?? null,
      structureCount: baseData.structures.total,
      trapCount: baseData.totalTraps,
    },
    structures: baseData.structures,
    traps: baseData.traps.map((trap) => ({
      category: trap.category,
      count: trap.count,
      level: trap.level,
      name: trap.displayName,
      perks: readablePerks(trap.perks),
      rarity: trap.rarity
        ? (rarityNames[trap.rarity] ?? trap.rarity)
        : null,
      templateId: trap.templateId,
      tier: trap.tier,
    })),
    trapItems: baseData.trapItems.map((item) => ({
      ...item,
      name:
        trapNamesByTemplateId.get(item.templateId) ??
        readableTemplateName(item.templateId),
    })),
    perks: readablePerks(baseData.perks),
    blueprint: baseData.layout ? readableLayout(baseData.layout) : null,
  }
}

export function serializeReadableOutpostReport(
  input: Parameters<typeof createReadableOutpostReport>[0]
) {
  return `${JSON.stringify(createReadableOutpostReport(input), null, 2)}\n`
}

export function readableOutpostFileName(zoneName: string) {
  const slug = zoneName
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return `outpost-${slug || 'base'}-report.json`
}
