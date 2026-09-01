import type { OutpostLayout } from '../../../kernel/core/outpost-types'

/**
 * Shared spatial conventions for the 2D blueprint and both 3D explorers.
 *
 * Fortnite stores a build piece at the midpoint of one of its tile's edges
 * and points the actor's Y axis (yaw 0) across the tile, so the tile centre
 * is half a cell along that forward axis. Yaw advances in 90° steps rotating
 * +X toward +Y. Walls stand on the edge itself; floors, stairs, roofs and
 * every edited variant fill the tile in front of it.
 */

export const KIND_FLOOR = 0
export const KIND_WALL = 1
export const KIND_STAIR = 2
export const KIND_ROOF = 3
export const KIND_OTHER = 4

export const TRAP_FLOOR = 0
export const TRAP_WALL = 1
export const TRAP_CEILING = 2

export const PROP_TREE = 0
export const PROP_ROCK = 1
export const PROP_CONTAINER = 2
export const PROP_STRUCTURE = 3

export const PROP_KIND_LABEL = [
  'Tree',
  'Rock',
  'Container',
  'World structure',
  'Prop',
]

export type StructureTuple = OutpostLayout['structures'][number]
export type TrapTuple = OutpostLayout['traps'][number]
export type PropTuple = OutpostLayout['props'][number]

/** World-space forward unit vector for a yaw quadrant. */
export function forwardVector(yaw: number): [number, number] {
  switch (((Math.round(yaw) % 4) + 4) % 4) {
    case 0:
      return [0, 1]
    case 1:
      return [-1, 0]
    case 2:
      return [0, -1]
    default:
      return [1, 0]
  }
}

/** Offset from a piece's origin (edge midpoint) to the centre of its tile. */
export function tileCentreOffset(yaw: number): [number, number] {
  const [dx, dy] = forwardVector(yaw)

  return [dx * 0.5, dy * 0.5]
}

/**
 * Where a piece visually sits: walls on their edge, everything else centred
 * on the tile in front of the origin.
 */
export function structureCentre(
  piece: StructureTuple
): { x: number; y: number; z: number } {
  const [x, y, z, , kind, yaw] = piece

  if (kind === KIND_WALL) return { x, y, z }

  const [dx, dy] = tileCentreOffset(yaw)

  return { x: x + dx, y: y + dy, z }
}

/**
 * Where a trap visually sits: floor and ceiling traps on the tile in front
 * of the origin (they attach to a floor piece with the same origin rule),
 * wall traps on the wall's edge.
 */
export function trapCentre(
  trap: TrapTuple
): { x: number; y: number; z: number } {
  const [x, y, z, category, , yaw = 0] = trap

  if (category === TRAP_WALL) return { x, y, z }

  const [dx, dy] = tileCentreOffset(yaw)

  return { x: x + dx, y: y + dy, z }
}

/** Human-friendly label for a world actor class name. */
export function propLabel(className: string) {
  return className
    .replace(/_C$/, '')
    .replace(/^(?:Prop|SM|Tiered)_/i, '')
    .replace(/_(?:Parent|Child)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Height (in cells) of one Fortnite build storey: 384 world units. */
export const STOREY_HEIGHT = 0.75

/** Trees split into conifers and broadleaf for the stylised silhouettes. */
export function isConifer(className: string) {
  return /pine|conifer|spruce|fir|joshua|cactus/i.test(className)
}

/** Shrubs and plants render as bushes rather than loot boxes. */
export function isPlant(className: string) {
  return /shrub|plant|bush|grass|flower/i.test(className)
}
