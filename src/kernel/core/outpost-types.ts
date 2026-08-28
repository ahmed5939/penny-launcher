export type OutpostPermissionPlayer = {
  accountId: string
  displayName: string
}

export type OutpostZoneInfo = {
  amplifierCount: number
  editPermissions: Array<OutpostPermissionPlayer>
  highestEnduranceWave: number
  level: number
  saveFile: string
  zoneId: string
  zoneName: string
}

export type OutpostInfoResult = {
  error?: string
  success: boolean
  zones: Array<OutpostZoneInfo>
}

export type OutpostStructures = {
  cones: number
  floors: number
  stairs: number
  total: number
  walls: number
}

export type OutpostTrap = {
  count: number
  displayName: string
}

export type OutpostBaseData = {
  error?: string
  structures: OutpostStructures
  success: boolean
  totalTraps: number
  traps: Array<OutpostTrap>
  /** Non-fatal: the base may exist but have no recorded structures. */
  warning?: string
}

/**
 * The `metadata` profile is Epic's loosest profile — Outpost items carry
 * nested per-zone state that is not documented anywhere stable, so this is
 * modelled on exactly the fields the outpost viewer reads.
 */
export type OutpostMetadataProfile = {
  profileChanges: Array<{
    profile?: {
      items?: Record<
        string,
        {
          attributes?: {
            cloud_save_info?: {
              savedRecords?: Array<{ recordFilename?: string }>
            }
            level?: number
            outpost_core_info?: {
              accountsWithEditPermission?: Array<string>
              highestEnduranceWaveReached?: number
              placedBuildings?: Array<unknown>
            }
          }
          templateId?: string
        }
      >
    }
  }>
}
