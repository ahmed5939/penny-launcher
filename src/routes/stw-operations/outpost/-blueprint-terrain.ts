import type { OutpostZoneTerrain } from '../../../config/constants/outpost-zones'

/**
 * Turns a zone's extracted tile layout into a renderable heightfield. The
 * tiles are point samples (one per terrain actor); this rasterises them
 * onto a one-cell grid, classifies each cell, and fills the gaps between
 * samples so the island reads as a continuous surface. Everything here is
 * geometry-library agnostic — the 3D explorer lifts the grid into meshes,
 * the 2D blueprint paints it into a bitmap.
 */

export const CELL_EMPTY = 0
export const CELL_GRASS = 1
export const CELL_SAND = 2
export const CELL_ROCK = 3
export const CELL_LAVA = 4
export const CELL_SEA = 5

export type ZoneHeightGrid = {
  /** Cell x of column 0 / cell y of row 0. */
  minX: number
  minY: number
  /** Grid dimensions: `cols` along y, `rows` along x. */
  cols: number
  rows: number
  /** Surface height in cells, row-major by x then y. */
  heights: Float32Array
  /** CELL_* classification per cell, same indexing. */
  kinds: Uint8Array
  /** Sea level in cells. */
  waterZ: number
}

const MARGIN = 3
/** How far under sea level the unfilled seabed sits. */
const SEA_DEPTH = 1.6

export function buildZoneHeightGrid(terrain: OutpostZoneTerrain): ZoneHeightGrid {
  const minX = terrain.bounds.minX - MARGIN
  const minY = terrain.bounds.minY - MARGIN
  const rows = terrain.bounds.maxX - terrain.bounds.minX + 1 + MARGIN * 2
  const cols = terrain.bounds.maxY - terrain.bounds.minY + 1 + MARGIN * 2
  const heights = new Float32Array(rows * cols).fill(Number.NEGATIVE_INFINITY)
  const kinds = new Uint8Array(rows * cols)
  const index = (x: number, y: number) => (x - minX) * cols + (y - minY)
  const inGrid = (x: number, y: number) =>
    x >= minX && x < minX + rows && y >= minY && y < minY + cols

  /**
   * Raise every cell a tile's footprint covers to that tile's top surface.
   * The footprint and height are exact — they come from the mesh bounds the
   * extractor read — so no guessing about how tall a cliff piece stands.
   */
  const splat = (tile: Array<number>, kind: number) => {
    const [x, y, top, halfX = 0.5, halfY = 0.5] = tile
    /* Half a cell of reach so a tile always claims the cell it sits on. */
    const reachX = Math.max(halfX, 0.5)
    const reachY = Math.max(halfY, 0.5)

    for (let cx = Math.ceil(x - reachX); cx <= Math.floor(x + reachX); cx++) {
      for (let cy = Math.ceil(y - reachY); cy <= Math.floor(y + reachY); cy++) {
        if (!inGrid(cx, cy)) continue

        const i = index(cx, cy)

        if (top > heights[i]) {
          heights[i] = top
          kinds[i] = kind
        }
      }
    }
  }

  for (const floor of terrain.floors) splat(floor, CELL_GRASS)
  for (const rock of terrain.rocks) splat(rock, CELL_ROCK)
  for (const shore of terrain.shore) splat(shore, CELL_SAND)

  /*
   * Lava paints the cells around each lava actor, but only where the
   * surface actually sits at the pool's level — a plateau overlooking the
   * caldera keeps its rock.
   */
  for (const lava of terrain.lava) {
    const [x, y, z, halfX = 1.5, halfY = 1.5] = lava

    for (let cx = Math.ceil(x - halfX); cx <= Math.floor(x + halfX); cx++) {
      for (let cy = Math.ceil(y - halfY); cy <= Math.floor(y + halfY); cy++) {
        if (!inGrid(cx, cy)) continue

        const i = index(cx, cy)

        if (heights[i] === Number.NEGATIVE_INFINITY) heights[i] = z
        else if (Math.abs(heights[i] - z) > 1.2) continue
        kinds[i] = CELL_LAVA
      }
    }
  }

  /*
   * Close small gaps between tile samples: a few passes of neighbour
   * averaging, inheriting the tallest neighbour's kind so cliffs stay
   * rocky and beaches sandy. Whatever is still empty afterwards is open
   * sea around the island.
   */
  for (let pass = 0; pass < 3; pass++) {
    const snapshot = heights.slice()

    for (let x = minX; x < minX + rows; x++) {
      for (let y = minY; y < minY + cols; y++) {
        const i = index(x, y)

        if (snapshot[i] !== Number.NEGATIVE_INFINITY) continue

        let sum = 0
        let found = 0
        let bestHeight = Number.NEGATIVE_INFINITY
        let bestKind = CELL_GRASS

        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!inGrid(x + dx, y + dy)) continue

          const n = index(x + dx, y + dy)

          if (snapshot[n] === Number.NEGATIVE_INFINITY) continue
          sum += snapshot[n]
          found += 1

          if (snapshot[n] > bestHeight) {
            bestHeight = snapshot[n]
            bestKind = kinds[n]
          }
        }

        if (found >= 2) {
          heights[i] = sum / found
          kinds[i] = bestKind
        }
      }
    }
  }

  for (let i = 0; i < heights.length; i++) {
    if (heights[i] === Number.NEGATIVE_INFINITY) {
      heights[i] = terrain.waterZ - SEA_DEPTH
      kinds[i] = CELL_SEA
    }
  }

  return { cols, heights, kinds, minX, minY, rows, waterZ: terrain.waterZ }
}

/** Flat colours per cell kind, shared by the 3D surface and the 2D bitmap. */
export const CELL_COLORS: Record<number, [number, number, number]> = {
  [CELL_EMPTY]: [62, 82, 55],
  [CELL_GRASS]: [73, 103, 61],
  [CELL_SAND]: [166, 143, 91],
  [CELL_ROCK]: [82, 74, 71],
  [CELL_LAVA]: [255, 83, 24],
  [CELL_SEA]: [38, 79, 95],
}

/** Deterministic per-cell shade so large fields do not look flat. */
export function cellShade(x: number, y: number) {
  const hash = Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 0

  return 0.9 + (hash % 1000) / 5000
}

/**
 * A top-down bitmap of the zone for the 2D blueprint, drawn one cell per
 * pixel block. Returns null outside a browser (tests, SSR).
 */
export function zoneTerrainImage(terrain: OutpostZoneTerrain) {
  if (typeof document === 'undefined') return null

  const grid = buildZoneHeightGrid(terrain)
  const scale = 6
  const canvas = document.createElement('canvas')

  /* Blueprint axes: x → world y (columns), y → −world x (rows flipped). */
  canvas.width = grid.cols * scale
  canvas.height = grid.rows * scale

  const context = canvas.getContext('2d')

  if (!context) return null

  const zMin = Math.min(...grid.heights)
  const zMax = Math.max(...grid.heights)

  for (let x = grid.minX; x < grid.minX + grid.rows; x++) {
    for (let y = grid.minY; y < grid.minY + grid.cols; y++) {
      const i = (x - grid.minX) * grid.cols + (y - grid.minY)
      const [r, g, b] = CELL_COLORS[grid.kinds[i]] ?? CELL_COLORS[CELL_GRASS]
      /* Higher ground reads brighter, like a lit relief map. */
      const relief =
        0.72 + 0.5 * ((grid.heights[i] - zMin) / Math.max(1, zMax - zMin))
      const shade = cellShade(x, y) * relief

      context.fillStyle = `rgb(${Math.min(255, Math.round(r * shade))}, ${Math.min(255, Math.round(g * shade))}, ${Math.min(255, Math.round(b * shade))})`
      context.fillRect(
        (y - grid.minY) * scale,
        (grid.minX + grid.rows - 1 - x) * scale,
        scale,
        scale
      )
    }
  }

  return {
    href: canvas.toDataURL('image/png'),
    /* Extent in blueprint coordinates (x = world y, y = −world x). */
    rect: {
      height: grid.rows,
      width: grid.cols,
      x: grid.minY - 0.5,
      y: -(grid.minX + grid.rows) + 0.5,
    },
  }
}

/**
 * Zone props as `OutpostLayout['props']` tuples so the explorer renders
 * them through the same silhouette pipeline as the save's world actors.
 * Props the save already records (it stores the modified ones) are dropped
 * so a harvested tree is not drawn twice.
 */
export function zonePropsAsLayout(
  terrain: OutpostZoneTerrain,
  saveProps: Array<Array<number>>
): { names: Array<string>; props: Array<[number, number, number, number, number, number, number]> } {
  const names = ['Palm_Tree', 'Prop_Rocks', 'Plant_Shrub', 'World', 'Prop']
  const taken = saveProps.map(([x, y]) => [x, y])
  const props: Array<[number, number, number, number, number, number, number]> = []

  for (const [x, y, z, kind, yaw, scale] of terrain.props) {
    if (taken.some(([sx, sy]) => Math.abs(sx - x) < 0.8 && Math.abs(sy - y) < 0.8)) {
      continue
    }

    props.push([x, y, z, kind, yaw, scale || 1, Math.min(kind, 4)])
  }

  return { names, props }
}
