import type {
  CloudStorageUserFile,
  OutpostAmplifier,
  OutpostMetadataProfile,
  OutpostProfileSummary,
} from './outpost-types'

/** Storm Shield items by zone, in the order the outpost page lists them. */
export const OUTPOST_ZONE_ORDER = [
  'outpostcore_pve_04',
  'outpostcore_pve_03',
  'outpostcore_pve_02',
  'outpostcore_pve_01',
] as const

export const OUTPOST_ZONE_NAMES: Record<string, string> = {
  outpostcore_pve_04: 'Twine Peaks',
  outpostcore_pve_03: 'Canny Valley',
  outpostcore_pve_02: 'Plankerton',
  outpostcore_pve_01: 'Stonewood',
}

/** One zone's Storm Shield as the metadata profile records it. */
export type OutpostMetadataZone = {
  amplifiers: Array<OutpostAmplifier>
  /** Account ids from `accountsWithEditPermission`, in profile order. */
  editorIds: Array<string>
  highestEnduranceWave: number
  level: number
  saveCount: number
  /** The current archive's file name in user cloud storage; empty when none. */
  saveFile: string
  /** `pve_01` … `pve_04`. */
  zoneId: string
  zoneName: string
}

/** The trailing number of a gameplay tag like `Outpost.PlacementActor.Placement.04`. */
function tagIndex(tag: unknown): number | null {
  const match = typeof tag === 'string' ? tag.match(/\.(\d+)$/) : null

  return match ? Number(match[1]) : null
}

/**
 * `placedBuildings` pairs each amplifier with the pad it stands on. Pads are
 * the player's choice, so they differ between accounts.
 */
export function parseAmplifiers(
  placedBuildings: Array<{ buildingTag?: string; placedTag?: string }>
): Array<OutpostAmplifier> {
  return placedBuildings
    .flatMap((entry) => {
      const building = tagIndex(entry?.buildingTag)
      const pad = tagIndex(entry?.placedTag)

      return building === null || pad === null ? [] : [{ building, pad }]
    })
    .sort((a, b) => a.building - b.building)
}

/**
 * Every zone in page order, filled with zeros where the profile has no
 * Storm Shield item yet, plus the profile's own dates. Null when the
 * response carries no profile at all.
 */
export function parseOutpostMetadata(
  response: OutpostMetadataProfile | null | undefined
): { summary: OutpostProfileSummary; zones: Array<OutpostMetadataZone> } | null {
  const profile = response?.profileChanges?.[0]?.profile

  if (!profile) return null

  const byZone = new Map<string, OutpostMetadataZone>()

  for (const item of Object.values(profile.items ?? {})) {
    const zoneKey = (item?.templateId ?? '').match(/^Outpost:(.+)$/)?.[1]

    if (!zoneKey || !OUTPOST_ZONE_NAMES[zoneKey]) continue

    const attributes = item.attributes ?? {}
    const coreInfo = attributes.outpost_core_info ?? {}
    const cloudInfo = attributes.cloud_save_info ?? {}

    byZone.set(zoneKey, {
      amplifiers: parseAmplifiers(coreInfo.placedBuildings ?? []),
      editorIds: (coreInfo.accountsWithEditPermission ?? []).filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      ),
      highestEnduranceWave: coreInfo.highestEnduranceWaveReached ?? 0,
      level: attributes.level ?? 0,
      saveCount: cloudInfo.saveCount ?? 0,
      saveFile:
        (cloudInfo.savedRecords ?? []).find((record) => record?.recordFilename)
          ?.recordFilename ?? '',
      zoneId: zoneKey.replace('outpostcore_', ''),
      zoneName: OUTPOST_ZONE_NAMES[zoneKey],
    })
  }

  return {
    summary: {
      createdAt: profile.created ?? null,
      updatedAt: profile.updated ?? null,
    },
    zones: OUTPOST_ZONE_ORDER.map(
      (zoneKey) =>
        byZone.get(zoneKey) ?? {
          amplifiers: [],
          editorIds: [],
          highestEnduranceWave: 0,
          level: 0,
          saveCount: 0,
          saveFile: '',
          zoneId: zoneKey.replace('outpostcore_', ''),
          zoneName: OUTPOST_ZONE_NAMES[zoneKey],
        }
    ),
  }
}

/** Upload time by file name, from the user cloud storage listing. */
export function cloudSaveTimes(
  files: Array<CloudStorageUserFile> | null | undefined
): Map<string, string> {
  const times = new Map<string, string>()

  for (const file of Array.isArray(files) ? files : []) {
    const name = file?.uniqueFilename ?? file?.filename

    if (name && file.uploaded) times.set(name, file.uploaded)
  }

  return times
}
