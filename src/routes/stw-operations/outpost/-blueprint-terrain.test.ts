import type { OutpostZoneTerrain } from '../../../config/constants/outpost-zones'

import { describe, expect, it } from 'vitest'

import {
  CELL_GRASS,
  CELL_LAVA,
  CELL_ROCK,
  CELL_SEA,
  buildZoneHeightGrid,
  zonePropsAsLayout,
} from './-blueprint-terrain'

const terrain: OutpostZoneTerrain = {
  bounds: { maxX: 5, maxY: 5, minX: 0, minY: 0 },
  cell: 512,
  floors: [
    [0, 0, 0, 0.5, 0.5],
    [0, 1, 0, 0.5, 0.5],
    [1, 0, 0.75, 0.5, 0.5],
  ],
  lava: [[5, 5, 0.75, 1, 1]],
  props: [
    [0, 0, 0, 0, 45, 1.2],
    [1, 1, 0, 1, 0, 1],
  ],
  /* A two-cell wide cliff piece: its footprint must cover both cells. */
  rocks: [[1, 1.5, 1.75, 0.5, 1]],
  shore: [],
  source: 'test',
  spawn: null,
  waterZ: -0.75,
  zoneId: 'pve_04',
}

describe('buildZoneHeightGrid', () => {
  const grid = buildZoneHeightGrid(terrain)
  const at = (x: number, y: number) => {
    const i = (x - grid.minX) * grid.cols + (y - grid.minY)

    return { height: grid.heights[i], kind: grid.kinds[i] }
  }

  it('splats floor tiles at their height', () => {
    expect(at(0, 0)).toEqual({ height: 0, kind: CELL_GRASS })
    expect(at(1, 0)).toEqual({ height: 0.75, kind: CELL_GRASS })
  })

  it('uses the tile top height and covers its whole footprint', () => {
    expect(at(1, 1)).toEqual({ height: 1.75, kind: CELL_ROCK })
    expect(at(1, 2)).toEqual({ height: 1.75, kind: CELL_ROCK })
    expect(at(5, 5).kind).toBe(CELL_LAVA)
  })

  it('drops unfilled fringe cells to the seabed', () => {
    const corner = at(grid.minX, grid.minY)

    expect(corner.kind).toBe(CELL_SEA)
    expect(corner.height).toBeLessThan(terrain.waterZ)
  })
})

describe('zonePropsAsLayout', () => {
  it('drops zone props the save already records', () => {
    const { props } = zonePropsAsLayout(terrain, [[0.2, 0.1, 0, 0, 0, 1, 0]])

    expect(props).toHaveLength(1)
    expect(props[0].slice(0, 4)).toEqual([1, 1, 0, 1])
  })

})
