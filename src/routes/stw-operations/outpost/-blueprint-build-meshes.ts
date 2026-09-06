import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { archiveBuildMesh } from './-blueprint-archive-assets'

import { STOREY_HEIGHT } from './-blueprint-geometry'

type Point = [number, number, number]

/** Tile-space UVs keep surfaces at the same scale across slabs and edits. */
export function applyBuildUVs(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const uvs = new Float32Array(positions.count * 2)

  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const nx = Math.abs(normals.getX(index))
    const ny = Math.abs(normals.getY(index))
    const nz = Math.abs(normals.getZ(index))

    // Walls use horizontal Z / vertical Y; decks use horizontal X / Z.
    uvs[index * 2] = (nx >= nz && nx > ny ? z : x) + 0.5
    uvs[index * 2 + 1] = ny >= nx && ny >= nz ? z + 0.5 : y
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  if (!geometry.hasAttribute('color')) {
    const colors = new Float32Array(positions.count * 3)

    colors.fill(1)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }

  return geometry
}

/**
 * Material-specific construction for the common unedited pieces. Edits keep
 * their existing cut-out geometry instead of covering openings with framing.
 * All parts merge into one geometry, reused by an instanced draw per tier.
 */
export function buildPieceMesh(
  shape: string,
  material: number,
  tier: number,
  fallback: () => THREE.BufferGeometry
): THREE.BufferGeometry {
  const recovered = archiveBuildMesh(shape, material, tier)

  if (recovered) return applyBuildUVs(recovered)

  const name = shape.toLowerCase()
  const finish = (geometry: THREE.BufferGeometry) => {
    // Archive Floor/Stair/Roof bounds are centred at local UE Y=256.
    // Generated shapes are centred at zero; restore their tile-edge pivot.
    if (/^(?:floor|stair|roof|balcony)/.test(name)) geometry.translate(0.5, 0, 0)

    return applyBuildUVs(geometry)
  }
  const parts: THREE.BufferGeometry[] = []
  const upgrade = Math.max(1, Math.min(3, tier || 1))
  const wood = material === 0
  const brick = material === 1
  const metal = material === 2
  const wall = name === 'solid'
  const floor = name === 'floor' || name === 'floor_2'
  const stair = name === 'stairw'
  const roof = name === 'roofc'

  if ((!wall && !floor && !stair && !roof) || (!wood && !brick && !metal)) {
    return finish(fallback())
  }

  const box = (width: number, height: number, depth: number, at: Point, shade = 1) => {
    const geometry = new THREE.BoxGeometry(width, height, depth)

    geometry.translate(...at)
    const colors = new Float32Array(geometry.getAttribute('position').count * 3)

    colors.fill(shade)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    parts.push(geometry)

    return geometry
  }
  const beam = (a: Point, b: Point, width: number, shade = 0.72) => {
    const start = new THREE.Vector3(...a)
    const end = new THREE.Vector3(...b)
    const direction = end.clone().sub(start)
    const geometry = box(width, direction.length(), width, [0, 0, 0], shade)

    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), direction.normalize()
    ))
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray())
  }
  const addBase = () => {
    const base = fallback()
    const colors = new Float32Array(base.getAttribute('position').count * 3)

    colors.fill(1)
    base.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    parts.push(base)
  }

  if (wall && wood) {
    // Individual upright planks with small seams and a heavy timber frame.
    for (let plank = 0; plank < 9; plank++) {
      box(0.065, STOREY_HEIGHT - 0.03, 0.104,
        [0, STOREY_HEIGHT / 2, -0.444 + plank / 9], 0.9 + (plank % 3) * 0.06)
    }
    for (const z of [-0.46, 0.46]) {
      box(0.13, STOREY_HEIGHT, 0.075, [0, STOREY_HEIGHT / 2, z], 0.74)
    }
    for (const y of [0.055, STOREY_HEIGHT - 0.055]) {
      box(0.13, 0.075, 0.98, [0, y, 0], 0.78)
    }
    for (const side of [-1, 1]) {
      beam([side * 0.072, 0.12, -0.41], [side * 0.072, 0.64, 0.41], 0.05)
      if (upgrade >= 2) {
        beam([side * 0.074, 0.12, 0.41], [side * 0.074, 0.64, -0.41], 0.045)
      }
    }
    if (upgrade === 3) box(0.15, 0.055, 0.97, [0, STOREY_HEIGHT / 2, 0], 0.7)
  } else if (wall && brick) {
    // Recessed mortar behind staggered masonry, with thicker upgrade courses.
    box(0.075, STOREY_HEIGHT, 1, [0, STOREY_HEIGHT / 2, 0], 0.52)
    const rows = 6
    const depth = 0.105 + upgrade * 0.012

    for (let row = 0; row < rows; row++) {
      for (let column = -1; column < 4; column++) {
        const left = Math.max(-0.5, -0.5 + column * 0.25 + (row % 2) * 0.125)
        const right = Math.min(0.5, -0.25 + column * 0.25 + (row % 2) * 0.125)

        if (right - left <= 0.01) continue
        box(depth, STOREY_HEIGHT / rows - 0.012, right - left - 0.01,
          [0, (row + 0.5) * STOREY_HEIGHT / rows, (left + right) / 2],
          0.85 + ((row * 3 + column + 5) % 4) * 0.05)
      }
    }
    if (upgrade >= 2) {
      for (const z of [-0.45, 0.45]) box(depth + 0.045, STOREY_HEIGHT, 0.1, [0, STOREY_HEIGHT / 2, z], 0.86)
    }
    if (upgrade === 3) box(depth + 0.04, 0.065, 1, [0, STOREY_HEIGHT - 0.0325, 0], 0.78)
  } else if (wall && metal) {
    // Overlapping sheet metal, corrugations and a dark steel skeleton.
    for (let panel = 0; panel < 3; panel++) {
      box(0.055, STOREY_HEIGHT - 0.04, 0.325,
        [panel % 2 ? 0.009 : 0, STOREY_HEIGHT / 2, (panel - 1) / 3], 0.8 + panel * 0.09)
    }
    for (let rib = 0; rib < 15; rib++) {
      box(0.082, STOREY_HEIGHT - 0.05, 0.013, [0, STOREY_HEIGHT / 2, -0.465 + rib * 0.0664], 0.8)
    }
    for (const z of [-0.46, 0, 0.46]) box(0.14, STOREY_HEIGHT, 0.045, [0, STOREY_HEIGHT / 2, z], 0.48)
    for (const y of [0.04, STOREY_HEIGHT - 0.04]) box(0.14, 0.06, 1, [0, y, 0], 0.5)
    if (upgrade >= 2) box(0.15, 0.065, 0.98, [0, STOREY_HEIGHT / 2, 0], 0.55)
    if (upgrade === 3) {
      for (const side of [-1, 1]) beam([side * 0.08, 0.08, -0.43], [side * 0.08, 0.67, 0.43], 0.035, 0.55)
    }
  } else if (floor) {
    const count = wood ? 10 : brick ? 4 : 5

    for (let row = 0; row < count; row++) {
      const columns = brick ? 4 : 1

      for (let column = 0; column < columns; column++) {
        box(0.98 / columns - 0.008, 0.055, 0.98 / count - 0.007,
          [-0.49 + (column + 0.5) * 0.98 / columns, -0.02, -0.49 + (row + 0.5) * 0.98 / count],
          0.88 + ((row + column) % 3) * 0.06)
      }
    }
    for (const z of [-0.43, 0.43]) box(1, 0.085, 0.06, [0, -0.075, z], 0.65)
    if (upgrade >= 2) box(0.075, 0.085, 0.98, [0, -0.075, 0], 0.65)
    if (upgrade === 3) {
      for (const x of [-0.43, 0.43]) box(0.07, 0.085, 0.98, [x, -0.075, 0], 0.65)
    }
  } else if (stair) {
    const steps = 12
    const run = 0.96 / steps

    for (let step = 0; step < steps; step++) {
      const top = (step + 1) * STOREY_HEIGHT / steps

      box(run + 0.008, brick ? top : 0.045, 0.96,
        [0.48 - (step + 0.5) * run, brick ? top / 2 : top - 0.0225, 0],
        0.88 + (step % 3) * 0.06)
    }
    for (const z of [-0.42, 0.42]) {
      beam([0.46, -0.015, z], [-0.46, STOREY_HEIGHT - 0.04, z], 0.075)
    }
    if (upgrade >= 2) beam([0.46, -0.015, 0], [-0.46, STOREY_HEIGHT - 0.04, 0], 0.065)
    if (upgrade === 3) {
      for (const z of [-0.42, 0.42]) beam([-0.44, 0, z], [-0.44, STOREY_HEIGHT - 0.045, z], 0.07)
    }
  } else {
    addBase()
    for (const [x, z] of [[-0.46, -0.46], [-0.46, 0.46], [0.46, -0.46], [0.46, 0.46]]) {
      beam([x, 0.015, z], [0, 0.51, 0], wood ? 0.055 : 0.035)
    }
    if (upgrade >= 2) {
      for (const z of [-0.46, 0.46]) beam([-0.46, 0.015, z], [0.46, 0.015, z], 0.045)
      for (const x of [-0.46, 0.46]) beam([x, 0.015, -0.46], [x, 0.015, 0.46], 0.045)
    }
  }

  // Extrusions are non-indexed; boxes must match before merging roof parts.
  const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part)
  const merged = mergeGeometries(normalized, false)

  normalized.forEach((part) => part.dispose())
  parts.forEach((part, index) => { if (part !== normalized[index]) part.dispose() })

  return finish(merged ?? fallback())
}
