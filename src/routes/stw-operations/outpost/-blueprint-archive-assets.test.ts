import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import collision from '../../../../assets/outpost-game/build-collision.json'
import { archiveBuildMesh, archiveBuildSurface, hasArchiveMesh } from './-blueprint-archive-assets'
import { buildPieceMesh } from './-blueprint-build-meshes'
import { structureCentre, trapCentre } from './-blueprint-geometry'

function hitsWall(shape: string, height: number, across: number) {
  const geometry = archiveBuildMesh(shape, 1, 3)!
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.Mesh(geometry, material)
  const ray = new THREE.Raycaster(new THREE.Vector3(2, height, across), new THREE.Vector3(-1, 0, 0))
  const hit = ray.intersectObject(mesh).length > 0

  geometry.dispose()
  material.dispose()

  return hit
}

describe('archive collision geometry', () => {
  it('uses only the six supplied material/tier/shape combinations', () => {
    expect(Object.keys(collision)).toHaveLength(6)
    expect(hasArchiveMesh('Archway', 1, 3)).toBe(true)
    expect(archiveBuildMesh('Archway', 0, 3)).toBeNull()
    expect(archiveBuildMesh('Archway', 1, 1)).toBeNull()
    expect(archiveBuildMesh('Missing', 1, 3)).toBeNull()
  })

  it('preserves the arch opening and side-door opening', () => {
    expect(hitsWall('Archway', 0.2, 0)).toBe(false)
    expect(hitsWall('Archway', 0.7, 0)).toBe(true)
    expect(hitsWall('Archway', 0.2, 0.46)).toBe(true)
    expect(hitsWall('DoorS', 0.2, 0.25)).toBe(false)
    expect(hitsWall('DoorS', 0.2, -0.3)).toBe(true)
  })

  it('renders QuarterWallS as the low full-width wall found in the archive', () => {
    const mesh = archiveBuildMesh('QuarterWallS', 1, 3)!

    mesh.computeBoundingBox()
    expect(mesh.boundingBox!.max.y).toBeCloseTo(0.185, 2)
    expect(mesh.boundingBox!.max.z - mesh.boundingBox!.min.z).toBeCloseTo(1)
    expect(hitsWall('QuarterWallS', 0.1, 0.35)).toBe(true)
    expect(hitsWall('QuarterWallS', 0.4, 0)).toBe(false)
    mesh.dispose()
  })

  it('keeps native roof and balcony edge pivots without adding another half tile', () => {
    const roof = buildPieceMesh('RoofC', 1, 1, () => { throw new Error('Unexpected fallback') })
    const balcony = archiveBuildMesh('BalconyS', 1, 3)!

    roof.computeBoundingBox()
    balcony.computeBoundingBox()
    expect(roof.boundingBox!.min.x).toBeCloseTo(0, 3)
    expect(roof.boundingBox!.max.x).toBeCloseTo(1, 3)
    expect(roof.boundingBox!.max.y).toBeCloseTo(0.391, 2)
    expect(balcony.boundingBox!.min.x).toBeCloseTo(0.5, 3)
    expect(balcony.boundingBox!.max.x).toBeCloseTo(1, 2)
    roof.dispose()
    balcony.dispose()
  })

  // Saves put floors and edge-pivoted traps on half-cell edge midpoints.
  it.each([0, 1, 2, 3])('aligns a generated floor and floor trap at yaw %i', (yaw) => {
    const geometry = buildPieceMesh('Floor', 0, 1, () => new THREE.BoxGeometry())
    const expected = structureCentre([0.5, 0.5, 0, 0, 0, yaw, 0, 1])

    expect(expected).toEqual(trapCentre([0.5, 0.5, 0, 0, 0, yaw]))
    geometry.rotateY(-yaw * Math.PI / 2)
    geometry.computeBoundingBox()
    const centre = geometry.boundingBox!.getCenter(new THREE.Vector3())

    expect(centre.x).toBeCloseTo(expected.y - 0.5)
    expect(centre.z).toBeCloseTo(-(expected.x - 0.5))
    geometry.dispose()
  })

  it('keeps centre-saved floor traps (anti-air) on their tile centre', () => {
    expect(trapCentre([3, -2, 1, 0, 0, 1])).toEqual({ x: 3, y: -2, z: 1 })
  })
})

describe('archive surfaces', () => {
  it('selects authored brick floor/wall surfaces and tier-3 stone', () => {
    expect(archiveBuildSurface(1, 1, 0)?.color).toContain('brick-floor')
    expect(archiveBuildSurface(1, 1, 1)?.normal).toContain('brick-wall-normal')
    expect(archiveBuildSurface(1, 3, 1)?.color).toContain('stone-tier3')
    expect(archiveBuildSurface(0, 1, 1)?.color).toContain('wood-planks')
    expect(archiveBuildSurface(2, 3, 1)).toBeNull()
  })
})
