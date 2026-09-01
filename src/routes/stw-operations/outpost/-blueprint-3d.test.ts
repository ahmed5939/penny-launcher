import type { OutpostLayout } from '../../../kernel/core/outpost-types'

import { describe, expect, it } from 'vitest'

import { outpostHeightLevels } from './-blueprint-3d'
import { projectOutpostPoint } from './-blueprint-canvas-3d'

describe('outpostHeightLevels', () => {
  it('returns sorted, unique structure and trap heights', () => {
    const layout: OutpostLayout = {
      bounds: {
        maxX: 2,
        maxY: 2,
        maxZ: 1,
        minX: 0,
        minY: 0,
        minZ: -1,
      },
      cell: 512,
      propNames: ['Tree_04'],
      props: [[5, 5, 3, 0, 12, 1, 0]],
      shapes: ['Floor', 'Solid'],
      structures: [
        [0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 0.75, 1, 1, 1, 1, 3],
      ],
      trapNames: ['Wall Darts'],
      traps: [
        [1, 1, -1, 1, 0, 0],
        [2, 2, 0.75, 1, 0, 2],
      ],
    }

    /* World props do not add height levels — they are scenery, not storeys. */
    expect(outpostHeightLevels(layout)).toEqual([-1, 0, 0.75])
  })
})

describe('projectOutpostPoint', () => {
  it('keeps height visible in the isometric fallback', () => {
    const ground = projectOutpostPoint(
      { x: 0, y: 0, z: 0 },
      { pitch: Math.PI / 4, yaw: 0 }
    )
    const above = projectOutpostPoint(
      { x: 0, y: 1, z: 0 },
      { pitch: Math.PI / 4, yaw: 0 }
    )

    expect(above.y).toBeLessThan(ground.y)
    expect(above.depth).toBeGreaterThan(ground.depth)
  })
})
