import * as THREE from 'three'

import collision from '../../../../assets/outpost-game/build-collision.json'
import wood from '../../../../assets/outpost-game/wood-planks.png'
import brickWall from '../../../../assets/outpost-game/brick-wall.png'
import brickWallNormal from '../../../../assets/outpost-game/brick-wall-normal.png'
import brickFloor from '../../../../assets/outpost-game/brick-floor.png'
import brickFloorNormal from '../../../../assets/outpost-game/brick-floor-normal.png'
import stone from '../../../../assets/outpost-game/stone-tier3.png'
import stoneNormal from '../../../../assets/outpost-game/stone-tier3-normal.png'

const hulls: Record<string, { positions: number[]; indices: number[] }> = collision

export function hasArchiveMesh(shape: string, material: number, tier: number) {
  return Object.hasOwn(hulls, `${material}:${tier}:${shape.toLowerCase()}`)
}

/** Collision geometry is a measured silhouette, not the original render mesh. */
export function archiveBuildMesh(shape: string, material: number, tier: number) {
  const data = hulls[`${material}:${tier}:${shape.toLowerCase()}`]

  if (!data) return null

  const indexed = new THREE.BufferGeometry()

  indexed.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3))
  indexed.setIndex(data.indices)
  const geometry = indexed.toNonIndexed()

  indexed.dispose()
  geometry.computeVertexNormals()

  return geometry
}

export type ArchiveSurface = { color: string; normal?: string }

/** No metal albedo or tier-2 brick surface exists in the supplied archive. */
export function archiveBuildSurface(material: number, tier: number, kind: number): ArchiveSurface | null {
  if (material === 0) return { color: wood }
  if (material !== 1) return null
  if (tier === 3) return { color: stone, normal: stoneNormal }
  if (kind === 0) return { color: brickFloor, normal: brickFloorNormal }

  return { color: brickWall, normal: brickWallNormal }
}
