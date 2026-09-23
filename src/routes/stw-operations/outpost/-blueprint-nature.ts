import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

import { addWindSway, keepFoliageNormals } from './-blueprint-atmosphere'
import { isConifer, isPlant, PROP_CONTAINER, PROP_ROCK, PROP_TREE } from './-blueprint-geometry'

import natureUrl from '../../../../assets/outpost-game/nature/nature.glb?url'

/**
 * Hand-painted trees, boulders, bushes and ground cover from Quaternius'
 * Stylized Nature MegaKit (CC0, see `assets/outpost-game/nature/LICENSE.md`).
 * The save only tells us where the map's own foliage stands, so these are
 * stand-ins picked per kind and varied per placement.
 */

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material }

/** Each model's parts, rescaled so the model stands one unit tall on y = 0. */
export type NatureLibrary = Map<string, Array<Part>>

type Archetype = {
  /** Model names inside nature.glb. */
  models: Array<string>
  /** Height in build tiles before the save's own scale is applied. */
  height: number
  sway: number
  shadows: boolean
}

const ARCHETYPES = {
  broadleaf: {
    height: 2.3,
    models: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'],
    shadows: true,
    sway: 0.035,
  },
  bush: {
    height: 0.5,
    models: ['Bush_Common_Flowers', 'Plant_1_Big', 'Fern_1'],
    shadows: true,
    sway: 0.12,
  },
  conifer: {
    height: 2.9,
    models: ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'],
    shadows: true,
    sway: 0.03,
  },
  dead: { height: 2.2, models: ['DeadTree_1', 'DeadTree_4'], shadows: true, sway: 0.01 },
  ground: {
    height: 0.2,
    models: ['Grass_Wispy_Short', 'Grass_Wispy_Tall', 'Grass_Common_Tall', 'Grass_Common_Tall', 'Flower_3_Group', 'Plant_1'],
    shadows: false,
    sway: 0.35,
  },
  rock: { height: 0.62, models: ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'], shadows: true, sway: 0 },
} satisfies Record<string, Archetype>

export type ArchetypeName = keyof typeof ARCHETYPES

let pending: Promise<NatureLibrary> | null = null

/**
 * Meshopt stores attributes as normalized integers. Transforming those in
 * place would clamp every coordinate to ±1, so expand them to floats first.
 */
function toFloatAttributes(source: THREE.BufferGeometry) {
  const geometry = new THREE.BufferGeometry()

  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values = new Float32Array(attribute.count * attribute.itemSize)

    for (let index = 0; index < attribute.count; index++) {
      for (let component = 0; component < attribute.itemSize; component++) {
        values[index * attribute.itemSize + component] = attribute.getComponent(index, component)
      }
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize))
  }
  geometry.setIndex(source.index ? source.index.clone() : null)

  return geometry
}

function addPart(library: NatureLibrary, name: string, mesh: THREE.Mesh) {
  const geometry = toFloatAttributes(mesh.geometry as THREE.BufferGeometry)
  const material = [mesh.material].flat()[0] as THREE.MeshStandardMaterial

  geometry.applyMatrix4(mesh.matrixWorld)
  // Cut-outs instead of blending: no sorting, and leaves cast shadows.
  if (material.transparent) {
    material.transparent = false
    material.depthWrite = true
    material.alphaTest = 0.45
    material.side = THREE.DoubleSide
  }
  material.roughness = Math.max(material.roughness, 0.85)
  material.metalness = 0

  const parts = library.get(name) ?? []

  parts.push({ geometry, material })
  library.set(name, parts)
}

/** Loads nature.glb once per session; every explorer instance shares it. */
export function loadNatureLibrary() {
  pending ??= new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(natureUrl)
    .then((gltf) => {
      const library: NatureLibrary = new Map()

      // The merged file keeps one scene per source model: RootNode → model.
      for (const scene of gltf.scenes) {
        scene.updateMatrixWorld(true)
        const model = scene.children[0]?.children[0] ?? scene.children[0]

        model?.traverse((object) => {
          if (object instanceof THREE.Mesh) addPart(library, model.name, object)
        })
      }

      for (const parts of library.values()) {
        const box = new THREE.Box3()

        parts.forEach(({ geometry }) => {
          geometry.computeBoundingBox()
          box.union(geometry.boundingBox!)
        })
        const size = box.getSize(new THREE.Vector3())
        const centre = box.getCenter(new THREE.Vector3())
        const scale = 1 / Math.max(size.y, 1e-3)

        parts.forEach(({ geometry }) => {
          geometry.translate(-centre.x, -box.min.y, -centre.z)
          geometry.scale(scale, scale, scale)
          geometry.computeBoundingSphere()
        })
      }

      return library
    })
    .catch((error) => {
      pending = null
      throw error
    })

  return pending
}

function hash(x: number, y: number, salt: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453

  return value - Math.floor(value)
}

/** Which model family stands in for a recorded prop, or null for none. */
export function natureArchetype(kind: number, className: string, x: number, y: number): ArchetypeName | null {
  if (kind === PROP_TREE) {
    if (isConifer(className)) return 'conifer'
    if (/dead|burnt|charred/i.test(className)) return 'dead'
    // The zone export only says "tree": mix the two silhouettes.
    if (className === 'Palm_Tree') return hash(x, y, 3) < 0.62 ? 'conifer' : 'broadleaf'

    return 'broadleaf'
  }
  if (kind === PROP_ROCK) return 'rock'
  if (kind === PROP_CONTAINER && isPlant(className)) return 'bush'
  // Unclassified zone props are almost all outcrops in Twine's exports.
  if (className === 'Prop') return 'rock'

  return null
}

export type NaturePlacement = {
  archetype: ArchetypeName
  position: THREE.Vector3
  /** Radians about +Y. */
  yaw: number
  scale: number
}

/**
 * Builds one InstancedMesh per model part. Materials are cloned per scene
 * so wind uniforms and disposal stay local to that scene.
 */
export function buildNatureMeshes(
  library: NatureLibrary,
  placements: Array<NaturePlacement>,
  windTime: { value: number },
  track: <T extends { dispose: () => void }>(resource: T) => T
) {
  const groups = new Map<string, Array<NaturePlacement>>()

  for (const placement of placements) {
    const { models } = ARCHETYPES[placement.archetype]
    const available = models.filter((name) => library.has(name))

    if (available.length === 0) continue
    const pick = Math.floor(hash(placement.position.x, placement.position.z, 7) * available.length)
    const key = `${placement.archetype}|${available[pick]}`
    const group = groups.get(key)

    if (group) group.push(placement)
    else groups.set(key, [placement])
  }

  const meshes: Array<THREE.InstancedMesh> = []
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const tint = new THREE.Color()

  for (const [key, group] of groups) {
    const [archetypeName, model] = key.split('|') as [ArchetypeName, string]
    const archetype = ARCHETYPES[archetypeName]

    for (const part of library.get(model) ?? []) {
      const material = track(part.material.clone())

      if (material.alphaTest > 0) keepFoliageNormals(material)
      if (archetype.sway > 0) addWindSway(material, windTime, archetype.sway)
      const mesh = new THREE.InstancedMesh(part.geometry, material, group.length)

      group.forEach((placement, index) => {
        rotation.setFromAxisAngle(up, placement.yaw)
        scale.setScalar(archetype.height * placement.scale)
        matrix.compose(placement.position, rotation, scale)
        mesh.setMatrixAt(index, matrix)
        // A little brightness and warmth drift so forests are not clones.
        const light = 0.86 + hash(placement.position.x, placement.position.z, 11) * 0.28
        const warm = (hash(placement.position.x, placement.position.z, 13) - 0.5) * 0.08

        mesh.setColorAt(index, tint.setRGB(light + warm, light, light - warm))
      })
      mesh.castShadow = archetype.shadows
      // Dense leaf cards shadowing each other just turn canopies black.
      mesh.receiveShadow = material.alphaTest === 0
      mesh.computeBoundingSphere()
      meshes.push(mesh)
    }
  }

  return meshes
}

/**
 * Scatters grass tufts and flowers over upward-facing grass triangles —
 * sampled by area, so density is even and every tuft sits on the surface.
 */
export function scatterGroundCover({
  avoid,
  centre,
  count,
  radius,
  surfaces,
}: {
  /** Scene-space XZ rectangle kept clear (the base footprint). */
  avoid: { maxX: number; maxZ: number; minX: number; minZ: number }
  centre: THREE.Vector3
  count: number
  radius: number
  /** Meshes whose geometry group 0 is the grassy top surface. */
  surfaces: Array<THREE.Mesh | THREE.InstancedMesh>
}) {
  const triangles: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = []
  const areas: Array<number> = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const world = new THREE.Matrix4()
  const instance = new THREE.Matrix4()
  const reachSquared = radius * radius

  for (const mesh of surfaces) {
    const geometry = mesh.geometry as THREE.BufferGeometry
    const grass = geometry.groups.find((group) => group.materialIndex === 0)
    const position = geometry.getAttribute('position')

    if (!grass || !position) continue
    mesh.updateWorldMatrix(true, false)
    const copies = mesh instanceof THREE.InstancedMesh ? mesh.count : 1

    for (let copy = 0; copy < copies; copy++) {
      world.copy(mesh.matrixWorld)
      if (mesh instanceof THREE.InstancedMesh) {
        mesh.getMatrixAt(copy, instance)
        world.multiply(instance)
      }
      const origin = new THREE.Vector3().setFromMatrixPosition(world)
      // Quick reject for whole placements far from the base.
      if ((origin.x - centre.x) ** 2 + (origin.z - centre.z) ** 2 > (radius + 20) ** 2) continue

      for (let vertex = grass.start; vertex < grass.start + grass.count; vertex += 3) {
        a.fromBufferAttribute(position, vertex).applyMatrix4(world)
        b.fromBufferAttribute(position, vertex + 1).applyMatrix4(world)
        c.fromBufferAttribute(position, vertex + 2).applyMatrix4(world)
        const mid = a.clone().add(b).add(c).divideScalar(3)

        if ((mid.x - centre.x) ** 2 + (mid.z - centre.z) ** 2 > reachSquared) continue
        const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2

        if (area < 1e-4) continue
        triangles.push([a.clone(), b.clone(), c.clone()])
        areas.push(area)
      }
    }
  }

  return sampleTriangles(triangles, areas, count, avoid)
}

/** Ground cover for zones without extracted terrain: a flat meadow. */
export function scatterFlatGroundCover({
  avoid,
  bounds,
  count,
  y,
}: {
  avoid: { maxX: number; maxZ: number; minX: number; minZ: number }
  bounds: { maxX: number; maxZ: number; minX: number; minZ: number }
  count: number
  y: number
}) {
  const placements: Array<NaturePlacement> = []

  for (let index = 0; placements.length < count && index < count * 4; index++) {
    const x = bounds.minX + hash(index, 1, 1) * (bounds.maxX - bounds.minX)
    const z = bounds.minZ + hash(index, 2, 2) * (bounds.maxZ - bounds.minZ)

    if (x > avoid.minX && x < avoid.maxX && z > avoid.minZ && z < avoid.maxZ) continue
    placements.push({
      archetype: 'ground',
      position: new THREE.Vector3(x, y, z),
      scale: 0.7 + hash(index, 3, 3) * 0.8,
      yaw: hash(index, 4, 4) * Math.PI * 2,
    })
  }

  return placements
}

function sampleTriangles(
  triangles: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
  areas: Array<number>,
  count: number,
  avoid: { maxX: number; maxZ: number; minX: number; minZ: number }
) {
  const placements: Array<NaturePlacement> = []

  if (triangles.length === 0) return placements

  const cumulative = new Float64Array(areas.length)
  let total = 0

  areas.forEach((area, index) => {
    total += area
    cumulative[index] = total
  })

  for (let index = 0; placements.length < count && index < count * 3; index++) {
    const target = hash(index, 5, 5) * total
    let low = 0
    let high = cumulative.length - 1

    while (low < high) {
      const middle = (low + high) >> 1

      if (cumulative[middle] < target) low = middle + 1
      else high = middle
    }
    let u = hash(index, 6, 6)
    let v = hash(index, 7, 7)

    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    const [a, b, c] = triangles[low]
    const point = a.clone()
      .addScaledVector(b.clone().sub(a), u)
      .addScaledVector(c.clone().sub(a), v)

    if (point.x > avoid.minX && point.x < avoid.maxX && point.z > avoid.minZ && point.z < avoid.maxZ) continue
    placements.push({
      archetype: 'ground',
      position: point,
      scale: 0.7 + hash(index, 8, 8) * 0.8,
      yaw: hash(index, 9, 9) * Math.PI * 2,
    })
  }

  return placements
}
