import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import twineZone from '../../../config/constants/outpost-zones/pve_04.json'
import type { OutpostZoneTerrain } from '../../../config/constants/outpost-zones'

import { TWINE_TERRAIN, twineInstanceMatrix, twineOceanGeometry, twinePlacementGeometry, twineTerrainGeometry } from './-blueprint-twine-terrain'

describe('recovered Twine terrain', () => {
  it('contains the map placements rather than a handful of sample meshes', () => {
    expect(TWINE_TERRAIN.instances.length).toBeGreaterThan(3500)
    expect(TWINE_TERRAIN.models.filter((m) => m.source === 'collision').length).toBeGreaterThan(65)
    for (const instance of TWINE_TERRAIN.instances) {
      expect(instance).toHaveLength(11)
      expect(instance.every(Number.isFinite)).toBe(true)
      expect(TWINE_TERRAIN.models[instance[0]]).toBeDefined()
      expect(Math.hypot(...instance.slice(4, 8))).toBeCloseTo(1, 5)
    }
  })

  it('preserves a known cliff actor position in the scene coordinate system', () => {
    // S_Cliff_1x1_A101_458 has UE location (-18432, 18944, -768).
    const index = TWINE_TERRAIN.models.findIndex((m) => m.name === 'S_Cliff_1x1_A')
    const instance = TWINE_TERRAIN.instances.find((p) => p[0] === index && p[1] === 37 && p[2] === -1.5 && p[3] === 36)

    expect(instance).toBeDefined()
  })

  it('resolves renamed actors through mesh references and retains the lava field', () => {
    // S_Cave_Ceiling12 actually references S_Cave_Outer_Concave.
    const index = TWINE_TERRAIN.models.findIndex((m) => m.name === 'S_Cave_Outer_Concave')

    expect(TWINE_TERRAIN.instances.some((p) => p[0] === index && p[1] === 24 && p[2] === -2.25 && p[3] === -1)).toBe(true)
    expect(TWINE_TERRAIN.instances.filter((p) => TWINE_TERRAIN.models[p[0]].kind === 'lava').length).toBeGreaterThan(150)
  })

  it('retains vertical cliff faces instead of bridging them into slopes', () => {
    const model = TWINE_TERRAIN.models.find((m) => m.name === 'S_Cliff_1x1_A')!
    const geometry = twineTerrainGeometry(model)
    const normals = geometry.getAttribute('normal')

    expect(Array.from({ length: normals.count }, (_, i) => Math.abs(normals.getY(i)))
      .some((y) => y < 0.1)).toBe(true)
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(0.5)
    geometry.dispose()
  })

  it('does not seal an unrecoverable cave entrance with a bounds box', () => {
    expect(TWINE_TERRAIN.models.some((m) => m.name === 'S_Cave_Entrance')).toBe(false)
    expect(TWINE_TERRAIN.models.some((m) => m.name === 'S_Cave_Ceiling' && m.source === 'collision')).toBe(true)
  })

  it('keeps reflected cliff faces outward with positive instance scales', () => {
    const model = TWINE_TERRAIN.models.find((m) => m.name === 'S_Cliff_1x1_A')!
    const original = twineTerrainGeometry(model)
    const mirrored = twinePlacementGeometry(model, [0, 0, 0, 0, 0, 0, 0, 1, -1, 1, 1])
    const normals = original.getAttribute('normal')
    const reflected = mirrored.getAttribute('normal')

    for (let i = 0; i < normals.count; i += 3) {
      expect(reflected.getX(i)).toBeCloseTo(-normals.getX(i), 5)
      expect(reflected.getY(i)).toBeCloseTo(normals.getY(i), 5)
      expect(reflected.getZ(i)).toBeCloseTo(normals.getZ(i), 5)
    }
    original.dispose()
    mirrored.dispose()
  })

  it('produces finite geometry, UVs and valid material ranges for every mesh', () => {
    for (const model of TWINE_TERRAIN.models) {
      const geometry = twineTerrainGeometry(model)
      const count = geometry.getAttribute('position').count

      expect(count % 3).toBe(0)
      for (const name of ['position', 'normal', 'uv']) {
        const attribute = geometry.getAttribute(name)

        expect(attribute.count).toBe(count)
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
      }
      expect(geometry.groups.reduce((total, group) => total + group.count, 0)).toBe(count)
      expect(geometry.groups.every((g) => g.materialIndex! >= 0 && g.materialIndex! < 4)).toBe(true)
      geometry.dispose()
    }
  })
})

describe('twineInstanceMatrix', () => {
  it('applies nonuniform scale, yaw and translation without snapping rotations', () => {
    const half = Math.SQRT1_2
    const matrix = twineInstanceMatrix([0, 10, 20, 30, 0, -half, 0, half, 2, 1, 3])
    const point = new THREE.Vector3(1, 0, 0).applyMatrix4(matrix)

    expect(point.x).toBeCloseTo(10)
    expect(point.y).toBeCloseTo(20)
    expect(point.z).toBeCloseTo(32)
  })
})


describe('twineOceanGeometry', () => {
  it('excludes the recovered lava surfaces that the legacy grid missed', () => {
    const geometry = twineOceanGeometry(twineZone)
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    const water = new THREE.Mesh(geometry, material)
    const instance = TWINE_TERRAIN.instances.find((p) => TWINE_TERRAIN.models[p[0]].name === 'SM_Volcano_Lava_Plane')!
    const lava = twineTerrainGeometry(TWINE_TERRAIN.models[instance[0]])

    lava.computeBoundingBox()
    const center = lava.boundingBox!.clone().applyMatrix4(twineInstanceMatrix(instance)).getCenter(new THREE.Vector3())
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, 100, center.z), new THREE.Vector3(0, -1, 0))

    expect(ray.intersectObject(water)).toHaveLength(0)
    lava.dispose()
    geometry.dispose()
    material.dispose()
  })

  it('keeps ocean outside an enclosed below-sea caldera', () => {
    const terrain: OutpostZoneTerrain = {
      bounds: { minX: 0, minY: 0, maxX: 30, maxY: 30 },
      cell: 512, waterZ: -3.75, source: 'test', spawn: null, zoneId: 'pve_04',
      floors: [[5, 15, 0, 0.5, 10], [25, 15, 0, 0.5, 10], [15, 5, 0, 10, 0.5], [15, 25, 0, 10, 0.5]],
      rocks: [], shore: [], lava: [], props: [],
    }
    const geometry = twineOceanGeometry(terrain)
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geometry, material)
    const waterAt = (x: number, y: number) => new THREE.Raycaster(
      new THREE.Vector3(y, 10, -x), new THREE.Vector3(0, -1, 0),
    ).intersectObject(mesh).length > 0

    expect(waterAt(0, 0)).toBe(true)
    expect(waterAt(15, 15)).toBe(false)
    expect(waterAt(-8, 15)).toBe(true)
    geometry.dispose()
    material.dispose()
  })
})
