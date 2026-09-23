import type { OutpostZoneTerrain } from '../../../config/constants/outpost-zones'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

import { buildZoneHeightGrid, CELL_LAVA, CELL_SEA } from './-blueprint-terrain'

import terrain from '../../../../assets/outpost-game/twine/terrain.json'
import grassUrl from '../../../../assets/outpost-game/twine/grass.png'
import grassNormalUrl from '../../../../assets/outpost-game/twine/grass-normal.png'
import rockUrl from '../../../../assets/outpost-game/twine/rock.png'
import groundUrl from '../../../../assets/outpost-game/twine/ground.png'
import lavaUrl from '../../../../assets/outpost-game/twine/lava.png'
import lavaNormalUrl from '../../../../assets/outpost-game/twine/lava-normal.png'
import twineMeshesUrl from '../../../../assets/outpost-game/twine/terrain-meshes.glb?url'
import stonewoodMeshesUrl from '../../../../assets/outpost-game/zones/pve_01/terrain-meshes.glb?url'
import plankertonMeshesUrl from '../../../../assets/outpost-game/zones/pve_02/terrain-meshes.glb?url'
import cannyMeshesUrl from '../../../../assets/outpost-game/zones/pve_03/terrain-meshes.glb?url'
import stonewoodGrass from '../../../../assets/outpost-game/zones/pve_01/grass.png'
import stonewoodGrassNormal from '../../../../assets/outpost-game/zones/pve_01/grass-normal.png'
import stonewoodGround from '../../../../assets/outpost-game/zones/pve_01/ground.png'
import stonewoodRock from '../../../../assets/outpost-game/zones/pve_01/rock.png'
import stonewoodRockNormal from '../../../../assets/outpost-game/zones/pve_01/rock-normal.png'
import plankertonGrass from '../../../../assets/outpost-game/zones/pve_02/grass.png'
import plankertonGrassNormal from '../../../../assets/outpost-game/zones/pve_02/grass-normal.png'
import plankertonGround from '../../../../assets/outpost-game/zones/pve_02/ground.png'
import plankertonRock from '../../../../assets/outpost-game/zones/pve_02/rock.png'
import plankertonRockNormal from '../../../../assets/outpost-game/zones/pve_02/rock-normal.png'
import cannyGrass from '../../../../assets/outpost-game/zones/pve_03/grass.png'
import cannyGrassNormal from '../../../../assets/outpost-game/zones/pve_03/grass-normal.png'
import cannyGround from '../../../../assets/outpost-game/zones/pve_03/ground.png'
import cannyRock from '../../../../assets/outpost-game/zones/pve_03/rock.png'
import cannyRockNormal from '../../../../assets/outpost-game/zones/pve_03/rock-normal.png'

export type TwineTerrainModel = {
  name: string
  kind: 'ground' | 'rock' | 'shore' | 'lava' | 'structure' | 'water'
  source: 'collision' | 'bounds'
  positions?: number[]
  indices?: number[]
  bounds?: number[]
}
export type RecoveredTerrain = {
  models: TwineTerrainModel[]
  /** model index, scene XYZ, quaternion XYZW, scale XYZ */
  instances: number[][]
}
export const TWINE_TERRAIN = terrain as RecoveredTerrain

/** Material slots, in geometry-group order. */
const SURFACE_GRASS = 0
const SURFACE_ROCK = 1
const SURFACE_SHORE = 2
const SURFACE_LAVA = 3
const SURFACE_STRUCTURE = 4
const SURFACE_WATER = 5

type ZoneSurfaces = {
  grass: string
  grassNormal: string
  ground: string
  lava?: string
  lavaNormal?: string
  rock: string
  rockNormal?: string
  /** Multipliers that pull each biome's photo textures into one palette. */
  tint: { grass: number; ground: number; rock: number }
}

/**
 * Every zone with collision-hull terrain recovered from its level package
 * (see scripts/outpost-asset-recovery). Twine ships inline; the others are
 * split into their own chunks and only load when their outpost is viewed.
 */
export const ZONE_TERRAIN_ASSETS: Record<string, {
  load: () => Promise<RecoveredTerrain>
  /** The game's own render meshes for this zone's terrain models. */
  meshes: string
  surfaces: ZoneSurfaces
}> = {
  pve_01: {
    meshes: stonewoodMeshesUrl,
    load: () => import('../../../../assets/outpost-game/zones/pve_01/terrain.json').then((m) => m.default as RecoveredTerrain),
    surfaces: { grass: stonewoodGrass, grassNormal: stonewoodGrassNormal, ground: stonewoodGround, rock: stonewoodRock, rockNormal: stonewoodRockNormal, tint: { grass: 0x8aa866, ground: 0xb8a58a, rock: 0xb4aba0 } },
  },
  pve_02: {
    meshes: plankertonMeshesUrl,
    load: () => import('../../../../assets/outpost-game/zones/pve_02/terrain.json').then((m) => m.default as RecoveredTerrain),
    surfaces: { grass: plankertonGrass, grassNormal: plankertonGrassNormal, ground: plankertonGround, rock: plankertonRock, rockNormal: plankertonRockNormal, tint: { grass: 0xd8ccb2, ground: 0xb6a386, rock: 0xb8b0a6 } },
  },
  pve_03: {
    meshes: cannyMeshesUrl,
    load: () => import('../../../../assets/outpost-game/zones/pve_03/terrain.json').then((m) => m.default as RecoveredTerrain),
    surfaces: { grass: cannyGrass, grassNormal: cannyGrassNormal, ground: cannyGround, rock: cannyRock, rockNormal: cannyRockNormal, tint: { grass: 0xe0c8a0, ground: 0xd2b894, rock: 0xd4a888 } },
  },
  pve_04: {
    meshes: twineMeshesUrl,
    load: () => Promise.resolve(TWINE_TERRAIN),
    surfaces: { grass: grassUrl, grassNormal: grassNormalUrl, ground: groundUrl, lava: lavaUrl, lavaNormal: lavaNormalUrl, rock: rockUrl, tint: { grass: 0x82965e, ground: 0xb6a381, rock: 0xb7ada2 } },
  },
}

/**
 * Keeps separate cliff faces, ramps and ceilings; no heightfield infill.
 * With `render` (the game's own mesh) the real surface and its smooth
 * normals are used; otherwise the recovered collision hull stands in.
 */
export function twineTerrainGeometry(model: TwineTerrainModel, render?: THREE.BufferGeometry) {
  let base: THREE.BufferGeometry

  if (render) {
    base = render.index ? render.toNonIndexed() : render.clone()
  } else if (model.positions && model.indices) {
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
  const smooth = Boolean(render?.getAttribute('normal'))

  if (!smooth) base.computeVertexNormals()
  const positions = base.getAttribute('position')
  const normals = base.getAttribute('normal')
  const buckets: number[][] = [[], [], [], [], [], []]
  const normalBuckets: number[][] = [[], [], [], [], [], []]
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()

  for (let i = 0; i < positions.count; i += 3) {
    // Classify by the true face direction, whatever the shading normals say.
    a.fromBufferAttribute(positions, i)
    b.fromBufferAttribute(positions, i + 1).sub(a)
    c.fromBufferAttribute(positions, i + 2).sub(a)
    const face = b.cross(c).normalize()
    const upward = Math.abs(face.y) > 0.65 && (smooth ? normals.getY(i) > 0 : face.y > 0)
    const grassy = upward && (model.kind === 'ground' || /^S_(Cliff|Elevation)/.test(model.name))
    const material = model.kind === 'lava' ? SURFACE_LAVA
      : model.kind === 'shore' ? SURFACE_SHORE
        : model.kind === 'water' ? SURFACE_WATER
          : model.kind === 'structure' ? SURFACE_STRUCTURE
            : grassy ? SURFACE_GRASS : SURFACE_ROCK

    for (let v = i; v < i + 3; v++) {
      buckets[material].push(positions.getX(v), positions.getY(v), positions.getZ(v))
      normalBuckets[material].push(normals.getX(v), normals.getY(v), normals.getZ(v))
    }
  }
  base.dispose()
  const geometry = new THREE.BufferGeometry()
  const merged: number[] = []
  const mergedNormals: number[] = []

  buckets.forEach((bucket, index) => {
    if (bucket.length) geometry.addGroup(merged.length / 3, bucket.length / 3, index)
    merged.push(...bucket)
    mergedNormals.push(...normalBuckets[index])
  })
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(merged, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mergedNormals, 3))
  geometry.userData.smooth = smooth
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

export function twinePlacementGeometry(model: TwineTerrainModel, instance: number[], render?: THREE.BufferGeometry) {
  const geometry = twineTerrainGeometry(model, render)
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
    // Hull normals are rebuilt; mesh normals were already mirrored by scale().
    if (!geometry.userData.smooth) geometry.computeVertexNormals()
  }

  return geometry
}

const renderMeshCache = new Map<string, Promise<Map<string, THREE.BufferGeometry>>>()

/**
 * The zone's full-detail terrain meshes by model name, decoded once per
 * session by `scripts/outpost-asset-recovery/ue_mesh.py` output. Failures
 * resolve empty so the collision hulls still render.
 */
function loadRenderMeshes(url: string) {
  let pending = renderMeshCache.get(url)

  if (!pending) {
    pending = new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(url)
      .then((gltf) => {
        const meshes = new Map<string, THREE.BufferGeometry>()

        // Quantized meshes carry their scale/offset in the node transform.
        gltf.scene.updateMatrixWorld(true)
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || meshes.has(object.name)) return
          const source = object.geometry as THREE.BufferGeometry
          const geometry = new THREE.BufferGeometry()

          // Meshopt quantizes attributes; expand them before any transform.
          for (const name of ['position', 'normal']) {
            const attribute = source.getAttribute(name)

            if (!attribute) continue
            const values = new Float32Array(attribute.count * 3)

            for (let i = 0; i < attribute.count; i++) {
              values[i * 3] = attribute.getX(i)
              values[i * 3 + 1] = attribute.getY(i)
              values[i * 3 + 2] = attribute.getZ(i)
            }
            geometry.setAttribute(name, new THREE.BufferAttribute(values, 3))
          }
          geometry.setIndex(source.index ? source.index.clone() : null)
          geometry.applyMatrix4(object.matrixWorld)
          meshes.set(object.name, geometry)
        })

        return meshes
      })
      .catch(() => new Map<string, THREE.BufferGeometry>())
    renderMeshCache.set(url, pending)
  }

  return pending
}

/**
 * Builds a zone's recovered terrain. Returns the (initially empty) group at
 * once plus a promise that settles when the placements have been added, so
 * callers can scatter ground cover or animate lava afterwards.
 */
export function createZoneTerrain({
  onLoad,
  track,
  water,
  zoneId,
}: {
  onLoad: () => void
  track: <T extends { dispose: () => void }>(resource: T) => T
  /** Shared sea material for recovered ponds and streams. */
  water: THREE.Material
  zoneId: string
}) {
  const assets = ZONE_TERRAIN_ASSETS[zoneId]
  const group = new THREE.Group()
  let disposed = false

  track({ dispose: () => { disposed = true } })
  if (!assets) return { group, ready: Promise.resolve() }

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
  const { surfaces } = assets
  const rock = texture(surfaces.rock)
  const ground = texture(surfaces.ground)
  const materials: Array<THREE.Material> = [
    new THREE.MeshStandardMaterial({ color: surfaces.tint.grass, map: texture(surfaces.grass), normalMap: texture(surfaces.grassNormal, true), normalScale: new THREE.Vector2(0.25, 0.25), roughness: 1 }),
    new THREE.MeshStandardMaterial({
      color: surfaces.tint.rock,
      map: rock,
      ...(surfaces.rockNormal
        ? { normalMap: texture(surfaces.rockNormal, true), normalScale: new THREE.Vector2(0.6, 0.6) }
        : { bumpMap: rock, bumpScale: 0.008 }),
      roughness: 1,
    }),
    new THREE.MeshStandardMaterial({ color: surfaces.tint.ground, map: ground, bumpMap: ground, bumpScale: 0.006, roughness: 1 }),
    surfaces.lava
      ? new THREE.MeshStandardMaterial({ color: 0xff9b36, map: texture(surfaces.lava), normalMap: surfaces.lavaNormal ? texture(surfaces.lavaNormal, true) : null, emissive: 0xff4a12, emissiveIntensity: 1.2, roughness: 0.6 })
      : new THREE.MeshStandardMaterial({ color: 0xff7b2d, emissive: 0xff4a12, emissiveIntensity: 1.2 }),
    new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.85 }),
  ].map((material) => {
    // Mirrored terrain instances and cave interiors must remain visible.
    material.side = THREE.DoubleSide
    return track(material)
  })

  materials.push(water)

  const ready = Promise.all([assets.load(), loadRenderMeshes(assets.meshes)]).then(([data, renderMeshes]) => {
    if (disposed) return
    const instances = new Map<string, number[][]>()

    for (const instance of data.instances) {
      const key = `${instance[0]}:${instance.slice(8).map((scale) => Math.sign(scale)).join(',')}`
      const entries = instances.get(key) ?? []

      entries.push(instance)
      instances.set(key, entries)
    }
    for (const placements of instances.values()) {
      const model = data.models[placements[0][0]]
      const geometry = twinePlacementGeometry(model, placements[0], renderMeshes.get(model.name))
      const mesh = new THREE.InstancedMesh(track(geometry), materials, placements.length)

      placements.forEach((instance, i) => mesh.setMatrixAt(i,
        twineInstanceMatrix([...instance.slice(0, 8), ...instance.slice(8).map(Math.abs)])))
      mesh.name = model.name
      mesh.castShadow = model.kind !== 'lava' && model.kind !== 'water'
      mesh.receiveShadow = true
      mesh.computeBoundingBox()
      mesh.computeBoundingSphere()
      group.add(mesh)
    }
    onLoad()
  })

  return { group, ready }
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
