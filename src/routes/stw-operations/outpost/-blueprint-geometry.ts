import type { OutpostLayout } from '../../../kernel/core/outpost-types'

/**
 * Shared spatial conventions for the 2D blueprint and both 3D explorers.
 *
 * Fortnite stores each build piece at its own pivot: floors, stairs and roofs
 * use the tile centre, while walls use the centre of their wall plane. Yaw
 * advances in 90° steps rotating +X toward +Y.
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

/** The saved actor pivot is already the visual centre of every build piece. */
export function structureCentre(
  piece: StructureTuple
): { x: number; y: number; z: number } {
  const [x, y, z] = piece

  return { x, y, z }
}

/**
 * Floor and ceiling trap actors use a tile-edge origin; wall traps already
 * sit at the centre of their supporting wall plane.
 */
export function trapCentre(
  trap: TrapTuple
): { x: number; y: number; z: number } {
  const [x, y, z, category, , yaw = 0] = trap

  if (category === TRAP_WALL) return { x, y, z }

  const [dx, dy] = forwardVector(yaw)

  return { x: x + dx * 0.5, y: y + dy * 0.5, z }
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
