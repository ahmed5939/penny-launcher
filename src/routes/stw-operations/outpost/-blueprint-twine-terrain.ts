import type { OutpostZoneTerrain } from '../../../config/constants/outpost-zones'
import * as THREE from 'three'

import { buildZoneHeightGrid, CELL_LAVA, CELL_SEA } from './-blueprint-terrain'

import terrain from '../../../../assets/outpost-game/twine/terrain.json'
import grassUrl from '../../../../assets/outpost-game/twine/grass.png'
import grassNormalUrl from '../../../../assets/outpost-game/twine/grass-normal.png'
import rockUrl from '../../../../assets/outpost-game/twine/rock.png'
import groundUrl from '../../../../assets/outpost-game/twine/ground.png'
import lavaUrl from '../../../../assets/outpost-game/twine/lava.png'
import lavaNormalUrl from '../../../../assets/outpost-game/twine/lava-normal.png'

export type TwineTerrainModel = {
  name: string
  kind: 'ground' | 'rock' | 'shore' | 'lava'
  source: 'collision' | 'bounds'
  positions?: number[]
  indices?: number[]
  bounds?: number[]
}
export const TWINE_TERRAIN = terrain as {
  models: TwineTerrainModel[]
  /** model index, scene XYZ, quaternion XYZW, scale XYZ */
  instances: number[][]
}

/** Keeps separate cliff faces, ramps and ceilings; no heightfield infill. */
export function twineTerrainGeometry(model: TwineTerrainModel) {
  let base: THREE.BufferGeometry

  if (model.positions && model.indices) {
    const indexed = new THREE.BufferGeometry()

    indexed.setAttribute('position', new THREE.Float32BufferAttribute(model.positions, 3))
    indexed.setIndex(model.indices)
    base = indexed.toNonIndexed()
    indexed.dispose()
  } else if (model.bounds) {
    const [x, y, z, width, height, depth] = model.bounds
    const box = new THREE.BoxGeometry(width, Math.max(0.015, height), depth)

    box.translate(x, y, z)
    base = box.toNonIndexed()
    box.dispose()
  } else {
    throw new Error(`Missing terrain geometry: ${model.name}`)
  }
  base.computeVertexNormals()
  const positions = base.getAttribute('position')
  const normals = base.getAttribute('normal')
  const buckets: number[][] = [[], [], [], []]

  for (let i = 0; i < positions.count; i += 3) {
    const upward = normals.getY(i) > 0.65
    const grassy = upward && (model.kind === 'ground' || /^S_(Cliff|Elevation)/.test(model.name))
    const material = model.kind === 'lava' ? 3 : model.kind === 'shore' ? 2 : grassy ? 0 : 1

    for (let v = i; v < i + 3; v++) {
      buckets[material].push(positions.getX(v), positions.getY(v), positions.getZ(v))
    }
  }
  base.dispose()
  const geometry = new THREE.BufferGeometry()
  const merged: number[] = []

  buckets.forEach((bucket, index) => {
    if (bucket.length) geometry.addGroup(merged.length / 3, bucket.length / 3, index)
    merged.push(...bucket)
  })
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(merged, 3))
  geometry.computeVertexNormals()
  const p = geometry.getAttribute('position')
  const n = geometry.getAttribute('normal')
  const uv: number[] = []

  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i))

    uv.push((nx > nz && nx > ny ? p.getZ(i) : p.getX(i)) / 2,
      (ny >= nx && ny >= nz ? p.getZ(i) : p.getY(i)) / 2)
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))

  return geometry
}

export function twineInstanceMatrix(instance: number[]) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(instance[1], instance[2], instance[3]),
    new THREE.Quaternion(instance[4], instance[5], instance[6], instance[7]).normalize(),
    new THREE.Vector3(instance[8], instance[9], instance[10])
  )
}

export function twinePlacementGeometry(model: TwineTerrainModel, instance: number[]) {
  const geometry = twineTerrainGeometry(model)
  const signs = instance.slice(8).map((scale) => Math.sign(scale) || 1)

  // InstancedMesh cannot render negative-determinant instance transforms.
  // Bake reflections into each shared geometry and keep matrices positive.
  geometry.scale(signs[0], signs[1], signs[2])
  if (signs[0] * signs[1] * signs[2] < 0) {
    for (const attribute of Object.values(geometry.attributes)) {
      const array = attribute.array
      const size = attribute.itemSize

      for (let vertex = 0; vertex < attribute.count; vertex += 3) {
        for (let component = 0; component < size; component++) {
          const a = (vertex + 1) * size + component, b = (vertex + 2) * size + component
          const value = array[a]

          array[a] = array[b]
          array[b] = value
        }
      }
    }
    geometry.computeVertexNormals()
  }

  return geometry
}

export function createTwineTerrain({
  onLoad,
  track,
}: {
  onLoad: () => void
  track: <T extends { dispose: () => void }>(resource: T) => T
}) {
  let disposed = false

  track({ dispose: () => { disposed = true } })
  const texture = (url: string, normal = false) => {
    const map = track(new THREE.TextureLoader().load(url, () => {
      if (disposed) { map.dispose(); return }
      onLoad()
    }))

    map.colorSpace = normal ? THREE.NoColorSpace : THREE.SRGBColorSpace
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.anisotropy = 4

    return map
  }
  const grass = texture(grassUrl)
  const rock = texture(rockUrl)
  const ground = texture(groundUrl)
  const lava = texture(lavaUrl)
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0x82965e, map: grass, normalMap: texture(grassNormalUrl, true), normalScale: new THREE.Vector2(0.25, 0.25), roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xb7ada2, map: rock, bumpMap: rock, bumpScale: 0.008, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xb6a381, map: ground, bumpMap: ground, bumpScale: 0.006, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xff9b36, map: lava, normalMap: texture(lavaNormalUrl, true), emissive: 0xff4a12, emissiveIntensity: 1.2, roughness: 0.6 }),
  ].map((material) => {
    // Mirrored terrain instances and cave interiors must remain visible.
    material.side = THREE.DoubleSide
    return track(material)
  })
  const group = new THREE.Group()
  const instances = new Map<string, number[][]>()

  for (const instance of TWINE_TERRAIN.instances) {
    const key = `${instance[0]}:${instance.slice(8).map((scale) => Math.sign(scale)).join(',')}`
    const entries = instances.get(key) ?? []

    entries.push(instance)
    instances.set(key, entries)
  }
  for (const placements of instances.values()) {
    const model = TWINE_TERRAIN.models[placements[0][0]]
    const geometry = twinePlacementGeometry(model, placements[0])
    const mesh = new THREE.InstancedMesh(track(geometry), materials, placements.length)

    placements.forEach((instance, i) => mesh.setMatrixAt(i,
      twineInstanceMatrix([...instance.slice(0, 8), ...instance.slice(8).map(Math.abs)])))
    mesh.name = model.name
    mesh.castShadow = model.kind !== 'lava'
    mesh.receiveShadow = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
    group.add(mesh)
  }

  return group
}


/** Sea reaches the island from outside, not every cave or the enclosed caldera. */
/** `reach` is how far open sea extends past the terrain grid, in cells. */
export function twineOceanGeometry(terrain: OutpostZoneTerrain, reach = 10) {
  const grid = buildZoneHeightGrid(terrain)
  const { rows, cols, minX, minY, kinds } = grid
  const reached = new Uint8Array(rows * cols)
  const queue: number[] = []
  const visit = (x: number, y: number) => {
    if (x < 0 || x >= rows || y < 0 || y >= cols) return
    const index = x * cols + y

    if (reached[index] || kinds[index] !== CELL_SEA) return
    reached[index] = 1
    queue.push(index)
  }

  for (let x = 0; x < rows; x++) { visit(x, 0); visit(x, cols - 1) }
  for (let y = 0; y < cols; y++) { visit(0, y); visit(rows - 1, y) }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const x = Math.floor(queue[cursor] / cols), y = queue[cursor] % cols

    visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1)
  }
  // Allow water beneath land to conceal submerged collision hulls. Protect
  // lava using the resolved level meshes: the legacy grid misses most lava.
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] !== CELL_SEA && kinds[i] !== CELL_LAVA) reached[i] = 1
  }
  if (terrain.source === 'Zone_Outpost_TwinePeaks.umap') {
    const bounds = new Map<number, THREE.Box3>()

    for (const instance of TWINE_TERRAIN.instances) {
      const model = TWINE_TERRAIN.models[instance[0]]

      if (model.kind !== 'lava') continue
      let local = bounds.get(instance[0])

      if (!local) {
        const geometry = twineTerrainGeometry(model)

        geometry.computeBoundingBox()
        local = geometry.boundingBox!.clone()
        bounds.set(instance[0], local)
        geometry.dispose()
      }
      const box = local.clone().applyMatrix4(twineInstanceMatrix(instance))

      for (let x = Math.max(0, Math.floor(-box.max.z - minX)); x <= Math.min(rows - 1, Math.ceil(-box.min.z - minX)); x++) {
        for (let y = Math.max(0, Math.floor(box.min.x - minY)); y <= Math.min(cols - 1, Math.ceil(box.max.x - minY)); y++) {
          reached[x * cols + y] = 0
        }
      }
    }
  }
  const positions: number[] = []
  const height = terrain.waterZ + 0.02
  const rectangle = (x0: number, x1: number, y0: number, y1: number) => {
    positions.push(y0, height, -x0, y1, height, -x0, y0, height, -x1,
      y1, height, -x0, y1, height, -x1, y0, height, -x1)
  }

  // Collapse contiguous water cells into strips to keep this mesh small.
  for (let x = 0; x < rows; x++) {
    for (let y = 0; y < cols;) {
      if (!reached[x * cols + y]) { y++; continue }
      const start = y
      while (y < cols && reached[x * cols + y]) y++
      rectangle(minX + x - 0.5, minX + x + 0.5, minY + start - 0.5, minY + y - 0.5)
    }
  }
  const x0 = minX - 0.5, x1 = minX + rows - 0.5
  const y0 = minY - 0.5, y1 = minY + cols - 0.5

  rectangle(x0 - reach, x0, y0 - reach, y1 + reach)
  rectangle(x1, x1 + reach, y0 - reach, y1 + reach)
  rectangle(x0, x1, y0 - reach, y0)
  rectangle(x0, x1, y1, y1 + reach)
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()

  return geometry
}
