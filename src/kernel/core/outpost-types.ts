export type OutpostPermissionPlayer = {
  accountId: string
  displayName: string
}

/** One completed Storm Shield Defense, from the campaign quest ledger. */
export type OutpostDefenseRecord = {
  /** ISO timestamp of when the quest reward was claimed. */
  completedAt: string
  /** Defense number, 1–10. */
  defense: number
}

export type OutpostZoneInfo = {
  amplifierCount: number
  /**
   * Human-ish slot labels parsed from `placedBuildings[].buildingTag` — the
   * tag's last dotted/slashed segment. Empty when the format is unrecognised.
   */
  amplifierSlots: Array<string>
  /** Completed defenses with their claim dates, sorted by defense number. */
  defenses: Array<OutpostDefenseRecord>
  editPermissions: Array<OutpostPermissionPlayer>
  highestEnduranceWave: number
  /** ISO timestamp of the newest cloud save record, when Epic reports one. */
  lastSavedAt: string | null
  level: number
  /** How many times this zone's base has been saved to cloud storage. */
  saveCount: number
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
  /** Edited variants — doors, windows, arches, roof corners and the like. */
  other: number
  stairs: number
  /** Every player-built piece, including the edited variants. */
  total: number
  walls: number
  /** Building pieces by material, from the PBWA_[WSM]x actor prefix. */
  materials: {
    metal: number
    stone: number
    wood: number
  }
  /** Building pieces by upgrade tier, from the PBWA_x[123] actor prefix. */
  tiers: {
    tier1: number
    tier2: number
    tier3: number
  }
}

export type OutpostTrapCategory = 'ceiling' | 'floor' | 'wall' | 'other'

/** One perk and how many times it appears — across a trap type or the base. */
export type OutpostPerkTally = {
  /** `Alteration:` template id, resolvable against the item database. */
  templateId: string
  count: number
}

export type OutpostTrap = {
  category: OutpostTrapCategory
  count: number
  displayName: string
  /** Key into the renderer's local image map; undefined = no art shipped. */
  iconKey?: string
  /**
   * Short rarity code from the trap's TID — `c`|`uc`|`r`|`vr`|`sr`|`ur`,
   * the highest seen in the group. Maps straight onto `RarityType`.
   */
  rarity: string | null
  /** Evolution tier 1–5, the highest in the group. */
  tier: number | null
  /**
   * `Trap:tid_...` template id, resolvable against the item database for
   * art and power-level curves. The group's highest-tier TID.
   */
  templateId: string | null
  /**
   * Highest crafted level in the group (`OriginalTrapLevel`, 1–60). This is
   * the item level, not the power level — power comes from the rating
   * curves for (rarity, tier, level), computed in the renderer.
   */
  level: number | null
  /** Perks used across this trap type, most-used first. */
  perks: Array<OutpostPerkTally>
}

/** One unique trap item + crafted level, and how many of it are placed. */
export type OutpostTrapInstanceTally = {
  count: number
  level: number
  /** `Trap:tid_...` template id. */
  templateId: string
}

/**
 * A packed top-down map of the base. Positions are in cell units (world
 * units ÷ `cell`) with sub-tile precision — walls sit on half-cell grid
 * lines — so the renderer plots them without touching raw coordinates.
 */
export type OutpostLayout = {
  /** World units per grid cell — Fortnite's build tile is 512. */
  cell: number
  /** Whole-cell bounds (floor/ceil of the extremes). */
  bounds: { maxX: number; maxY: number; minX: number; minY: number }
  /**
   * `[x, y, materialCode, kindCode, yawQuadrant]`.
   * Material: 0 wood, 1 stone, 2 metal, 3 other.
   * Kind: 0 floor, 1 wall, 2 stair, 3 roof, 4 other/edited.
   * Yaw: rotation about Z in 90° steps, 0–3.
   */
  structures: Array<[number, number, number, number, number]>
  /**
   * `[x, y, categoryCode, nameIndex]` — category 0 floor, 1 wall, 2 ceiling,
   * 3 other; `nameIndex` points into `trapNames` so the map can say which
   * trap each dot is.
   */
  traps: Array<[number, number, number, number]>
  /** Trap display names referenced by the dots' `nameIndex`. */
  trapNames: Array<string>
}

export type OutpostBaseData = {
  error?: string
  /** Top-down layout for the minimap; null when nothing had a position. */
  layout: OutpostLayout | null
  /** Perks aggregated across every trap in the base, most-used first. */
  perks: Array<OutpostPerkTally>
  /**
   * Every unique (trap item, level) placed, with counts — the renderer
   * computes power-level stats from these against the rating tables.
   */
  trapItems: Array<OutpostTrapInstanceTally>
  /** Size in bytes of the .sav backup as downloaded from cloud storage. */
  saveSizeBytes: number
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
              saveCount?: number
              savedRecords?: Array<{
                lastModified?: string
                recordFilename?: string
              }>
            }
            level?: number
            outpost_core_info?: {
              accountsWithEditPermission?: Array<string>
              highestEnduranceWaveReached?: number
              placedBuildings?: Array<{
                buildingTag?: string
                placedTag?: string
              }>
            }
          }
          templateId?: string
        }
      >
    }
  }>
}
