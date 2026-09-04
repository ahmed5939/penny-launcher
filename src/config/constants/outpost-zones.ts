import pve04 from './outpost-zones/pve_04.json'

/**
 * Terrain layouts for Storm Shield zones, extracted from the game's level
 * packages by `scripts/extract-outpost-zone.mjs`. Coordinates are build
 * cells in the same world space the zone's `.sav` uses, so a scanned base
 * lands on this terrain with no calibration. Only positions and kind codes
 * are stored — the explorer builds its own geometry from them.
 */
export type OutpostZoneTerrain = {
  /** Whole-cell bounds of the terrain tiles. */
  bounds: { maxX: number; maxY: number; minX: number; minY: number }
  /** World units per cell — always Fortnite's 512. */
  cell: number
  /**
   * Walkable surface tiles as `[x, y, topZ, halfX, halfY]` — the centre of
   * the footprint the tile covers, the height of its top surface, and its
   * half-extents in cells. All three come from the mesh's own bounds turned
   * by the actor's yaw, so multi-cell pieces cover what they really occupy.
   */
  floors: Array<Array<number>>
  /** Lava surfaces, same tuple shape as `floors`. */
  lava: Array<Array<number>>
  /** Vegetation and boulders: `[x, y, z, kindCode, yawDegrees, scale]`. */
  props: Array<Array<number>>
  /** Cliff and cave-wall tiles — vertical rock, same shape as `floors`. */
  rocks: Array<Array<number>>
  /** Beach edge tiles, same shape as `floors`. */
  shore: Array<Array<number>>
  /** Level package the data came from. */
  source: string
  /** The player spawn point next to the storm shield, when found. */
  spawn: Array<number> | null
  /** Sea level in cells — shoreline tiles sit at this height. */
  waterZ: number
  zoneId: string
}

export const OUTPOST_ZONE_TERRAIN: Record<string, OutpostZoneTerrain> = {
  pve_04: pve04 as OutpostZoneTerrain,
}
