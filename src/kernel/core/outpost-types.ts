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

/**
 * One Storm Shield amplifier from the metadata profile's `placedBuildings`:
 * which amplifier it is and which pad the player put it on. Pads are the
 * zone's `AmplifierPlacementActor`s, in the order `OutpostZoneTerrain`
 * stores their positions.
 */
export type OutpostAmplifier = {
  /** From `Outpost.BuildingActor.Building.NN`. */
  building: number
  /** From `Outpost.PlacementActor.Placement.NN`. */
  pad: number
}

export type OutpostZoneInfo = {
  amplifiers: Array<OutpostAmplifier>
  /** Completed defenses with their claim dates, sorted by defense number. */
  defenses: Array<OutpostDefenseRecord>
  editPermissions: Array<OutpostPermissionPlayer>
  highestEnduranceWave: number
  /**
   * When the current save was uploaded, from the cloud storage listing —
   * the metadata profile itself carries no timestamps per zone.
   */
  lastSavedAt: string | null
  level: number
  /** How many times this zone's base has been saved to cloud storage. */
  saveCount: number
  saveFile: string
  zoneId: string
  zoneName: string
}

/** The metadata profile as a whole: when the outpost began and last changed. */
export type OutpostProfileSummary = {
  /** Profile creation — the account's first visit to a Storm Shield. */
  createdAt: string | null
  /** Last write to the profile, which every base save makes. */
  updatedAt: string | null
}

export type OutpostInfoResult = {
  error?: string
  success: boolean
  summary?: OutpostProfileSummary
  zones: Array<OutpostZoneInfo>
}

export type OutpostReportExportResult = {
  error?: string
  status: 'cancelled' | 'error' | 'saved'
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

/**
 * One trap schematic placed in the base: the same trap, rarity, tier and
 * perks. A trap rolled twice with different perks is two of these, sharing
 * a display name.
 */
export type OutpostTrap = {
  /** `Alteration:` ids in slot order, a repeated perk once per slot. */
  alterations: Array<string>
  category: OutpostTrapCategory
  count: number
  displayName: string
  /** Key into the renderer's local image map; undefined = no art shipped. */
  iconKey?: string
  /**
   * `"Wall Darts#2"` — unique per variant within one scan. Layout dots point
   * at it through `OutpostLayout.trapVariants`, so selecting a card lights
   * exactly its copies.
   */
  id: string
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
  /**
   * The perks every trap in this variant carries, in slot order; `count`
   * is how many slots roll the same perk.
   */
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
 * A packed spatial map of the base. Positions are in cell units (world units
 * ÷ `cell`) with sub-tile precision, including height for the 3D explorer.
 *
 * Build pieces are stored at their actor pivot. Fortnite places floor, roof
 * and stair pivots at a tile edge and wall pivots at the centre of the wall
 * plane. Renderers must preserve each mesh pivot when applying saved XYZ.
 */
export type OutpostLayout = {
  /** World units per grid cell — Fortnite's build tile is 512. */
  cell: number
  /** Whole-cell bounds (floor/ceil of the extremes) of the player build. */
  bounds: {
    maxX: number
    maxY: number
    maxZ: number
    minX: number
    minY: number
    minZ: number
  }
  /**
   * `[x, y, z, materialCode, kindCode, yawQuadrant, shapeIndex, tier]`.
   * Material: 0 wood, 1 stone, 2 metal, 3 other.
   * Kind: 0 floor, 1 wall, 2 stair, 3 roof, 4 other/edited.
   * Yaw: rotation about Z in 90° steps, 0–3.
   * Shape: index into `shapes` — the exact edit variant.
   * Tier: upgrade tier 1–3 (0 when unknown).
   */
  structures: Array<
    [number, number, number, number, number, number, number, number]
  >
  /**
   * Piece shape names from the actor class (`Solid`, `Windows`, `DoorC`,
   * `StairW`, `RoofC`, `BalconyS` …) referenced by `shapeIndex`.
   */
  shapes: Array<string>
  /**
   * `[x, y, z, categoryCode, nameIndex, yawQuadrant, variantIndex]` —
   * category 0 floor, 1 wall, 2 ceiling, 3 other; `nameIndex` points into
   * `trapNames`, `variantIndex` into `trapVariants`. Floor and ceiling traps
   * use the edge-origin convention and move half a tile forward; wall traps
   * sit directly on the saved wall plane.
   */
  traps: Array<[number, number, number, number, number, number, number?]>
  /** Trap display names referenced by the dots' `nameIndex`. */
  trapNames: Array<string>
  /** `OutpostTrap.id` of each dot's variant, referenced by `variantIndex`. */
  trapVariants?: Array<string>
  /**
   * World actors the save records alongside the player's build — trees,
   * rocks, loot containers and the map's own building pieces that the game
   * tracks per zone. `[x, y, z, kindCode, yawDegrees, scale, nameIndex]`.
   * Kind: 0 tree, 1 rock, 2 container/plant, 3 world structure, 4 other.
   */
  props: Array<[number, number, number, number, number, number, number]>
  /** World actor class names (`Tree_Pine_02`, `Prop_Rocks_07` …). */
  propNames: Array<string>
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
      created?: string
      items?: Record<
        string,
        {
          attributes?: {
            cloud_save_info?: {
              saveCount?: number
              /** Each zone keeps two archives, `_a0` and `_a1`; this names the current one. */
              savedRecords?: Array<{
                archiveNumber?: number
                recordFilename?: string
                recordIndex?: number
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
      updated?: string
    }
  }>
}

/** One file from `cloudstorage/user/{accountId}` — only the fields read here. */
export type CloudStorageUserFile = {
  filename?: string
  length?: number
  uniqueFilename?: string
  uploaded?: string
}
