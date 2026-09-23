import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

import buildsUrl from '../../../../assets/outpost-game/builds/builds.glb?url'
import outpostUrl from '../../../../assets/outpost-game/outpost/outpost.glb?url'
import trapsUrl from '../../../../assets/outpost-game/traps/traps.glb?url'

/**
 * The game's own player build pieces — every wood, brick and metal shape at
 * upgrade tiers 1–3 with their original UVs and textures, recovered by
 * `scripts/outpost-asset-recovery/extract_build_pieces.py`. Geometry sits in
 * the same frame (and pivot) as the recovered collision hulls, so it drops
 * into the existing instance transforms unchanged.
 */

export type BuildPart = { geometry: THREE.BufferGeometry; material: THREE.Material }

const MATERIAL_LETTER = ['W', 'B', 'M']

const libraries = new Map<string, Promise<Map<string, Array<BuildPart>>>>()

/** `w1_solid`-style key; null for materials without recovered pieces. */
export function buildPieceKey(material: number, tier: number, shape: string) {
  const letter = MATERIAL_LETTER[material]

  if (!letter || !shape) return null

  return `${letter}${Math.max(1, Math.min(3, tier || 1))}_${shape}`.toLowerCase()
}

/** Pieces by lowercase node name from a textured model library GLB. */
export function loadTexturedLibrary(url: string) {
  let pending = libraries.get(url)

  if (pending) return pending
  pending = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(url)
    .then((gltf) => {
      const library = new Map<string, Array<BuildPart>>()

      // Quantized meshes carry their scale/offset in the node transform.
      gltf.scene.updateMatrixWorld(true)
      for (const node of gltf.scene.children) {
        const parts: Array<BuildPart> = []

        node.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          const geometry = new THREE.BufferGeometry()
          const source = object.geometry as THREE.BufferGeometry

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
          geometry.applyMatrix4(object.matrixWorld)
          geometry.computeBoundingSphere()

          const material = object.material as THREE.MeshStandardMaterial

          // Pieces with the game's specular masks carry real per-texel
          // metalness/roughness; the rest get a matte default.
          if (!material.metalnessMap) {
            material.roughness = 0.85
            material.metalness = 0
          } else {
            // The game's masks are tuned for its own lighting; under this
            // scene's direct sun and bloom, flat metal floors turned into
            // mirrors. Keep their sheen but never let them go mirror-smooth.
            material.metalness = 0.75
            material.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                '#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, 0.6);'
              )
            }
            material.customProgramCacheKey = () => 'game-metal-gloss'
          }
          parts.push({ geometry, material })
        })
        library.set(node.name.toLowerCase(), parts)
      }

      return library
    })
    .catch((error) => {
      libraries.delete(url)
      throw error
    })
  libraries.set(url, pending)

  return pending
}

export function loadBuildLibrary() {
  return loadTexturedLibrary(buildsUrl)
}

/**
 * The Storm Shield device (`stormshield`, `stormshieldtop`) and amplifier
 * (`amplifier`, `amplifierfloor`) models, from `extract_outpost_models.py`.
 */
export function loadOutpostModels() {
  return loadTexturedLibrary(outpostUrl)
}

/** Library key for a trap display name, as GLTFLoader sanitizes node names. */
export function trapModelKey(displayName: string) {
  return displayName.replace(/\s/g, '_').replace(/[[\].:/]/g, '').toLowerCase()
}

let trapLibrary: Promise<Map<string, Array<BuildPart>>> | null = null

/**
 * STW trap models by display name (`trapModelKey`), every part of a trap
 * (base, spikes, cannons …) merged under one key. From
 * `scripts/outpost-asset-recovery/extract_trap_models.py`.
 */
export function loadTrapModels() {
  trapLibrary ??= loadTexturedLibrary(trapsUrl).then((nodes) => {
    const traps = new Map<string, Array<BuildPart>>()

    for (const [name, parts] of nodes) {
      const key = name.replace(/#\d+$/, '')

      traps.set(key, [...(traps.get(key) ?? []), ...parts])
    }

    return traps
  })

  return trapLibrary
}
