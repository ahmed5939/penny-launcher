import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import {
  PROP_CONTAINER,
  PROP_ROCK,
  PROP_STRUCTURE,
  PROP_TREE,
  STOREY_HEIGHT,
  isConifer,
  isPlant,
} from './-blueprint-geometry'

/**
 * Stylised stand-ins for the map's own actors — the save only carries their
 * class names and transforms, not meshes, so low-poly silhouettes do the
 * job: layered conifers, clumped broadleaf canopies, faceted boulders,
 * bushes, loot crates and slabs of the world's pre-built structures.
 */

export type PropStyle = {
  color: number
  geometry: () => THREE.BufferGeometry
  /** Flat-shaded facets for the low-poly look. */
  faceted?: boolean
  /** How far each instance's tint may wander, 0–1. */
  variation?: number
}

function translated(geometry: THREE.BufferGeometry, y: number) {
  geometry.translate(0, y, 0)

  return geometry
}

/** Deterministic noise so rocks and canopies look the same every visit. */
function hash3(x: number, y: number, z: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453

  return value - Math.floor(value)
}

/** Pushes vertices in and out along their direction from the origin. */
function roughen(geometry: THREE.BufferGeometry, amount: number, seed: number) {
  const merged = geometry.index ? geometry.toNonIndexed() : geometry
  const positions = merged.getAttribute('position')
  const vertex = new THREE.Vector3()
  const offsets = new Map<string, number>()

  for (let index = 0; index < positions.count; index++) {
    vertex.fromBufferAttribute(positions, index)
    // Shared corners must move together or the surface tears.
    const key = `${vertex.x.toFixed(3)},${vertex.y.toFixed(3)},${vertex.z.toFixed(3)}`
    let offset = offsets.get(key)

    if (offset === undefined) {
      offset = 1 + (hash3(vertex.x + seed, vertex.y, vertex.z) - 0.5) * amount
      offsets.set(key, offset)
    }
    vertex.multiplyScalar(offset)
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z)
  }
  if (merged !== geometry) geometry.dispose()
  merged.computeVertexNormals()

  return merged
}

function merge(parts: Array<THREE.BufferGeometry>) {
  const normalized = parts.map((part) => {
    const flat = part.index ? part.toNonIndexed() : part

    if (flat !== part) part.dispose()
    flat.deleteAttribute('uv')

    return flat
  })
  const merged = mergeGeometries(normalized, false)

  normalized.forEach((part) => part.dispose())

  return merged ?? new THREE.BoxGeometry(0.4, 0.4, 0.4)
}

function coniferCanopy() {
  const tiers = [
    [0.5, 0.72, 0.78],
    [0.4, 0.62, 1.12],
    [0.28, 0.52, 1.44],
    [0.15, 0.36, 1.72],
  ]

  return merge(tiers.map(([radius, height, y], index) => {
    const cone = new THREE.ConeGeometry(radius, height, 7, 1)

    cone.rotateY(index * 0.7)

    return translated(cone, y)
  }))
}

function broadleafCanopy() {
  const lobes: Array<[number, number, number, number]> = [
    [0, 1.08, 0, 0.46],
    [0.26, 0.92, 0.1, 0.32],
    [-0.22, 0.95, -0.14, 0.34],
    [0.04, 0.9, -0.28, 0.3],
    [-0.08, 1.34, 0.08, 0.3],
  ]

  return merge(lobes.map(([x, y, z, radius], index) => {
    const lobe = roughen(new THREE.IcosahedronGeometry(radius, 1), 0.22, index)

    lobe.scale(1, 0.85, 1)
    lobe.translate(x, y, z)

    return lobe
  }))
}

function trunk(height: number) {
  const parts = [translated(new THREE.CylinderGeometry(0.045, 0.085, height, 6), height / 2)]
  const branch = new THREE.CylinderGeometry(0.02, 0.035, 0.32, 5)

  branch.rotateZ(0.9)
  branch.translate(0.1, height * 0.72, 0)
  parts.push(branch)

  return merge(parts)
}

function boulder() {
  const main = roughen(new THREE.IcosahedronGeometry(0.36, 1), 0.38, 3)

  main.scale(1.1, 0.62, 0.9)
  main.translate(0, 0.16, 0)

  const chip = roughen(new THREE.IcosahedronGeometry(0.16, 0), 0.3, 9)

  chip.translate(0.32, 0.05, 0.18)

  return merge([main, chip])
}

function bush() {
  return merge([
    [0, 0.2, 0, 0.3],
    [0.2, 0.14, 0.12, 0.2],
    [-0.18, 0.13, -0.08, 0.22],
  ].map(([x, y, z, radius], index) => {
    const lobe = roughen(new THREE.IcosahedronGeometry(radius, 1), 0.25, index + 20)

    lobe.scale(1, 0.75, 1)
    lobe.translate(x, y, z)

    return lobe
  }))
}

/** A banded loot crate with a lid lip, in the game's chest proportions. */
function crate() {
  return merge([
    translated(new THREE.BoxGeometry(0.5, 0.28, 0.34), 0.14),
    translated(new THREE.BoxGeometry(0.54, 0.07, 0.38), 0.3),
    translated(new THREE.BoxGeometry(0.06, 0.3, 0.36), 0.15).translate(-0.17, 0, 0),
    translated(new THREE.BoxGeometry(0.06, 0.3, 0.36), 0.15).translate(0.17, 0, 0),
  ])
}

/** A Fortnite-scale ramp for world stairs. */
function worldRamp(rise: number, thickness: number) {
  const profile = new THREE.Shape()

  profile.moveTo(0.48, -thickness)
  profile.lineTo(-0.48, rise - thickness)
  profile.lineTo(-0.48, rise)
  profile.lineTo(0.48, 0)
  profile.closePath()

  const geometry = new THREE.ExtrudeGeometry(profile, { bevelEnabled: false, depth: 0.94 })

  geometry.translate(0, 0, -0.47)

  return geometry
}

export function propStyle(kind: number, className: string): Record<string, PropStyle> {
  const lower = className.toLowerCase()

  if (kind === PROP_TREE) {
    const conifer = isConifer(className)

    return {
      trunk: { color: 0x5e3f27, faceted: true, geometry: () => trunk(0.8), variation: 0.15 },
      [conifer ? 'conifer' : 'broadleaf']: conifer
        ? { color: 0x2e6a3e, faceted: true, geometry: coniferCanopy, variation: 0.35 }
        : { color: 0x5b9a3f, faceted: true, geometry: broadleafCanopy, variation: 0.4 },
    }
  }

  if (kind === PROP_ROCK) {
    return { rock: { color: 0x6c6862, faceted: true, geometry: boulder, variation: 0.25 } }
  }

  if (kind === PROP_CONTAINER) {
    return isPlant(className)
      ? { bush: { color: 0x5f9a42, faceted: true, geometry: bush, variation: 0.35 } }
      : { container: { color: 0xb08a4a, geometry: crate, variation: 0.15 } }
  }

  if (kind === PROP_STRUCTURE) {
    const color = 0x8a7f72

    if (/stair/.test(lower)) return { 'world-stair': { color, geometry: () => worldRamp(0.75, 0.08) } }
    if (/fence/.test(lower)) {
      return { 'world-fence': { color, geometry: () => translated(new THREE.BoxGeometry(0.06, 0.3, 1), 0.15) } }
    }
    if (/pole/.test(lower)) {
      return { 'world-pole': { color: 0x5b4636, geometry: () => translated(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), 1.2) } }
    }
    if (/tower/.test(lower)) {
      return { 'world-tower': { color, geometry: () => translated(new THREE.CylinderGeometry(0.45, 0.5, 2.2, 10), 1.1) } }
    }
    if (/floor/.test(lower)) {
      return { 'world-floor': { color, geometry: () => translated(new THREE.BoxGeometry(1, 0.06, 1), 0.03) } }
    }
    if (/wall|solid|door|arch/.test(lower)) {
      return { 'world-wall': { color, geometry: () => translated(new THREE.BoxGeometry(0.12, STOREY_HEIGHT, 1), STOREY_HEIGHT / 2) } }
    }

    return { 'world-block': { color: 0x6f675d, faceted: true, geometry: () => roughen(translated(new THREE.BoxGeometry(0.8, 0.6, 0.8, 2, 2, 2), 0.3), 0.12, 5), variation: 0.2 } }
  }

  return {
    prop: {
      color: 0x6d675f,
      faceted: true,
      geometry: () => roughen(translated(new THREE.BoxGeometry(0.45, 0.45, 0.45, 2, 2, 2), 0.225), 0.15, 7),
      variation: 0.2,
    },
  }
}

/** A per-instance tint that keeps a forest from looking copy-pasted. */
export function propTint(style: PropStyle, x: number, y: number) {
  const amount = style.variation ?? 0
  const color = new THREE.Color(1, 1, 1)

  if (amount <= 0) return color

  const hue = (hash3(x, y, 1) - 0.5) * 0.08 * amount
  const light = 1 + (hash3(x, y, 2) - 0.5) * amount

  return color.setHSL(hue < 0 ? 1 + hue : hue, 0.12 * amount, 0.5).multiplyScalar(2 * light)
}
