import type {
  OutpostLayout,
  OutpostTrap,
} from '../../../kernel/core/outpost-types'
import type { MutableRefObject } from 'react'

import { Box, Grid3x3, Layers3, Map as MapIcon, Maximize2, Shield, Sparkles, Trees } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { Button } from '../../../components/ui/button'

import {
  OUTPOST_MAP_UNDERLAYS,
  underlayBlueprintRect,
} from '../../../config/constants/outpost-maps'
import { OUTPOST_ZONE_TERRAIN } from '../../../config/constants/outpost-zones'

import { assets } from '../../../lib/repository'
import { renderOnDemand } from '../../../lib/render-on-demand'
import { cn } from '../../../lib/utils'

import { BlueprintCanvas3D } from './-blueprint-canvas-3d'
import {
  HORIZON,
  SUN_DIRECTION,
  addWindSway,
  createParticles,
  createPostProcessing,
  createSky,
  createStormShield,
  createWaterMaterial,
  worldWaterUVs,
} from './-blueprint-atmosphere'
import { addZoneBackdrops, addZoneScenery, hasZoneScenery } from './-blueprint-backdrops'
import {
  buildPieceKey,
  loadBuildLibrary,
  loadOutpostModels,
  loadTrapModels,
  trapModelKey,
} from './-blueprint-build-library'
import { buildPieceMesh } from './-blueprint-build-meshes'
import {
  type NaturePlacement,
  buildNatureMeshes,
  loadNatureLibrary,
  natureArchetype,
  scatterFlatGroundCover,
  scatterGroundCover,
} from './-blueprint-nature'
import { type PropStyle, propStyle, propTint } from './-blueprint-props'
import { archiveBuildSurface } from './-blueprint-archive-assets'
import {
  TWINE_TERRAIN,
  ZONE_TERRAIN_ASSETS,
  createZoneTerrain,
  twineInstanceMatrix,
  twineOceanGeometry,
} from './-blueprint-twine-terrain'
import {
  CELL_COLORS,
  CELL_GRASS,
  buildZoneHeightGrid,
  cellShade,
  zonePropsAsLayout,
} from './-blueprint-terrain'
import {
  KIND_FLOOR,
  KIND_ROOF,
  KIND_STAIR,
  KIND_WALL,
  PROP_CONTAINER,
  PROP_KIND_LABEL,
  PROP_ROCK,
  PROP_STRUCTURE,
  PROP_TREE,
  STOREY_HEIGHT,
  TRAP_CEILING,
  TRAP_WALL,
  forwardVector,
  propLabel,
  trapCentre,
} from './-blueprint-geometry'

/**
 * Reconstructs saved build positions using procedural piece geometry and
 * trap icons. Known edits have dedicated shapes; other edits and scenery
 * use simplified stand-ins because the save does not contain game meshes.
 */

const MATERIAL_COLORS = ['#c9a06a', '#be795b', '#8ea0b2', '#b7a5ca']
const TRAP_COLORS = [0xed7e39, 0x51a1db, 0xd076f6, 0xbfbaba]
const TRAP_COLOR_HEX = ['#ed7e39', '#51a1db', '#d076f6', '#bfbaba']
const TRAP_LABEL = ['Floor', 'Wall', 'Ceiling', 'Other']
const canvasFallbackSessionKey = 'penny:outpost:canvas-3d'
const cinematicStorageKey = 'penny:outpost:cinematic'
const WALL_THICKNESS = 0.1
const FLOOR_THICKNESS = 0.06
const THIRD = 1 / 3
/** Open sea runs out past the fog so the island never floats in a void. */
const OPEN_SEA_REACH = 3000

type HoverInfo = {
  category: number
  name: string
  x: number
  y: number
}

export function outpostHeightLevels(layout: OutpostLayout) {
  return [
    ...new Set(
      [...layout.structures.map((piece) => piece[2]), ...layout.traps.map((trap) => trap[2])]
        .filter(Number.isFinite)
    ),
  ].sort((a, b) => a - b)
}

// ── Procedural surfaces ──────────────────────────────────────

/** Small deterministic PRNG so the textures look the same on every visit. */
function seededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0

    return state / 0x100000000
  }
}

function canvasTexture(
  size: number,
  draw: (context: CanvasRenderingContext2D, size: number) => void
) {
  const canvas = document.createElement('canvas')

  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')

  if (context) draw(context, size)

  const texture = new THREE.CanvasTexture(canvas)

  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  return texture
}

function woodTexture() {
  return canvasTexture(128, (context, size) => {
    const random = seededRandom(7)
    const plank = size / 9

    context.translate(size, 0)
    context.rotate(Math.PI / 2)

    for (let row = 0; row < 9; row += 1) {
      const shade = 0.9 + random() * 0.2

      context.fillStyle = `rgb(${Math.round(176 * shade)}, ${Math.round(126 * shade)}, ${Math.round(80 * shade)})`
      context.fillRect(0, row * plank, size, plank)

      context.strokeStyle = 'rgba(70, 40, 20, 0.35)'
      context.lineWidth = 1

      for (let grain = 0; grain < 5; grain += 1) {
        const y = row * plank + 3 + random() * (plank - 6)

        context.beginPath()
        context.moveTo(0, y)
        context.bezierCurveTo(size * 0.3, y + random() * 4 - 2, size * 0.6, y - random() * 4 + 2, size, y)
        context.stroke()
      }

      context.fillStyle = 'rgba(50, 28, 12, 0.55)'
      context.fillRect(0, row * plank + plank - 2, size, 2)
      context.fillRect(Math.floor(random() * size), row * plank, 2, plank)
    }
  })
}

function stoneTexture() {
  return canvasTexture(128, (context, size) => {
    const random = seededRandom(11)
    const rows = 6
    const brickHeight = size / rows

    context.fillStyle = '#786c61'
    context.fillRect(0, 0, size, size)

    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 === 0 ? 0 : size / 8
      const bricks = 4

      for (let brick = -1; brick <= bricks; brick += 1) {
        const x = brick * (size / bricks) + offset
        const shade = 0.88 + random() * 0.24

        context.fillStyle = `rgb(${Math.round(190 * shade)}, ${Math.round(113 * shade)}, ${Math.round(79 * shade)})`
        context.fillRect(x + 2, row * brickHeight + 2, size / bricks - 4, brickHeight - 4)
        context.fillStyle = 'rgba(255, 255, 255, 0.12)'
        context.fillRect(x + 2, row * brickHeight + 2, size / bricks - 4, 3)
      }
    }
  })
}

function metalTexture() {
  return canvasTexture(128, (context, size) => {
    const panel = size / 2

    context.fillStyle = '#8ea0b2'
    context.fillRect(0, 0, size, size)

    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        const x = column * panel
        const y = row * panel
        const gradient = context.createLinearGradient(x, y, x + panel, y + panel)

        gradient.addColorStop(0, 'rgba(255,255,255,0.18)')
        gradient.addColorStop(1, 'rgba(0,0,0,0.16)')
        context.fillStyle = gradient
        context.fillRect(x + 2, y + 2, panel - 4, panel - 4)
        context.strokeStyle = 'rgba(30, 40, 55, 0.6)'
        context.lineWidth = 2
        context.strokeRect(x + 2, y + 2, panel - 4, panel - 4)

        context.fillStyle = 'rgba(25, 32, 45, 0.7)'
        for (const [rx, ry] of [
          [x + 7, y + 7],
          [x + panel - 7, y + 7],
          [x + 7, y + panel - 7],
          [x + panel - 7, y + panel - 7],
        ]) {
          context.beginPath()
          context.arc(rx, ry, 2.2, 0, Math.PI * 2)
          context.fill()
        }
      }
    }
  })
}

function groundTexture() {
  return canvasTexture(256, (context, size) => {
    const random = seededRandom(23)

    context.fillStyle = '#4a6636'
    context.fillRect(0, 0, size, size)

    for (let index = 0; index < 2600; index += 1) {
      const x = random() * size
      const y = random() * size
      const tone = random()

      context.fillStyle =
        tone < 0.55
          ? `rgba(${80 + random() * 40}, ${120 + random() * 50}, ${50 + random() * 30}, 0.55)`
          : tone < 0.85
            ? `rgba(${60 + random() * 30}, ${85 + random() * 30}, ${40 + random() * 20}, 0.5)`
            : `rgba(${110 + random() * 40}, ${95 + random() * 30}, ${60 + random() * 20}, 0.35)`
      context.fillRect(x, y, 1 + random() * 3, 1 + random() * 3)
    }

    for (let patch = 0; patch < 6; patch += 1) {
      const gradient = context.createRadialGradient(
        random() * size,
        random() * size,
        0,
        random() * size,
        random() * size,
        30 + random() * 50
      )

      gradient.addColorStop(0, 'rgba(120, 100, 60, 0.28)')
      gradient.addColorStop(1, 'rgba(120, 100, 60, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    }
  })
}

/** Fine volcanic grit multiplied over the extracted biome colours. */
function terrainDetailTexture() {
  return canvasTexture(256, (context, size) => {
    const random = seededRandom(47)

    context.fillStyle = '#d5d2c8'
    context.fillRect(0, 0, size, size)

    for (let index = 0; index < 1800; index += 1) {
      const tone = Math.round(105 + random() * 95)
      const alpha = 0.08 + random() * 0.2

      context.fillStyle = `rgba(${tone},${tone},${tone},${alpha})`
      context.beginPath()
      context.arc(
        random() * size,
        random() * size,
        0.3 + random() * 1.6,
        0,
        Math.PI * 2
      )
      context.fill()
    }

    context.strokeStyle = 'rgba(52, 43, 38, 0.16)'
    context.lineWidth = 0.8
    for (let crack = 0; crack < 22; crack += 1) {
      const x = random() * size
      const y = random() * size

      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + random() * 12 - 6, y + random() * 12 - 6)
      context.lineTo(x + random() * 18 - 9, y + random() * 18 - 9)
      context.stroke()
    }
  })
}

/** Emissive magma with dark floating crust, based on Twine's lava materials. */
function lavaTexture() {
  return canvasTexture(192, (context, size) => {
    const random = seededRandom(89)
    const gradient = context.createRadialGradient(
      size * 0.48,
      size * 0.52,
      4,
      size * 0.5,
      size * 0.5,
      size * 0.72
    )

    gradient.addColorStop(0, '#ffd04b')
    gradient.addColorStop(0.38, '#ff6929')
    gradient.addColorStop(1, '#8f1e18')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)

    context.strokeStyle = 'rgba(47, 24, 27, 0.78)'
    for (let flow = 0; flow < 34; flow += 1) {
      const y = random() * size

      context.lineWidth = 1 + random() * 4
      context.beginPath()
      context.moveTo(-8, y)
      context.bezierCurveTo(
        size * 0.3,
        y + random() * 28 - 14,
        size * 0.7,
        y + random() * 28 - 14,
        size + 8,
        y + random() * 14 - 7
      )
      context.stroke()
    }
  })
}

// ── Piece geometry ───────────────────────────────────────────
/*
 * Every piece is modelled in a local frame that matches how the save stores
 * it: the origin is the actor pivot at the tile centre, +X runs forward
 * across the tile, Z runs across its width and Y is up. The yaw quadrant
 * then becomes a plain rotation about Y.
 */

type Rectangle = [number, number, number, number]

/** A wall in the plane X = 0 — a rectangle with optional cut-outs. */
function wallGeometry({
  arches = [],
  height = STOREY_HEIGHT,
  holes = [],
  span = [-0.5, 0.5],
}: {
  /** `[centre, halfWidth, springHeight]` — a rounded-top doorway. */
  arches?: Array<[number, number, number]>
  height?: number
  /** `[u0, v0, u1, v1]` rectangles removed from the wall. */
  holes?: Array<Rectangle>
  span?: [number, number]
} = {}) {
  const shape = new THREE.Shape()

  shape.moveTo(span[0], 0)
  shape.lineTo(span[1], 0)
  shape.lineTo(span[1], height)
  shape.lineTo(span[0], height)
  shape.closePath()

  for (const [u0, v0, u1, v1] of holes) {
    const hole = new THREE.Path()

    hole.moveTo(u0, v0)
    hole.lineTo(u1, v0)
    hole.lineTo(u1, v1)
    hole.lineTo(u0, v1)
    hole.closePath()
    shape.holes.push(hole)
  }

  for (const [centre, halfWidth, spring] of arches) {
    const hole = new THREE.Path()

    hole.moveTo(centre - halfWidth, 0)
    hole.lineTo(centre + halfWidth, 0)
    hole.lineTo(centre + halfWidth, spring)
    hole.absarc(centre, spring, halfWidth, 0, Math.PI, false)
    hole.lineTo(centre - halfWidth, 0)
    shape.holes.push(hole)
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 10,
    depth: WALL_THICKNESS,
  })

  geometry.rotateY(Math.PI / 2)
  geometry.translate(-WALL_THICKNESS / 2, 0, 0)

  return geometry
}

/** A floor slab made of the given quarter tiles (`[x0, x1, z0, z1]`). */
function slabGeometry(quarters: Array<Rectangle>) {
  const parts = quarters.map(([x0, x1, z0, z1]) => {
    const inset = 0.015
    const width = x1 - x0 - inset * 2
    const depth = z1 - z0 - inset * 2
    const box = new THREE.BoxGeometry(width, FLOOR_THICKNESS, depth)

    box.translate((x0 + x1) / 2, -FLOOR_THICKNESS / 2 + 0.01, (z0 + z1) / 2)

    return box
  })
  const merged = mergeGeometries(parts, false)

  parts.forEach((part) => part.dispose())

  return merged ?? new THREE.BoxGeometry(0.94, FLOOR_THICKNESS, 0.94)
}

/** A Fortnite stair rises opposite the actor's stored forward vector. */
function rampGeometry(rise = STOREY_HEIGHT, thickness = 0.06) {
  const profile = new THREE.Shape()

  profile.moveTo(0.48, -thickness)
  profile.lineTo(-0.48, rise - thickness)
  profile.lineTo(-0.48, rise)
  profile.lineTo(0.48, 0)
  profile.closePath()

  const geometry = new THREE.ExtrudeGeometry(profile, {
    bevelEnabled: false,
    depth: 0.94,
  })

  geometry.translate(0, 0, -0.47)

  return geometry
}

type Vec3 = [number, number, number]

/**
 * A closed-ish solid from flat polygons. Faces are fanned into triangles and
 * wound so their normals point away from the solid's centroid, which keeps
 * lighting right without hand-ordering every corner.
 */
function polyhedronGeometry(faces: Array<Array<Vec3>>) {
  const all = faces.flat()
  const centroid = all
    .reduce(
      (sum, [x, y, z]) => [sum[0] + x, sum[1] + y, sum[2] + z] as Vec3,
      [0, 0, 0] as Vec3
    )
    .map((value) => value / all.length) as Vec3
  const positions: Array<number> = []
  const uvs: Array<number> = []

  for (const face of faces) {
    const [a, b, c] = face
    const ab = new THREE.Vector3(...b).sub(new THREE.Vector3(...a))
    const ac = new THREE.Vector3(...c).sub(new THREE.Vector3(...a))
    const normal = ab.cross(ac)
    const outward = new THREE.Vector3(...a).sub(new THREE.Vector3(...centroid))
    const ordered = normal.dot(outward) < 0 ? [...face].reverse() : face

    for (let index = 1; index + 1 < ordered.length; index += 1) {
      for (const vertex of [ordered[0], ordered[index], ordered[index + 1]]) {
        positions.push(...vertex)
        uvs.push(vertex[0] + vertex[2], vertex[1] + vertex[2] * 0.5)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()

  return geometry
}

const ROOF_HEIGHT = 0.5

/** A pyramid roof; `sides` picks which slopes exist (front, left, back, right). */
function pyramidGeometry(sides: [boolean, boolean, boolean, boolean]) {
  const apex: Vec3 = [0, ROOF_HEIGHT, 0]
  const a: Vec3 = [-0.48, 0, -0.48]
  const b: Vec3 = [0.48, 0, -0.48]
  const c: Vec3 = [0.48, 0, 0.48]
  const d: Vec3 = [-0.48, 0, 0.48]
  const faces: Array<Array<Vec3>> = [[a, b, c, d]]
  const slopes: Array<Array<Vec3>> = [
    [a, d, apex],
    [b, a, apex],
    [c, b, apex],
    [d, c, apex],
  ]

  slopes.forEach((slope, index) => {
    if (sides[index]) faces.push(slope)
  })

  return polyhedronGeometry(faces)
}

/** Reverse an asymmetric roof edit to match Fortnite's stored facing. */
function reverseRoofDirection(geometry: THREE.BufferGeometry) {
  geometry.rotateY(Math.PI)

  return geometry
}

/** A single slope rising opposite the actor's stored forward vector. */
function wedgeGeometry(height = ROOF_HEIGHT) {
  const a: Vec3 = [-0.48, 0, -0.48]
  const b: Vec3 = [0.48, 0, -0.48]
  const c: Vec3 = [0.48, 0, 0.48]
  const d: Vec3 = [-0.48, 0, 0.48]
  const aTop: Vec3 = [-0.48, height, -0.48]
  const dTop: Vec3 = [-0.48, height, 0.48]

  return polyhedronGeometry([
    [a, b, c, d],
    [aTop, dTop, c, b],
    [a, d, dTop, aTop],
    [a, aTop, b],
    [d, c, dTop],
  ])
}

const FULL_TILE: Array<Rectangle> = [[-0.5, 0.5, -0.5, 0.5]]
const NEAR_LEFT: Rectangle = [-0.5, 0, -0.5, 0]
const NEAR_RIGHT: Rectangle = [-0.5, 0, 0, 0.5]
const FAR_LEFT: Rectangle = [0, 0.5, -0.5, 0]
const FAR_RIGHT: Rectangle = [0, 0.5, 0, 0.5]

/**
 * Geometry for a piece by its class-name shape, falling back to the coarse
 * kind for anything unrecognised. Names are the `PBWA_[WSM][123]_<shape>`
 * suffixes seen in saves.
 */
function shapeGeometry(shape: string, kind: number): THREE.BufferGeometry {
  const name = shape.toLowerCase()

  switch (name) {
    case 'solid':
      return wallGeometry()
    case 'windows':
    case 'windowc':
      return wallGeometry({ holes: [[-THIRD / 2, 0.25, THIRD / 2, 0.5]] })
    case 'windowside':
      return wallGeometry({ holes: [[THIRD / 2 + 0.03, 0.25, 0.47, 0.5]] })
    case 'doorc':
    case 'halfwalldoor':
      return wallGeometry({ holes: [[-THIRD / 2, 0, THIRD / 2, 0.5]] })
    case 'doorside':
      return wallGeometry({ holes: [[THIRD / 2 + 0.03, 0, 0.47, 0.5]] })
    case 'archway':
      return wallGeometry({ arches: [[0, THIRD / 2, 0.36]] })
    case 'archwaylarge':
      return wallGeometry({ arches: [[0, THIRD, 0.3]] })
    case 'halfwallhalf':
      return wallGeometry({ height: STOREY_HEIGHT / 2, span: [-0.5, 0] })
    case 'quarterwalls':
      return wallGeometry({ span: [-0.5, -THIRD / 2] })
    case 'quarterwallhalf':
      return wallGeometry({ height: STOREY_HEIGHT / 2, span: [-0.5, -THIRD / 2] })
    case 'brace':
      return wallGeometry({ holes: [[-0.4, 0.08, 0.4, 0.66]] })
    case 'balconys':
      return slabGeometry([NEAR_LEFT, NEAR_RIGHT])
    case 'balconyi':
      return slabGeometry([NEAR_LEFT, NEAR_RIGHT, FAR_LEFT])
    case 'balconyo':
      return slabGeometry([NEAR_LEFT])
    case 'balconyd':
      return slabGeometry([NEAR_LEFT, FAR_RIGHT])
    case 'roofc':
      return pyramidGeometry([true, true, true, true])
    case 'roofi':
      return reverseRoofDirection(pyramidGeometry([true, true, true, false]))
    case 'roofo':
      return reverseRoofDirection(pyramidGeometry([true, true, false, false]))
    case 'roofs':
      return wedgeGeometry()
    case 'roofwall':
      return wedgeGeometry(0.35)
    default:
      break
  }

  if (name.startsWith('halfwall')) {
    return wallGeometry({ height: STOREY_HEIGHT / 2 })
  }
  if (name.startsWith('quarterwall')) {
    return wallGeometry({ height: STOREY_HEIGHT / 2, span: [-0.5, 0] })
  }
  if (name.startsWith('stair')) return rampGeometry()
  if (name.startsWith('floor') || name.startsWith('balcony')) {
    return slabGeometry(FULL_TILE)
  }
  if (name.startsWith('roof')) return pyramidGeometry([true, true, true, true])
  if (/wall|door|window|arch/.test(name)) return wallGeometry()

  switch (kind) {
    case KIND_FLOOR:
      return slabGeometry(FULL_TILE)
    case KIND_WALL:
      return wallGeometry()
    case KIND_STAIR:
      return rampGeometry()
    case KIND_ROOF:
      return pyramidGeometry([true, true, true, true])
    default: {
      const box = new THREE.BoxGeometry(0.6, 0.4, 0.6)

      box.translate(0, 0.2, 0)

      return box
    }
  }
}

/** Upgrade tier shades the surface: raw tier 1, richer and darker by tier 3. */
function tierTint(tier: number) {
  if (tier >= 3) return new THREE.Color(0.8, 0.8, 0.82)
  if (tier === 2) return new THREE.Color(0.92, 0.92, 0.92)

  return new THREE.Color(1.04, 1.02, 0.98)
}

// ── Trap art ─────────────────────────────────────────────────

/** A flat square outline assembled from four strips, centred on the origin. */
function squareFrameGeometry(size: number, thickness: number) {
  const inset = size - thickness
  const parts = [
    new THREE.PlaneGeometry(size, thickness).translate(0, inset / 2, 0),
    new THREE.PlaneGeometry(size, thickness).translate(0, -inset / 2, 0),
    new THREE.PlaneGeometry(thickness, size - thickness * 2).translate(
      inset / 2,
      0,
      0
    ),
    new THREE.PlaneGeometry(thickness, size - thickness * 2).translate(
      -inset / 2,
      0,
      0
    ),
  ]
  const geometry = mergeGeometries(parts, false)

  parts.forEach((part) => part.dispose())

  return geometry ?? new THREE.PlaneGeometry(size, size)
}

/** Placement of a trap icon: where it sits and which way it faces. */
function trapPlacement(
  trap: OutpostLayout['traps'][number],
  toScene: (x: number, y: number, z: number) => THREE.Vector3,
  lift: number
) {
  const [x, y, z, category, , yaw = 0] = trap
  const centre = trapCentre(trap)
  const quarter = (yaw * Math.PI) / 2

  if (category === TRAP_WALL) {
    const [fx, fy] = forwardVector(yaw)

    return {
      position: toScene(x + fx * lift, y + fy * lift, z + STOREY_HEIGHT / 2),
      quaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, Math.PI / 2 - quarter, 0)
      ),
    }
  }

  if (category === TRAP_CEILING) {
    return {
      position: toScene(centre.x, centre.y, z - lift),
      quaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.PI / 2, -quarter, 0, 'YXZ')
      ),
    }
  }

  return {
    position: toScene(centre.x, centre.y, z + lift),
    quaternion: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 2, -quarter, 0, 'YXZ')
    ),
  }
}

// ── Scene ────────────────────────────────────────────────────

function BlueprintScene({
  amplifierSlots,
  cinematic,
  iconByTrapName,
  layout,
  maxVisibleZ,
  onHover,
  onRendererMode,
  onSelectTrap,
  onUnavailable,
  resetRef,
  selectedTrap,
  showGrid,
  showProps,
  showShield,
  showTerrain,
  topViewRef,
  zoneId,
}: {
  /** Occupied amplifier slots; each is drawn at the map's matching spot. */
  amplifierSlots?: Array<string>
  /** Post-processing and ambient animation; off keeps render-on-demand. */
  cinematic: boolean
  iconByTrapName: Map<string, string | undefined>
  layout: OutpostLayout
  maxVisibleZ: number
  onHover: (info: HoverInfo | null) => void
  onRendererMode: (mode: string | null) => void
  onSelectTrap: (name: string | null) => void
  onUnavailable: () => void
  resetRef: MutableRefObject<((wholeMap?: boolean) => void) | null>
  selectedTrap: string | null
  showGrid: boolean
  showProps: boolean
  showShield: boolean
  showTerrain: boolean
  topViewRef: MutableRefObject<(() => void) | null>
  zoneId?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const cameraStateRef = useRef<{
    position: [number, number, number]
    target: [number, number, number]
  } | null>(null)

  useEffect(() => {
    const host = hostRef.current

    if (!host) return

    let renderer: THREE.WebGLRenderer

    try {
      const canvas = document.createElement('canvas')
      const contextAttributes: WebGLContextAttributes = {
        alpha: true,
        antialias: true,
        depth: true,
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'high-performance',
      }
      const context =
        canvas.getContext('webgl2', contextAttributes) ??
        canvas.getContext('webgl', contextAttributes) ??
        canvas.getContext('experimental-webgl', contextAttributes)

      if (!context || !('getShaderPrecisionFormat' in context)) {
        onUnavailable()
        return
      }

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        context,
        powerPreference: 'high-performance',
      })
    } catch {
      onUnavailable()
      return
    }

    onRendererMode(
      renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1 compatibility'
    )
    // Multisampling already smooths edges; AO and bloom cost scales with pixels.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, cinematic ? 1.5 : 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.72
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.className = 'block size-full touch-none'
    host.replaceChildren(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500)
    const controls = new OrbitControls(camera, renderer.domElement)

    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxDistance = 220
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minDistance = 1.5
    controls.screenSpacePanning = true

    let disposed = false
    let post: ReturnType<typeof createPostProcessing> | null = null
    let onScreen = true
    let ambientTimer = 0
    let intro: { end: THREE.Spherical; start: number } | null = null
    const clock = new THREE.Clock()
    /** Per-frame updates for water, lava, wind, the shield and particles. */
    const animated: Array<(time: number) => void> = []
    const stepIntro = (now: number) => {
      if (!intro) return

      const progress = Math.min(1, (now - intro.start) / 2400)
      const remaining = Math.pow(1 - progress, 3)
      const { phi, radius, theta } = intro.end

      camera.position
        .setFromSpherical(new THREE.Spherical(
          radius * (1 + 1.6 * remaining),
          phi * (1 - 0.5 * remaining),
          theta - 1.2 * remaining
        ))
        .add(controls.target)
      if (progress >= 1) intro = null
    }
    const frames = renderOnDemand(() => {
      stepIntro(performance.now())
      // OrbitControls emits change while damping is still settling.
      controls.update()
      if (cinematic) {
        const time = clock.getElapsedTime()

        animated.forEach((update) => update(time))
      }
      if (post) post.render()
      else renderer.render(scene, camera)

      if (intro) requestDraw()
      else if (cinematic && onScreen && !ambientTimer && animated.length > 0) {
        // Ambient motion runs at 30 fps; orbiting still redraws immediately.
        ambientTimer = window.setTimeout(() => {
          ambientTimer = 0
          requestDraw()
        }, 1000 / 30)
      }
    })
    const requestDraw = frames.request
    const cancelIntro = () => {
      intro = null
    }
    controls.addEventListener('change', requestDraw)

    const resources: Array<{ dispose: () => void }> = []
    const track = <T extends { dispose: () => void }>(resource: T) => {
      resources.push(resource)

      return resource
    }

    const iconTextures = new Map<string, THREE.Texture>()
    const loadIconTexture = (url: string, onLoad: () => void) => {
      const cached = iconTextures.get(url)
      if (cached) return cached
      const texture = track(new THREE.TextureLoader().load(url, () => {
        if (disposed) { texture.dispose(); return }
        onLoad()
        requestDraw()
      }))
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      iconTextures.set(url, texture)
      return texture
    }

    const dummy = new THREE.Object3D()
    const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2
    const centerY = (layout.bounds.minY + layout.bounds.maxY) / 2
    const floorZ = layout.bounds.minZ
    const spanX = Math.max(1, layout.bounds.maxX - layout.bounds.minX)
    const spanY = Math.max(1, layout.bounds.maxY - layout.bounds.minY)
    const spanZ = Math.max(1, layout.bounds.maxZ - floorZ)
    const sceneWidth = Math.max(spanX, spanY)
    const distance = Math.max(12, sceneWidth * 1.2)
    /** Save space (x, y, z) → scene space; north stays north on screen. */
    const toScene = (x: number, y: number, z: number) =>
      new THREE.Vector3(y - centerY, z - floorZ, -(x - centerX))

    // Lighting: an HDRI sky (which also bakes the ambient environment)
    // plus one warm, shadow-casting sun matching the sky's own sun.
    createSky(renderer, scene, track, requestDraw)
    scene.fog = new THREE.Fog(HORIZON, distance * 3, distance * 11)
    scene.add(new THREE.HemisphereLight(0xd6e4ff, 0x4a3d2c, 0.3))

    const sun = new THREE.DirectionalLight(0xffe1bd, 3.1)
    const terrain = zoneId ? OUTPOST_ZONE_TERRAIN[zoneId] : undefined

    const groundMargin = 5
    const propReach = 25
    const visibleProps = showProps
      ? layout.props.filter(
          ([x, y, z]) =>
            z <= maxVisibleZ &&
            x >= layout.bounds.minX - propReach &&
            x <= layout.bounds.maxX + propReach &&
            y >= layout.bounds.minY - propReach &&
            y <= layout.bounds.maxY + propReach
        )
      : []
    const groundBounds = terrain
      ? {
          maxX: terrain.bounds.maxX + 3,
          maxY: terrain.bounds.maxY + 3,
          minX: terrain.bounds.minX - 3,
          minY: terrain.bounds.minY - 3,
        }
      : {
          maxX: layout.bounds.maxX + groundMargin,
          maxY: layout.bounds.maxY + groundMargin,
          minX: layout.bounds.minX - groundMargin,
          minY: layout.bounds.minY - groundMargin,
        }

    if (!terrain) {
      for (const [x, y] of visibleProps) {
        groundBounds.minX = Math.min(groundBounds.minX, x - 2)
        groundBounds.maxX = Math.max(groundBounds.maxX, x + 2)
        groundBounds.minY = Math.min(groundBounds.minY, y - 2)
        groundBounds.maxY = Math.max(groundBounds.maxY, y + 2)
      }
    }

    const groundWidth = groundBounds.maxY - groundBounds.minY
    const groundDepth = groundBounds.maxX - groundBounds.minX
    const groundCentre = toScene(
      (groundBounds.minX + groundBounds.maxX) / 2,
      (groundBounds.minY + groundBounds.maxY) / 2,
      floorZ
    )
    const shadowReach = Math.max(groundWidth, groundDepth) * 0.6

    const sunDistance = Math.max(groundWidth, groundDepth) + 40

    sun.position.copy(groundCentre).addScaledVector(SUN_DIRECTION, sunDistance)
    sun.target.position.copy(groundCentre)
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(terrain ? 4096 : 2048)
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = sunDistance * 2 + shadowReach
    sun.shadow.camera.left = -shadowReach
    sun.shadow.camera.right = shadowReach
    sun.shadow.camera.top = shadowReach
    sun.shadow.camera.bottom = -shadowReach
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.02
    scene.add(sun)
    scene.add(sun.target)

    const rememberCamera = () => {
      cameraStateRef.current = {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
      }
    }
    camera.near = Math.max(0.05, distance / 500)
    camera.far = Math.max(500, distance * 12)
    controls.maxDistance = Math.max(220, distance * 4)

    const resetCamera = (wholeMap = false) => {
      cancelIntro()
      if (wholeMap && terrain) {
        const mapCentre = toScene(
          (terrain.bounds.minX + terrain.bounds.maxX) / 2,
          (terrain.bounds.minY + terrain.bounds.maxY) / 2,
          floorZ
        )
        const reach = Math.max(groundWidth, groundDepth, groundWidth / camera.aspect)
        const mapDistance = reach / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))

        controls.maxDistance = Math.max(controls.maxDistance, mapDistance * 2)
        camera.far = Math.max(camera.far, mapDistance * 4)
        if (scene.fog instanceof THREE.Fog) {
          scene.fog.near = mapDistance * 0.8
          scene.fog.far = mapDistance * 3.5
        }
        controls.target.copy(mapCentre)
        camera.position.copy(mapCentre).add(new THREE.Vector3(mapDistance * 0.5, mapDistance * 0.65, mapDistance * 0.5))
        camera.updateProjectionMatrix()
        controls.update()
        rememberCamera()
        return
      }
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = distance * 3
        scene.fog.far = distance * 11
      }
      controls.target.set(0, spanZ * 0.35, 0)
      camera.position.set(distance * 0.7, Math.max(9, spanZ + distance * 0.45), distance * 0.72)
      camera.updateProjectionMatrix()
      controls.update()
      rememberCamera()
    }

    if (cameraStateRef.current) {
      camera.position.fromArray(cameraStateRef.current.position)
      controls.target.fromArray(cameraStateRef.current.target)
      camera.updateProjectionMatrix()
      controls.update()
    } else {
      resetCamera()
      // First visit: swoop down from high above onto the base.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        intro = {
          end: new THREE.Spherical().setFromVector3(
            camera.position.clone().sub(controls.target)
          ),
          start: performance.now(),
        }
        stepIntro(performance.now())
      }
    }
    resetRef.current = resetCamera
    topViewRef.current = () => {
      cancelIntro()
      controls.target.set(0, spanZ * 0.5, 0)
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
      const fitDistance = Math.max(spanX, spanY / camera.aspect) / (2 * Math.tan(halfFov))

      camera.position.set(0, spanZ + Math.max(6, fitDistance * 1.15), 0.001)
      controls.update()
      rememberCamera()
    }
    controls.addEventListener('change', rememberCamera)

    // Ground: the zone's extracted terrain when we have it, flat otherwise.
    const groundObjects = new THREE.Group()

    groundObjects.visible = showTerrain
    scene.add(groundObjects)

    const water = createWaterMaterial(track)
    /** Scene-space points where lava embers rise from. */
    const lavaVents: Array<THREE.Vector3> = []
    /** Extracted terrain meshes whose first material group is grass. */
    const terrainSurfaces: Array<THREE.InstancedMesh> = []

    /** Settles once recovered terrain meshes are in the scene. */
    let terrainReady: Promise<void> = Promise.resolve()

    animated.push(water.update)

    if (terrain && zoneId && ZONE_TERRAIN_ASSETS[zoneId]) {
      const recovered = createZoneTerrain({ onLoad: requestDraw, track, water: water.material, zoneId })
      const recoveredTerrain = recovered.group
      const backdrop = new THREE.Group()

      recoveredTerrain.position.set(-centerY, -floorZ, centerX)
      groundObjects.add(recoveredTerrain)
      // The game's distant scenery shares the zone's world frame.
      backdrop.position.copy(recoveredTerrain.position)
      groundObjects.add(backdrop)
      addZoneBackdrops(zoneId, backdrop, () => disposed).then(() => {
        if (!disposed) requestDraw()
      })
      if (showProps) {
        // The map's own trees, rocks and plants, as the game places them.
        const scenery = new THREE.Group()

        scenery.position.copy(recoveredTerrain.position)
        scene.add(scenery)
        addZoneScenery(zoneId, scenery, () => disposed).then(() => {
          if (disposed) return
          renderer.shadowMap.needsUpdate = true
          requestDraw()
        })
      }
      terrainReady = recovered.ready.then(() => {
        if (disposed) return
        recoveredTerrain.traverse((object) => {
          if (object instanceof THREE.InstancedMesh) terrainSurfaces.push(object)
        })
        // Molten rock slowly creeps and breathes.
        const lavaMaterials = new Set<THREE.MeshStandardMaterial>()

        recoveredTerrain.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          for (const material of [object.material].flat()) {
            if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0) lavaMaterials.add(material)
          }
        })
        lavaMaterials.forEach((material) => {
          const map = material.map

          animated.push((time) => {
            if (map) map.offset.set(time * 0.006, time * 0.011)
            material.emissiveIntensity = 1.35 + Math.sin(time * 0.9) * 0.25
          })
        })
        renderer.shadowMap.needsUpdate = true
        requestDraw()
      })
      // Only zones with shoreline sit in water; Stonewood floats above its
      // badlands like in the game.
      // Only Twine sits in the sea (its map streams OutpostTwineWater); the
      // other outposts float above their backdrop ground like in the game.
      if (zoneId === 'pve_04') {
        const sea = new THREE.Mesh(track(worldWaterUVs(twineOceanGeometry(terrain, OPEN_SEA_REACH))), water.material)

        sea.position.set(-centerY, -floorZ, centerX)
        groundObjects.add(sea)
        const seabed = water.seabed(OPEN_SEA_REACH * 2)

        seabed.position.copy(groundCentre).setY(terrain.waterZ - floorZ - 2.5)
        groundObjects.add(seabed)
      }

      for (const instance of zoneId === 'pve_04' ? TWINE_TERRAIN.instances : []) {
        if (TWINE_TERRAIN.models[instance[0]]?.kind !== 'lava') continue
        lavaVents.push(
          new THREE.Vector3().setFromMatrixPosition(twineInstanceMatrix(instance)).add(recoveredTerrain.position)
        )
      }
    } else if (terrain) {
      const heightGrid = buildZoneHeightGrid(terrain)
      const { cols, heights, kinds, minX, minY, rows } = heightGrid
      const positions = new Float32Array(rows * cols * 3)
      const colorValues = new Float32Array(rows * cols * 3)
      const uvs = new Float32Array(rows * cols * 2)
      const color = new THREE.Color()
      let zMin = Infinity
      let zMax = -Infinity

      for (const height of heights) {
        zMin = Math.min(zMin, height)
        zMax = Math.max(zMax, height)
      }

      for (let ix = 0; ix < rows; ix++) {
        for (let iy = 0; iy < cols; iy++) {
          const i = ix * cols + iy
          const vertex = toScene(minX + ix, minY + iy, heights[i])
          const base = CELL_COLORS[kinds[i]] ?? CELL_COLORS[CELL_GRASS]
          const neighbourHeights = [
            ix > 0 ? heights[i - cols] : heights[i],
            ix + 1 < rows ? heights[i + cols] : heights[i],
            iy > 0 ? heights[i - 1] : heights[i],
            iy + 1 < cols ? heights[i + 1] : heights[i],
          ]
          const slope = Math.max(
            ...neighbourHeights.map((height) => Math.abs(height - heights[i]))
          )
          const rockBlend =
            kinds[i] === CELL_GRASS ? Math.min(0.72, slope * 0.38) : 0
          const rock = CELL_COLORS[3]
          const r = base[0] + (rock[0] - base[0]) * rockBlend
          const g = base[1] + (rock[1] - base[1]) * rockBlend
          const b = base[2] + (rock[2] - base[2]) * rockBlend
          const relief =
            0.72 + 0.4 * ((heights[i] - zMin) / Math.max(1, zMax - zMin))
          const shade = cellShade(minX + ix, minY + iy) * relief

          positions.set([vertex.x, vertex.y, vertex.z], i * 3)
          uvs.set([iy / groundWidth, ix / groundDepth], i * 2)
          color.setRGB(
            Math.min(1, (r / 255) * shade),
            Math.min(1, (g / 255) * shade),
            Math.min(1, (b / 255) * shade),
            THREE.SRGBColorSpace
          )
          colorValues.set([color.r, color.g, color.b], i * 3)
        }
      }

      const indices: Array<number> = []

      for (let ix = 0; ix < rows - 1; ix++) {
        for (let iy = 0; iy < cols - 1; iy++) {
          const a = ix * cols + iy
          const b = a + 1
          const c = a + cols
          const d = c + 1

          indices.push(a, b, c, b, d, c)
        }
      }

      const terrainGeometry = track(new THREE.BufferGeometry())

      terrainGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      )
      terrainGeometry.setAttribute(
        'color',
        new THREE.BufferAttribute(colorValues, 3)
      )
      terrainGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      terrainGeometry.setIndex(indices)
      terrainGeometry.computeVertexNormals()

      const terrainMap = track(terrainDetailTexture())

      terrainMap.repeat.set(groundWidth / 3.5, groundDepth / 3.5)

      const terrainMesh = new THREE.Mesh(
        terrainGeometry,
        track(
          new THREE.MeshStandardMaterial({
            bumpMap: terrainMap,
            bumpScale: 0.035,
            map: terrainMap,
            roughness: 0.9,
            vertexColors: true,
          })
        )
      )

      terrainMesh.receiveShadow = true
      groundObjects.add(terrainMesh)

      /* The sea around the island, just above the seabed cells. */
      const seaGeometry = new THREE.PlaneGeometry(groundWidth + OPEN_SEA_REACH * 2, groundDepth + OPEN_SEA_REACH * 2)

      seaGeometry.rotateX(-Math.PI / 2)
      const sea = new THREE.Mesh(track(worldWaterUVs(seaGeometry)), water.material)

      sea.position
        .copy(groundCentre)
        .setY(terrain.waterZ - floorZ + 0.02)
      groundObjects.add(sea)
      const seabed = water.seabed(OPEN_SEA_REACH * 2)

      seabed.position.copy(groundCentre).setY(terrain.waterZ - floorZ - 2.5)
      groundObjects.add(seabed)

      /* Lava pools glow on their own, unlit. */
      if (terrain.lava.length > 0) {
        const glowGeometry = track(new THREE.PlaneGeometry(1, 1))
        const magmaMap = track(lavaTexture())

        magmaMap.repeat.set(2, 2)
        const glow = new THREE.InstancedMesh(
          glowGeometry,
          track(
            new THREE.MeshBasicMaterial({
              color: 0xff7b2d,
              map: magmaMap,
              opacity: 0.94,
              side: THREE.DoubleSide,
              toneMapped: false,
              transparent: true,
            })
          ),
          terrain.lava.length
        )

        animated.push((time) => magmaMap.offset.set(time * 0.012, time * 0.02))
        terrain.lava.forEach(
          ([x, y, z, halfX = 1.5, halfY = 1.5], index) => {
            lavaVents.push(toScene(x, y, z + 0.08))
            dummy.position.copy(toScene(x, y, z + 0.08))
            dummy.rotation.set(-Math.PI / 2, 0, 0)
            dummy.scale.set(halfY * 2, halfX * 2, 1)
            dummy.updateMatrix()
            glow.setMatrixAt(index, dummy.matrix)
          }
        )
        glow.computeBoundingSphere()
        groundObjects.add(glow)
      }
    } else {
      const groundMap = track(groundTexture())

      // Run the meadow out to the fog so there is no visible edge.
      const horizonWidth = groundWidth + distance * 14
      const horizonDepth = groundDepth + distance * 14

      groundMap.repeat.set(horizonWidth / 4, horizonDepth / 4)

      const ground = new THREE.Mesh(
        track(new THREE.PlaneGeometry(horizonWidth, horizonDepth)),
        track(
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: groundMap,
            roughness: 1,
          })
        )
      )

      ground.rotation.x = -Math.PI / 2
      ground.position.copy(groundCentre).setY(-FLOOR_THICKNESS - 0.02)
      ground.receiveShadow = true
      groundObjects.add(ground)
    }

    /*
     * A calibrated overhead capture of the zone, when one is configured,
     * lies on top of the ground so the build sits on the real terrain.
     * Skipped when extracted terrain already provides the real ground.
     * Blueprint x runs along scene X and blueprint y along scene Z, so the
     * rectangle maps straight onto a flat plane.
     */
    const underlay =
      zoneId && !terrain ? OUTPOST_MAP_UNDERLAYS[zoneId] : undefined

    if (underlay) {
      const rect = underlayBlueprintRect(underlay)
      const url = assets(underlay.image) ?? underlay.image
      const texture = loadIconTexture(url, () => {
        underlayMaterial.needsUpdate = true
      })

      texture.repeat.set(underlay.mirrorX ? -1 : 1, underlay.mirrorY ? -1 : 1)
      texture.offset.set(underlay.mirrorX ? 1 : 0, underlay.mirrorY ? 1 : 0)

      const underlayMaterial = track(
        new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
      )
      const plane = new THREE.Mesh(
        track(new THREE.PlaneGeometry(rect.width, rect.height)),
        underlayMaterial
      )

      plane.rotation.x = -Math.PI / 2
      plane.position.set(
        rect.x + rect.width / 2 - centerY,
        -FLOOR_THICKNESS - 0.012,
        rect.y + rect.height / 2 + centerX
      )
      plane.receiveShadow = true
      groundObjects.add(plane)
    }

    if (showGrid) {
      const gridSize = Math.ceil(Math.max(groundWidth, groundDepth))
      const grid = new THREE.GridHelper(
        gridSize,
        Math.min(160, Math.max(4, gridSize)),
        0x9aa4b8,
        0x55607a
      )

      grid.position.copy(groundCentre).setY(-FLOOR_THICKNESS - 0.005)
      /* The grid is cosmetic; it should not collect shadows or block picks. */
      ;(grid.material as THREE.Material).transparent = true
      ;(grid.material as THREE.Material).opacity = 0.45
      track(grid.geometry)
      track(grid.material as THREE.Material)
      scene.add(grid)
    }

    // Structures, instanced per (shape, material).
    const surfaces = [
      track(woodTexture()),
      track(stoneTexture()),
      track(metalTexture()),
    ]
    const textureCache = new Map<string, THREE.Texture>()
    const materialCache = new Map<string, THREE.MeshStandardMaterial>()
    const surfaceTexture = (url: string, normal = false) => {
      const key = `${url}:${normal}`
      const cached = textureCache.get(key)

      if (cached) return cached

      const texture = track(new THREE.TextureLoader().load(url, requestDraw))

      texture.colorSpace = normal ? THREE.NoColorSpace : THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      textureCache.set(key, texture)

      return texture
    }
    const materialFor = (code: number, tier: number, kind: number) => {
      const key = `${code}:${tier}:${kind}`
      const cached = materialCache.get(key)

      if (cached) return cached

      const surface = archiveBuildSurface(code, tier, kind)
      const map = surface ? surfaceTexture(surface.color) : surfaces[code] ?? null
      const material = track(new THREE.MeshStandardMaterial({
        color: code === 3 ? MATERIAL_COLORS[3] : 0xffffff,
        map,
        normalMap: surface?.normal ? surfaceTexture(surface.normal, true) : null,
        normalScale: new THREE.Vector2(0.55, 0.55),
        bumpMap: surface?.normal ? null : map,
        bumpScale: code === 0 ? 0.008 : 0.004,
        vertexColors: true,
        metalness: code === 2 ? 0.42 : 0.02,
        roughness: code === 2 ? 0.42 : 0.9,
      }))

      materialCache.set(key, material)

      return material
    }
    const geometryCache = new Map<string, THREE.BufferGeometry>()
    const geometryFor = (shape: string, kind: number, material: number, tier: number) => {
      const key = `${shape}|${kind}|${material}|${tier}`
      let geometry = geometryCache.get(key)

      if (!geometry) {
        geometry = track(buildPieceMesh(shape, material, tier, () => shapeGeometry(shape, kind)))
        geometryCache.set(key, geometry)
      }

      return geometry
    }
    const groups = new Map<string, Array<OutpostLayout['structures'][number]>>()

    for (const piece of layout.structures) {
      if (piece[2] > maxVisibleZ) continue

      const key = `${piece[6]}:${piece[4]}:${piece[3]}:${piece[7]}`
      const group = groups.get(key)

      if (group) group.push(piece)
      else groups.set(key, [piece])
    }

    /** Procedural stand-ins waiting to be swapped for the game's own pieces. */
    const standIns: Array<{ key: string; mesh: THREE.InstancedMesh }> = []

    for (const pieces of groups.values()) {
      const [, , , materialCode, kind, , shapeIndex, upgradeTier] = pieces[0]
      const shape = layout.shapes[shapeIndex] ?? ''
      const pieceKey = buildPieceKey(materialCode, upgradeTier, shape)
      const mesh = new THREE.InstancedMesh(
        geometryFor(shape, kind, materialCode, upgradeTier),
        materialFor(materialCode, upgradeTier, kind),
        pieces.length
      )

      pieces.forEach(([x, y, z, , , yaw, , tier], index) => {
        dummy.position.copy(toScene(x, y, z))
        dummy.rotation.set(0, -(yaw * Math.PI) / 2, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
        mesh.setColorAt(index, materialCode === 0 || materialCode === 1
          ? new THREE.Color(1, 1, 1) : tierTint(tier))
      })
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.computeBoundingSphere()
      scene.add(mesh)
      if (pieceKey) standIns.push({ key: pieceKey, mesh })
    }

    // Swap in the real build pieces once their library has streamed in.
    loadBuildLibrary().then(
      (library) => {
        if (disposed) return
        const white = new THREE.Color(1, 1, 1)

        for (const { key, mesh } of standIns) {
          const parts = library.get(key)

          if (!parts?.length) continue
          for (const part of parts) {
            const real = new THREE.InstancedMesh(part.geometry, part.material, mesh.count)

            real.instanceMatrix.copy(mesh.instanceMatrix)
            for (let index = 0; index < mesh.count; index++) real.setColorAt(index, white)
            real.castShadow = true
            real.receiveShadow = true
            real.computeBoundingSphere()
            scene.add(real)
          }
          scene.remove(mesh)
          mesh.dispose()
        }
        renderer.shadowMap.needsUpdate = true
        requestDraw()
      },
      () => {
        // Keep the procedural pieces when the library cannot load.
      }
    )

    // The Storm Shield device and any placed amplifiers, as the game models.
    const amplifierSpots = (amplifierSlots ?? [])
      .filter((slot) => /^\d+$/.test(slot))
      .map((slot) => terrain?.amplifiers?.[Number(slot)])
      .filter((spot): spot is Array<number> => Boolean(spot))
    const outpostPlacements: Array<{ models: Array<string>; spot: Array<number> }> = [
      ...(terrain?.stormShield ? [{ models: ['stormshield', 'stormshieldtop'], spot: terrain.stormShield }] : []),
      ...amplifierSpots.map((spot) => ({ models: ['amplifier', 'amplifierfloor'], spot })),
    ]

    if (outpostPlacements.length > 0) {
      loadOutpostModels().then(
        (models) => {
          if (disposed) return
          for (const { models: names, spot } of outpostPlacements) {
            const [x, y, z, yawDegrees = 0] = spot

            for (const name of names) {
              for (const part of models.get(name) ?? []) {
                const mesh = new THREE.Mesh(part.geometry, part.material)

                mesh.position.copy(toScene(x, y, z))
                mesh.rotation.set(0, -(yawDegrees * Math.PI) / 180, 0)
                mesh.castShadow = true
                mesh.receiveShadow = true
                scene.add(mesh)
              }
            }
          }
          renderer.shadowMap.needsUpdate = true
          requestDraw()
        },
        () => {
          // The shield bubble still marks the spot without the models.
        }
      )
    }

    // Traps: surface-mounted plates with the real inventory art kept legible.
    const visibleTraps = layout.traps.filter((trap) => trap[2] <= maxVisibleZ)
    const fallbackIcon = assets('voucher_generic_trap')
    const iconGroups = new Map<string, Array<OutpostLayout['traps'][number]>>()

    for (const trap of visibleTraps) {
      const name = layout.trapNames[trap[4]] ?? 'Unknown trap'
      const iconKey = iconByTrapName.get(name)
      const url = (iconKey ? assets(iconKey) : undefined) ?? fallbackIcon ?? ''
      const group = iconGroups.get(url)

      if (group) group.push(trap)
      else iconGroups.set(url, [trap])
    }

    const pickables: Array<THREE.InstancedMesh> = []
    const namesByMesh = new Map<string, Array<string>>()
    const iconGeometry = track(new THREE.PlaneGeometry(0.46, 0.46))
    const mountGeometry = track(new THREE.PlaneGeometry(0.58, 0.58))
    const frameGeometry = track(squareFrameGeometry(0.62, 0.035))
    const selectionGeometry = track(squareFrameGeometry(0.72, 0.035))
    const selectionOnMap = visibleTraps.some(
      (trap) => layout.trapNames[trap[4]] === selectedTrap
    )
    const dimmed = new THREE.Color(0.45, 0.45, 0.45)
    const bright = new THREE.Color(1, 1, 1)
    const selectedPlacements: Array<ReturnType<typeof trapPlacement>> = []
    const disposeTrapMaterial = (material: THREE.Material) => track(material)
    const mountsByCategory = new Map<number, Array<OutpostLayout['traps'][number]>>()
    /** Icon art and backing plates, hidden where the real trap model stands. */
    const artMeshes: Array<{ mesh: THREE.InstancedMesh; names: Array<string> }> = []

    for (const [url, traps] of iconGroups) {
      const material = disposeTrapMaterial(
        new THREE.MeshBasicMaterial({
          alphaTest: 0.08,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          side: THREE.DoubleSide,
          toneMapped: false,
          transparent: true,
        })
      ) as THREE.MeshBasicMaterial

      if (url) {
        const texture = loadIconTexture(url, () => {
          material.needsUpdate = true
        })

        material.map = texture
        material.needsUpdate = true
      }

      const mesh = new THREE.InstancedMesh(iconGeometry, material, traps.length)
      const names: Array<string> = []

      traps.forEach((trap, index) => {
        const name = layout.trapNames[trap[4]] ?? 'Unknown trap'
        const selected = selectedTrap === name
        const placement = trapPlacement(
          trap,
          toScene,
          0.03
        )

        names[index] = name
        dummy.position.copy(placement.position)
        dummy.quaternion.copy(placement.quaternion)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
        mesh.setColorAt(index, selectionOnMap && !selected ? dimmed : bright)

        if (selected) {
          selectedPlacements.push(trapPlacement(trap, toScene, 0.036))
        }

        const mounts = mountsByCategory.get(trap[3])

        if (mounts) mounts.push(trap)
        else mountsByCategory.set(trap[3], [trap])
      })
      mesh.renderOrder = 2
      mesh.computeBoundingSphere()
      scene.add(mesh)
      pickables.push(mesh)
      namesByMesh.set(mesh.uuid, names)
      artMeshes.push({ mesh, names })
    }

    for (const [category, traps] of mountsByCategory) {
      const categoryColor = TRAP_COLORS[category] ?? TRAP_COLORS[3]
      const mountMaterial = disposeTrapMaterial(
        new THREE.MeshBasicMaterial({
          color: 0x17202a,
          depthWrite: false,
          opacity: 0.84,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          side: THREE.DoubleSide,
          toneMapped: false,
          transparent: true,
        })
      )
      const frameMaterial = disposeTrapMaterial(
        new THREE.MeshBasicMaterial({
          color: categoryColor,
          depthWrite: false,
          opacity: 0.95,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          side: THREE.DoubleSide,
          toneMapped: false,
          transparent: true,
        })
      )
      const mount = new THREE.InstancedMesh(
        mountGeometry,
        mountMaterial,
        traps.length
      )
      const frame = new THREE.InstancedMesh(
        frameGeometry,
        frameMaterial,
        traps.length
      )
      const names: Array<string> = []

      traps.forEach((trap, index) => {
        const name = layout.trapNames[trap[4]] ?? 'Unknown trap'
        const mountPlacement = trapPlacement(trap, toScene, 0.012)
        const framePlacement = trapPlacement(trap, toScene, 0.02)

        names[index] = name
        dummy.position.copy(mountPlacement.position)
        dummy.quaternion.copy(mountPlacement.quaternion)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mount.setMatrixAt(index, dummy.matrix)

        dummy.position.copy(framePlacement.position)
        dummy.quaternion.copy(framePlacement.quaternion)
        dummy.updateMatrix()
        frame.setMatrixAt(index, dummy.matrix)
      })
      mount.renderOrder = 1
      frame.renderOrder = 2
      mount.computeBoundingSphere()
      frame.computeBoundingSphere()
      scene.add(mount, frame)
      artMeshes.push({ mesh: mount, names })
      pickables.push(mount, frame)
      namesByMesh.set(mount.uuid, names)
      namesByMesh.set(frame.uuid, names)
    }

    let selectionRing: THREE.InstancedMesh | null = null

    // The game's own trap models on every trap that has one. Icon plates
    // stay pickable (hidden meshes still raycast) and the category frames
    // and selection ring stay visible on top.
    loadTrapModels().then(
      (models) => {
        if (disposed) return
        const placed = new Map<string, Array<OutpostLayout['traps'][number]>>()

        for (const trap of visibleTraps) {
          const key = trapModelKey(layout.trapNames[trap[4]] ?? '')

          if (!models.has(key)) continue
          placed.set(key, [...(placed.get(key) ?? []), trap])
        }
        for (const [key, traps] of placed) {
          for (const part of models.get(key) ?? []) {
            const mesh = new THREE.InstancedMesh(part.geometry, part.material, traps.length)

            traps.forEach((trap, index) => {
              const [x, y, z, category, , yaw = 0] = trap
              // Floor/ceiling models are centred on their tile (see
              // extract_blueprint_models.py), like the icon frames.
              const at = category === TRAP_WALL ? { x, y, z } : trapCentre(trap)

              dummy.position.copy(toScene(at.x, at.y, at.z))
              dummy.rotation.set(0, -(yaw * Math.PI) / 2, 0)
              dummy.scale.setScalar(1)
              dummy.updateMatrix()
              mesh.setMatrixAt(index, dummy.matrix)
            })
            mesh.castShadow = true
            mesh.receiveShadow = true
            mesh.computeBoundingSphere()
            scene.add(mesh)
          }
        }
        for (const { mesh, names } of artMeshes) {
          if (names.every((name) => models.has(trapModelKey(name)))) mesh.visible = false
        }
        renderer.shadowMap.needsUpdate = true
        requestDraw()
      },
      () => {
        // Icon plates remain the trap markers without the models.
      }
    )

    if (selectedPlacements.length > 0) {
      const ring = new THREE.InstancedMesh(
        selectionGeometry,
        disposeTrapMaterial(
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            side: THREE.DoubleSide,
            toneMapped: false,
          })
        ),
        selectedPlacements.length
      )

      selectedPlacements.forEach((placement, index) => {
        dummy.position.copy(placement.position)
        dummy.quaternion.copy(placement.quaternion)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        ring.setMatrixAt(index, dummy.matrix)
      })
      ring.renderOrder = 3
      ring.computeBoundingSphere()
      scene.add(ring)
      selectionRing = ring
    }

    // World props, instanced per silhouette. The zone's own vegetation and
    // boulders (from the extracted terrain) join the save's recorded actors.
    // With the real zone scenery loaded, stand-ins are only for props it
    // does not cover (containers, world structures).
    const realScenery = hasZoneScenery(zoneId)
    const zoneExtra =
      terrain && showProps && !realScenery ? zonePropsAsLayout(terrain, layout.props) : null
    const propEntries = [
      ...visibleProps.map((prop) => ({
        className: layout.propNames[prop[6]] ?? '',
        prop,
      })),
      ...(zoneExtra?.props ?? [])
        .filter((prop) => prop[2] <= maxVisibleZ)
        .map((prop) => ({
          className: zoneExtra?.names[prop[6]] ?? '',
          prop,
        })),
    ]
    const propGroups = new Map<
      string,
      { pieces: Array<OutpostLayout['props'][number]>; style: PropStyle }
    >()

    const windTime = { value: 0 }

    animated.push((time) => {
      windTime.value = time
    })

    const addProceduralProp = (className: string, prop: OutpostLayout['props'][number]) => {
      for (const [key, style] of Object.entries(propStyle(prop[3], className))) {
        const group = propGroups.get(key)

        if (group) group.pieces.push(prop)
        else propGroups.set(key, { pieces: [prop], style })
      }
    }
    const addProceduralGroups = () => {
      for (const { pieces, style } of propGroups.values()) {
        const material = track(
          new THREE.MeshStandardMaterial({
            color: style.color,
            flatShading: style.faceted ?? false,
            roughness: 0.95,
          })
        )

        if (style.sway) addWindSway(material, windTime, style.sway)

        const mesh = new THREE.InstancedMesh(track(style.geometry()), material, pieces.length)

        pieces.forEach(([x, y, z, , yawDegrees, scale], index) => {
          dummy.position.copy(toScene(x, y, z))
          dummy.rotation.set(0, -(yawDegrees * Math.PI) / 180, 0)
          dummy.scale.setScalar(Math.min(2.2, Math.max(0.5, scale || 1)))
          dummy.updateMatrix()
          mesh.setMatrixAt(index, dummy.matrix)
          mesh.setColorAt(index, propTint(style, x, y))
        })
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.computeBoundingSphere()
        scene.add(mesh)
      }
    }
    /** Foliage and boulders wait for the painted model library. */
    const naturalProps: Array<{
      className: string
      placement: NaturePlacement
      prop: OutpostLayout['props'][number]
    }> = []

    for (const { className, prop } of propEntries) {
      const [x, y, z, kind, yawDegrees, scale] = prop
      const archetype = natureArchetype(kind, className, x, y)

      if (archetype && realScenery) continue
      if (!archetype) {
        addProceduralProp(className, prop)
        continue
      }
      naturalProps.push({
        className,
        placement: {
          archetype,
          position: toScene(x, y, z),
          scale: Math.min(2.2, Math.max(0.5, scale || 1)),
          yaw: -(yawDegrees * Math.PI) / 180,
        },
        prop,
      })
    }
    addProceduralGroups()

    // Grass and flowers carpet the ground around the base, but not under it.
    const coverAvoid = {
      maxX: layout.bounds.maxY - centerY + 0.5,
      maxZ: -(layout.bounds.minX - centerX) + 0.5,
      minX: layout.bounds.minY - centerY - 0.5,
      minZ: -(layout.bounds.maxX - centerX) - 0.5,
    }
    const coverPlacements = (): Array<NaturePlacement> => {
      // Ground cover is detail, so it belongs to the cinematic quality mode.
      if (!cinematic || !showProps || !showTerrain || realScenery) return []
      if (terrainSurfaces.length > 0) {
        return scatterGroundCover({
          avoid: coverAvoid,
          centre: new THREE.Vector3(0, 0, 0),
          count: 1200,
          radius: Math.max(22, sceneWidth * 1.4),
          surfaces: terrainSurfaces,
        })
      }
      if (terrain) return []
      const reach = Math.max(18, sceneWidth * 1.3)

      return scatterFlatGroundCover({
        avoid: coverAvoid,
        bounds: { maxX: reach, maxZ: reach, minX: -reach, minZ: -reach },
        count: 1000,
        y: -FLOOR_THICKNESS - 0.02,
      })
    }

    Promise.all([loadNatureLibrary(), terrainReady]).then(
      ([library]) => {
        if (disposed) return
        const foliage = buildNatureMeshes(library, naturalProps.map((entry) => entry.placement), windTime, track)
        const cover = buildNatureMeshes(library, coverPlacements(), windTime, track)

        if (foliage.length > 0) scene.add(...foliage)
        if (cover.length > 0) groundObjects.add(...cover)
        renderer.shadowMap.needsUpdate = true
        requestDraw()
      },
      () => {
        if (disposed) return
        // Without the model library, fall back to the procedural stand-ins.
        propGroups.clear()
        naturalProps.forEach(({ className, prop }) => addProceduralProp(className, prop))
        addProceduralGroups()
        renderer.shadowMap.needsUpdate = true
        requestDraw()
      }
    )

    // The Storm Shield bubble over the base, with drifting energy motes.
    // The game centres the bubble on the Storm Shield device itself.
    const device = terrain?.stormShield
    const shieldCentre = device ? toScene(device[0], device[1], device[2]) : new THREE.Vector3()

    if (showShield) {
      let reach = Math.hypot(spanX, spanY) / 2

      if (device) {
        reach = 0
        for (const [x, y, z] of layout.structures) {
          reach = Math.max(reach, toScene(x, y, z).setY(shieldCentre.y).distanceTo(shieldCentre))
        }
      }
      const radius = Math.max(8, reach + 3)
      const shield = createStormShield(radius, track)
      const motes = createParticles({
        cool: 0x7c5cff,
        count: 260,
        emitters: [shieldCentre.clone()],
        hot: 0x9fdcff,
        pixelRatio: renderer.getPixelRatio(),
        rise: spanZ + 5,
        size: 55,
        spread: radius * 0.85,
        track,
      })

      shield.mesh.position.copy(shieldCentre)
      scene.add(shield.mesh, motes.points)
      animated.push(shield.update, motes.update)
    }

    // Embers boiling off the lava.
    if (showTerrain && lavaVents.length > 0) {
      const embers = createParticles({
        cool: 0xff3a12,
        count: Math.min(1400, lavaVents.length * 60),
        emitters: lavaVents,
        hot: 0xffc15a,
        pixelRatio: renderer.getPixelRatio(),
        rise: 4,
        size: 70,
        spread: 1.6,
        track,
      })

      groundObjects.add(embers.points)
      animated.push(embers.update)
    }

    // Selected traps pulse so they are easy to spot from afar.
    if (selectionRing) {
      const ringMaterial = selectionRing.material as THREE.MeshBasicMaterial

      animated.push((time) => {
        ringMaterial.color.setScalar(1.2 + Math.sin(time * 4) * 0.8)
      })
    }

    if (cinematic && renderer.capabilities.isWebGL2) {
      post = createPostProcessing(renderer, scene, camera)
    }
    // Nothing in the scene moves relative to the sun, so shadows are drawn once.
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true

    // Picking and hover.
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerDown = { x: 0, y: 0 }
    let lastHover: string | null = null

    const pickTrap = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()

      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(pointer, camera)

      const hit = raycaster.intersectObjects(pickables, false)[0]

      if (!hit || hit.instanceId === undefined) return null

      const names = namesByMesh.get(hit.object.uuid)
      const name = names?.[hit.instanceId]

      if (!name) return null

      const category = visibleTraps.find(
        (trap) => layout.trapNames[trap[4]] === name
      )?.[3]

      return {
        category: category ?? 3,
        name,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      cancelIntro()
      pointerDown = { x: event.clientX, y: event.clientY }
    }
    const onPointerMove = (event: PointerEvent) => {
      const hit = pickTrap(event)

      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'

      if (hit) {
        onHover(hit)
        lastHover = hit.name
      } else if (lastHover !== null) {
        lastHover = null
        onHover(null)
      }
    }
    const onPointerLeave = () => {
      lastHover = null
      onHover(null)
    }
    const onPointerUp = (event: PointerEvent) => {
      const moved =
        Math.abs(event.clientX - pointerDown.x) +
        Math.abs(event.clientY - pointerDown.y)

      if (moved > 5) return

      const hit = pickTrap(event)

      if (hit) onSelectTrap(hit.name === selectedTrap ? null : hit.name)
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('wheel', cancelIntro, { passive: true })
    const onContextLost = (event: Event) => {
      event.preventDefault()
      onUnavailable()
    }

    renderer.domElement.addEventListener('webglcontextlost', onContextLost)

    const resize = () => {
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)

      renderer.setSize(width, height, false)
      post?.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      requestDraw()
    }
    const observer = new ResizeObserver(resize)

    observer.observe(host)
    resize()

    // Ambient motion pauses while the explorer is scrolled out of view.
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      if (onScreen) requestDraw()
    })

    visibility.observe(host)

    requestDraw()

    return () => {
      disposed = true
      frames.dispose()
      window.clearTimeout(ambientTimer)
      controls.removeEventListener('change', requestDraw)
      observer.disconnect()
      visibility.disconnect()
      post?.dispose()
      rememberCamera()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('wheel', cancelIntro)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      controls.dispose()
      sun.shadow.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.dispose()
      })
      resources.forEach((resource) => resource.dispose())
      renderer.dispose()
      renderer.domElement.remove()
      resetRef.current = null
      topViewRef.current = null
    }
  }, [
    iconByTrapName,
    layout,
    maxVisibleZ,
    onHover,
    onRendererMode,
    onSelectTrap,
    onUnavailable,
    resetRef,
    selectedTrap,
    showGrid,
    showProps,
    showShield,
    showTerrain,
    topViewRef,
    zoneId,
    cinematic,
    amplifierSlots,
  ])

  return <div className="absolute inset-0" ref={hostRef} />
}

function LegendSwatch({
  color,
  label,
  round,
}: {
  color: string
  label: string
  round?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn('inline-block size-2.5', round ? 'rounded-full' : 'rounded-sm')}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

export function Blueprint3D({
  amplifierSlots,
  layout,
  onSelectTrap,
  selectedTrap,
  traps,
  zoneId,
}: {
  /** Occupied amplifier slots for the zone (`"00"`, `"01"` …). */
  amplifierSlots?: Array<string>
  layout: OutpostLayout
  onSelectTrap: (name: string | null) => void
  selectedTrap: string | null
  /** The scan's trap groups — supplies each dot's icon and placed count. */
  traps: Array<OutpostTrap>
  /** Picks the zone's calibrated map underlay, when one is configured. */
  zoneId?: string
}) {
  const zoneTerrain = zoneId ? OUTPOST_ZONE_TERRAIN[zoneId] : undefined
  const underlay =
    zoneId && !zoneTerrain ? OUTPOST_MAP_UNDERLAYS[zoneId] : undefined
  const heights = useMemo(() => outpostHeightLevels(layout), [layout])
  const [levelIndex, setLevelIndex] = useState(Math.max(0, heights.length - 1))
  const [showProps, setShowProps] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [showTerrain, setShowTerrain] = useState(true)
  const [showShield, setShowShield] = useState(true)
  const [cinematic, setCinematic] = useState(
    () => localStorage.getItem(cinematicStorageKey) !== '0'
  )
  const [hovered, setHovered] = useState<HoverInfo | null>(null)
  const [canvasFallback, setCanvasFallback] = useState(
    () => sessionStorage.getItem(canvasFallbackSessionKey) === '1'
  )
  const [rendererMode, setRendererMode] = useState<string | null>(() =>
    sessionStorage.getItem(canvasFallbackSessionKey) === '1'
      ? 'Canvas 2D compatibility'
      : null
  )
  const resetRef = useRef<((wholeMap?: boolean) => void) | null>(null)
  const topViewRef = useRef<(() => void) | null>(null)
  const maxVisibleZ = heights[levelIndex] ?? layout.bounds.maxZ
  const visibleStructures = layout.structures.filter(
    (piece) => piece[2] <= maxVisibleZ
  ).length
  const visibleTraps = layout.traps.filter((trap) => trap[2] <= maxVisibleZ).length
  const worldAssets = layout.props.length
  const iconByTrapName = useMemo(
    () => new Map(traps.map((trap) => [trap.displayName, trap.iconKey])),
    [traps]
  )
  const trapsByName = useMemo(
    () => new Map(traps.map((trap) => [trap.displayName, trap])),
    [traps]
  )
  const hoveredGroup = hovered ? trapsByName.get(hovered.name) : undefined
  const useCanvasFallback = useCallback(() => {
    sessionStorage.setItem(canvasFallbackSessionKey, '1')
    setRendererMode('Canvas 2D compatibility')
    setCanvasFallback(true)
  }, [])

  useEffect(() => {
    setLevelIndex(Math.max(0, heights.length - 1))
  }, [heights])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 micro-label text-muted-foreground">
          <Box className="size-3" />
          3D explorer · {visibleStructures} structures · {visibleTraps} traps
          {worldAssets > 0 && ` · ${worldAssets} world assets`}
          {rendererMode && ` · ${rendererMode}`}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Layers3 className="size-3.5 text-muted-foreground" />
          <label className="micro-label text-muted-foreground" htmlFor="outpost-height-layer">
            {levelIndex === heights.length - 1
              ? `All ${heights.length} heights`
              : `Through height ${maxVisibleZ.toFixed(2)}`}
          </label>
          <input
            className="w-28 accent-primary"
            disabled={heights.length <= 1}
            id="outpost-height-layer"
            max={Math.max(0, heights.length - 1)}
            min={0}
            onChange={(event) => setLevelIndex(Number(event.target.value))}
            type="range"
            value={levelIndex}
          />
          <Button
            aria-pressed={showProps}
            className="size-7"
            disabled={worldAssets === 0 && (canvasFallback || !zoneTerrain)}
            onClick={() => setShowProps((value) => !value)}
            size="icon"
            title={showProps ? 'Hide world assets' : 'Show world assets'}
            type="button"
            variant={showProps ? 'secondary' : 'outline'}
          >
            <Trees className="size-3.5" />
          </Button>
          <Button
            aria-pressed={showGrid}
            className="size-7"
            onClick={() => setShowGrid((value) => !value)}
            size="icon"
            title={showGrid ? 'Hide build grid' : 'Show build grid'}
            disabled={canvasFallback}
            type="button"
            variant={showGrid ? 'secondary' : 'outline'}
          >
            <Grid3x3 className="size-3.5" />
          </Button>
          <Button
            aria-pressed={showTerrain}
            className="size-7"
            disabled={canvasFallback}
            onClick={() => setShowTerrain((value) => !value)}
            size="icon"
            title={showTerrain ? 'Hide terrain to inspect builds' : 'Show terrain'}
            type="button"
            variant={showTerrain ? 'secondary' : 'outline'}
          >
            <MapIcon className="size-3.5" />
          </Button>
          <Button
            aria-pressed={showShield}
            className="size-7"
            disabled={canvasFallback}
            onClick={() => setShowShield((value) => !value)}
            size="icon"
            title={showShield ? 'Hide Storm Shield' : 'Show Storm Shield'}
            type="button"
            variant={showShield ? 'secondary' : 'outline'}
          >
            <Shield className="size-3.5" />
          </Button>
          <Button
            aria-pressed={cinematic}
            className="size-7"
            disabled={canvasFallback}
            onClick={() =>
              setCinematic((value) => {
                localStorage.setItem(cinematicStorageKey, value ? '0' : '1')

                return !value
              })
            }
            size="icon"
            title={
              cinematic
                ? 'Cinematic mode on: ambient occlusion, bloom and ambient motion. Turn off for faster rendering.'
                : 'Turn on cinematic mode: ambient occlusion, bloom and ambient motion'
            }
            type="button"
            variant={cinematic ? 'secondary' : 'outline'}
          >
            <Sparkles className="size-3.5" />
          </Button>
          {zoneTerrain && (
            <Button
              disabled={canvasFallback}
              onClick={() => resetRef.current?.(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Whole map
            </Button>
          )}
          <Button
            disabled={canvasFallback}
            onClick={() => topViewRef.current?.()}
            size="sm"
            type="button"
            variant="outline"
          >
            Top view
          </Button>
          <Button
            className="size-7"
            onClick={() => resetRef.current?.()}
            size="icon"
            title="Reset 3D camera"
            type="button"
            variant="outline"
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative h-[36rem] overflow-hidden rounded-lg border border-border/60 bg-gradient-to-b from-sky-950/40 via-background/30 to-muted/30">
        {canvasFallback ? (
          <BlueprintCanvas3D
            layout={layout}
            maxVisibleZ={maxVisibleZ}
            onSelectTrap={onSelectTrap}
            resetRef={resetRef}
            selectedTrap={selectedTrap}
            showProps={showProps}
          />
        ) : (
          <BlueprintScene
            amplifierSlots={amplifierSlots}
            cinematic={cinematic}
            iconByTrapName={iconByTrapName}
            layout={layout}
            maxVisibleZ={maxVisibleZ}
            onHover={setHovered}
            onRendererMode={setRendererMode}
            onSelectTrap={onSelectTrap}
            onUnavailable={useCanvasFallback}
            resetRef={resetRef}
            selectedTrap={selectedTrap}
            showGrid={showGrid}
            showProps={showProps}
            showShield={showShield}
            showTerrain={showTerrain}
            topViewRef={topViewRef}
            zoneId={zoneId}
          />
        )}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 min-w-max rounded-md border border-border bg-popover px-2 py-1 shadow-md"
            style={{
              left: hovered.x,
              top: hovered.y,
              transform: 'translate(-50%, calc(-100% - 12px))',
            }}
          >
            <p className="text-xs font-medium">{hovered.name}</p>
            <p className="micro-label text-muted-foreground">
              {TRAP_LABEL[hovered.category] ?? 'Other'} trap
              {hoveredGroup && ` · ×${hoveredGroup.count} placed`}
              {hoveredGroup?.tier && ` · T${hoveredGroup.tier}`}
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-border/60 bg-background/80 px-2 py-1 micro-label text-muted-foreground backdrop-blur">
          Drag to orbit · right-drag to pan · scroll to zoom · click a trap to select
        </div>
      </div>

      <p className="micro-label text-muted-foreground">
        {canvasFallback
          ? 'Saved build positions · simplified models'
          : 'Game wood/stone textures · recovered shapes where available · stylised CC0 foliage and sky'}
        {canvasFallback && ' · compatibility view uses basic shapes and flat ground'}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 micro-label text-muted-foreground">
        <LegendSwatch color={MATERIAL_COLORS[0]} label="Wood" />
        <LegendSwatch color={MATERIAL_COLORS[1]} label="Stone" />
        <LegendSwatch color={MATERIAL_COLORS[2]} label="Metal" />
        <span className="text-border">|</span>
        <LegendSwatch color={TRAP_COLOR_HEX[0]} label="Floor trap" round />
        <LegendSwatch color={TRAP_COLOR_HEX[1]} label="Wall trap" round />
        <LegendSwatch color={TRAP_COLOR_HEX[2]} label="Ceiling trap" round />
        {zoneTerrain && (
          <>
            <span className="text-border">|</span>
            <span title={`Terrain layout extracted from ${zoneTerrain.source}`}>
              {zoneId && ZONE_TERRAIN_ASSETS[zoneId] ? 'Recovered zone terrain' : 'Reconstructed zone terrain'}
            </span>
          </>
        )}
        {underlay?.credit && (
          <>
            <span className="text-border">|</span>
            <span>Map: {underlay.credit}</span>
          </>
        )}
        {worldAssets > 0 && (
          <>
            <span className="text-border">|</span>
            <LegendSwatch color="#4f8a3c" label={PROP_KIND_LABEL[PROP_TREE]} />
            <LegendSwatch color="#7a7f86" label={PROP_KIND_LABEL[PROP_ROCK]} />
            <LegendSwatch color="#a3803f" label={PROP_KIND_LABEL[PROP_CONTAINER]} />
            <LegendSwatch color="#8a7f72" label={PROP_KIND_LABEL[PROP_STRUCTURE]} />
            <span title={[...new Set(layout.propNames.map(propLabel))].sort().join(', ')}>
              ({[...new Set(layout.propNames.map(propLabel))].length} kinds recorded in the save)
            </span>
          </>
        )}
      </div>
    </div>
  )
}
