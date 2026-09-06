import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { applyBuildUVs, buildPieceMesh } from './-blueprint-build-meshes'

const fallback = () => new THREE.BoxGeometry(0.1, 0.75, 1)

describe('buildPieceMesh', () => {
  it.each(['Solid', 'Floor', 'StairW', 'RoofC'])(
    'produces valid, bounded %s meshes for every material and upgrade tier',
    (shape) => {
      for (const material of [0, 1, 2]) {
        for (const tier of [1, 2, 3]) {
          const mesh = buildPieceMesh(shape, material, tier, fallback)
          const positions = mesh.getAttribute('position')

          for (const attribute of ['position', 'normal', 'uv', 'color']) {
            const data = mesh.getAttribute(attribute)

            expect(data.count).toBe(positions.count)
            expect(Array.from(data.array).every(Number.isFinite)).toBe(true)
          }
          mesh.computeBoundingBox()
          const size = mesh.boundingBox!.getSize(new THREE.Vector3())

          expect(size.x).toBeGreaterThan(0)
          expect(size.y).toBeGreaterThan(0)
          expect(size.z).toBeGreaterThan(0)
          expect(size.x).toBeLessThan(1.2)
          expect(size.z).toBeLessThan(1.2)
          mesh.dispose()
        }
      }
    }
  )

  it('preserves edit geometry and openings instead of substituting a solid wall', () => {
    const original = new THREE.BoxGeometry(0.1, 0.3, 0.4)
    const originalPositions = Array.from(original.getAttribute('position').array)
    const edited = vi.fn(() => original)
    const mesh = buildPieceMesh('WindowC', 0, 3, edited)

    expect(edited).toHaveBeenCalledOnce()
    expect(mesh).toBe(original)
    expect(Array.from(mesh.getAttribute('position').array)).toEqual(originalPositions)
    mesh.dispose()
  })

  it('changes construction between materials and reinforces upgraded wood', () => {
    const wood = buildPieceMesh('Solid', 0, 1, fallback)
    const reinforced = buildPieceMesh('Solid', 0, 3, fallback)
    const brick = buildPieceMesh('Solid', 1, 1, fallback)
    const metal = buildPieceMesh('Solid', 2, 1, fallback)

    expect(reinforced.getAttribute('position').count)
      .toBeGreaterThan(wood.getAttribute('position').count)
    expect(new Set([wood, brick, metal].map((mesh) => mesh.getAttribute('position').count)).size)
      .toBe(3)
    ;[wood, reinforced, brick, metal].forEach((mesh) => mesh.dispose())
  })

  it('keeps stairs rising toward negative local X with visible horizontal treads', () => {
    const geometry = buildPieceMesh('StairW', 0, 1, fallback)
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geometry, material)
    const heightAt = (x: number) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 2, 0), new THREE.Vector3(0, -1, 0))

      return ray.intersectObject(mesh)[0]?.point.y
    }

    expect(heightAt(0.06)).toBeCloseTo(0.75)
    expect(heightAt(0.94)).toBeCloseTo(0.0625)
    expect(heightAt(0.93)).toBeCloseTo(heightAt(0.95)!)
    geometry.dispose()
    material.dispose()
  })
})

describe('applyBuildUVs', () => {
  it('maps wall height vertically without collapsing either wall face', () => {
    const geometry = applyBuildUVs(fallback())
    const uv = geometry.getAttribute('uv')

    // BoxGeometry's first four vertices are the +X wall face.
    expect(new Set([0, 1, 2, 3].map((index) => uv.getX(index))).size).toBe(2)
    expect(new Set([0, 1, 2, 3].map((index) => uv.getY(index))).size).toBe(2)
    geometry.dispose()
  })
})
