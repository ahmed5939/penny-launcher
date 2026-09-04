import type { MutableRefObject } from 'react'
import type { OutpostLayout } from '../../../kernel/core/outpost-types'

import { useEffect, useRef, useState } from 'react'

import {
  KIND_FLOOR,
  KIND_ROOF,
  KIND_STAIR,
  KIND_WALL,
  PROP_CONTAINER,
  PROP_ROCK,
  PROP_TREE,
  STOREY_HEIGHT,
  TRAP_WALL,
  forwardVector,
  structureCentre,
  trapCentre,
} from './-blueprint-geometry'

const MATERIAL_COLORS = ['#c9a06a', '#9aa4ad', '#6fd3e0', '#b7a5ca']
const TRAP_COLORS = ['#ed7e39', '#51a1db', '#d076f6', '#bfbaba']
const PROP_COLORS = ['#4f8a3c', '#7a7f86', '#a3803f', '#8a7f72', '#8d86a0']

type ViewState = {
  panX: number
  panY: number
  pitch: number
  yaw: number
  zoom: number
}

export function projectOutpostPoint(
  point: { x: number; y: number; z: number },
  view: Pick<ViewState, 'pitch' | 'yaw'>
) {
  const cosYaw = Math.cos(view.yaw)
  const sinYaw = Math.sin(view.yaw)
  const rotatedX = point.x * cosYaw - point.z * sinYaw
  const rotatedZ = point.x * sinYaw + point.z * cosYaw

  return {
    depth: rotatedZ * Math.cos(view.pitch) + point.y * Math.sin(view.pitch),
    x: rotatedX,
    y: rotatedZ * Math.sin(view.pitch) - point.y * Math.cos(view.pitch),
  }
}

function polygon(
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>
) {
  context.beginPath()
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y)
    else context.lineTo(point.x, point.y)
  })
  context.closePath()
}

/**
 * Software-rendered isometric fallback for machines without WebGL. It shares
 * the 3D explorer's placement rules (actor pivots, trap anchors, world
 * props) but paints flat shapes: floors as tiles, walls as upright panels
 * on their edge, ramps as sloped quads, roofs as smaller tiles, traps as
 * dots and world props as simple markers.
 */
export function BlueprintCanvas3D({
  layout,
  maxVisibleZ,
  onSelectTrap,
  resetRef,
  selectedTrap,
  showProps = true,
}: {
  layout: OutpostLayout
  maxVisibleZ: number
  onSelectTrap: (name: string | null) => void
  resetRef: MutableRefObject<(() => void) | null>
  selectedTrap: string | null
  showProps?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewRef = useRef<ViewState>({
    panX: 0,
    panY: 0,
    pitch: 0.62,
    yaw: -0.72,
    zoom: 1,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      setError('Canvas graphics are unavailable.')
      return
    }

    setError(null)
    let frame = 0
    let trapPoints: Array<{ name: string; x: number; y: number }> = []
    const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2
    const centerY = (layout.bounds.minY + layout.bounds.maxY) / 2
    const floorZ = layout.bounds.minZ
    const span = Math.max(
      1,
      layout.bounds.maxX - layout.bounds.minX,
      layout.bounds.maxY - layout.bounds.minY
    )
    const propReach = 25
    const visibleProps = showProps
      ? layout.props.filter(
          ([x, y, z]) =>
            z <= maxVisibleZ &&
            Math.abs(x - centerX) <= span / 2 + propReach &&
            Math.abs(y - centerY) <= span / 2 + propReach
        )
      : []

    const draw = () => {
      frame = 0
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)
      const ratio = Math.min(window.devicePixelRatio, 2)

      if (
        canvas.width !== Math.round(width * ratio) ||
        canvas.height !== Math.round(height * ratio)
      ) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)

      const view = viewRef.current
      const scale =
        Math.min(width / (span * 1.45), height / (span * 0.92)) *
        view.zoom
      const originX = width / 2 + view.panX
      const originY = height * 0.62 + view.panY
      const project = (sourceX: number, sourceY: number, sourceZ: number) => {
        const projected = projectOutpostPoint(
          {
            x: sourceY - centerY,
            y: sourceZ - floorZ,
            z: -(sourceX - centerX),
          },
          view
        )

        return {
          depth: projected.depth,
          x: originX + projected.x * scale,
          y: originY + projected.y * scale,
        }
      }

      /* Ground: a soft green sheet under the build. */
      const pad = 4
      const groundCorners = [
        project(layout.bounds.minX - pad, layout.bounds.minY - pad, floorZ),
        project(layout.bounds.minX - pad, layout.bounds.maxY + pad, floorZ),
        project(layout.bounds.maxX + pad, layout.bounds.maxY + pad, floorZ),
        project(layout.bounds.maxX + pad, layout.bounds.minY - pad, floorZ),
      ]

      polygon(context, groundCorners)
      context.fillStyle = 'rgba(74, 102, 54, 0.55)'
      context.fill()

      context.lineWidth = 1
      context.strokeStyle = 'rgba(200, 215, 190, 0.16)'

      for (
        let x = Math.floor(layout.bounds.minX) - 0.5;
        x <= Math.ceil(layout.bounds.maxX) + 0.5;
        x += 1
      ) {
        const from = project(x, layout.bounds.minY - 0.5, floorZ)
        const to = project(x, layout.bounds.maxY + 0.5, floorZ)

        context.beginPath()
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        context.stroke()
      }

      for (
        let y = Math.floor(layout.bounds.minY) - 0.5;
        y <= Math.ceil(layout.bounds.maxY) + 0.5;
        y += 1
      ) {
        const from = project(layout.bounds.minX - 0.5, y, floorZ)
        const to = project(layout.bounds.maxX + 0.5, y, floorZ)

        context.beginPath()
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        context.stroke()
      }

      type Drawable =
        | { depth: number; kind: 'piece'; piece: OutpostLayout['structures'][number] }
        | { depth: number; kind: 'prop'; prop: OutpostLayout['props'][number] }

      const drawables: Array<Drawable> = [
        ...layout.structures
          .filter((piece) => piece[2] <= maxVisibleZ)
          .map((piece): Drawable => {
            const centre = structureCentre(piece)

            return {
              depth: project(centre.x, centre.y, centre.z).depth,
              kind: 'piece',
              piece,
            }
          }),
        ...visibleProps.map((prop): Drawable => ({
          depth: project(prop[0], prop[1], prop[2]).depth,
          kind: 'prop',
          prop,
        })),
      ].sort((a, b) => b.depth - a.depth)

      for (const drawable of drawables) {
        if (drawable.kind === 'prop') {
          const [x, y, z, propKind, , propScale] = drawable.prop
          const size = Math.min(2, Math.max(0.5, propScale || 1))
          const base = project(x, y, z)
          const color = PROP_COLORS[propKind] ?? PROP_COLORS[4]

          context.fillStyle = color
          context.strokeStyle = 'rgba(0,0,0,0.4)'
          context.lineWidth = 1

          if (propKind === PROP_TREE) {
            const top = project(x, y, z + 1.6 * size)
            const radius = 0.4 * size * scale

            context.beginPath()
            context.moveTo(top.x, top.y)
            context.lineTo(base.x - radius, base.y)
            context.lineTo(base.x + radius, base.y)
            context.closePath()
            context.fill()
            context.stroke()
          } else if (propKind === PROP_ROCK || propKind === PROP_CONTAINER) {
            const radius = (propKind === PROP_ROCK ? 0.32 : 0.22) * size * scale

            context.beginPath()
            context.ellipse(base.x, base.y - radius * 0.4, radius, radius * 0.7, 0, 0, Math.PI * 2)
            context.fill()
            context.stroke()
          } else {
            const half = 0.35 * size * scale

            context.fillRect(base.x - half, base.y - half * 1.6, half * 2, half * 1.6)
            context.strokeRect(base.x - half, base.y - half * 1.6, half * 2, half * 1.6)
          }
          continue
        }

        const { piece } = drawable
        const [x, y, z, material, kind, yaw] = piece
        const color = MATERIAL_COLORS[material] ?? MATERIAL_COLORS[3]
        const centre = structureCentre(piece)

        if (kind === KIND_WALL) {
          const [fx, fy] = forwardVector(yaw)
          /* The wall runs across the forward axis, along the tile edge. */
          const dx = fy * 0.5
          const dy = fx * 0.5
          const bottomA = project(x - dx, y - dy, z)
          const bottomB = project(x + dx, y + dy, z)
          const topB = project(x + dx, y + dy, z + STOREY_HEIGHT)
          const topA = project(x - dx, y - dy, z + STOREY_HEIGHT)

          polygon(context, [bottomA, bottomB, topB, topA])
          context.globalAlpha = 0.82
          context.fillStyle = color
          context.fill()
          context.globalAlpha = 1
          context.strokeStyle = 'rgba(255,255,255,0.2)'
          context.stroke()
          continue
        }

        if (kind === KIND_STAIR) {
          /* Fortnite's stair rises opposite the actor's stored forward vector. */
          const [fx, fy] = forwardVector(yaw)
          const sx = fy * 0.47
          const sy = fx * 0.47
          const lowA = project(
            centre.x + fx * 0.48 - sx,
            centre.y + fy * 0.48 - sy,
            z
          )
          const lowB = project(
            centre.x + fx * 0.48 + sx,
            centre.y + fy * 0.48 + sy,
            z
          )
          const highB = project(
            centre.x - fx * 0.48 + sx,
            centre.y - fy * 0.48 + sy,
            z + STOREY_HEIGHT
          )
          const highA = project(
            centre.x - fx * 0.48 - sx,
            centre.y - fy * 0.48 - sy,
            z + STOREY_HEIGHT
          )

          polygon(context, [lowA, lowB, highB, highA])
          context.globalAlpha = 0.72
          context.fillStyle = color
          context.fill()
          context.globalAlpha = 1
          context.strokeStyle = 'rgba(255,255,255,0.16)'
          context.stroke()
          continue
        }

        const radius = kind === KIND_FLOOR ? 0.47 : kind === KIND_ROOF ? 0.34 : 0.4
        const points = [
          project(centre.x - radius, centre.y - radius, z),
          project(centre.x - radius, centre.y + radius, z),
          project(centre.x + radius, centre.y + radius, z),
          project(centre.x + radius, centre.y - radius, z),
        ]

        polygon(context, points)
        context.globalAlpha = kind === KIND_FLOOR ? 0.6 : 0.7
        context.fillStyle = color
        context.fill()
        context.globalAlpha = 1
        context.strokeStyle = 'rgba(255,255,255,0.14)'
        context.stroke()

        if (kind === KIND_ROOF) {
          const apex = project(centre.x, centre.y, z + 0.5)

          context.strokeStyle = 'rgba(255,255,255,0.22)'
          for (const corner of points) {
            context.beginPath()
            context.moveTo(corner.x, corner.y)
            context.lineTo(apex.x, apex.y)
            context.stroke()
          }
        }
      }

      trapPoints = []
      for (const trap of layout.traps) {
        const [, , z, category, nameIndex] = trap

        if (z > maxVisibleZ) continue

        const centre = trapCentre(trap)
        const lift = category === TRAP_WALL ? STOREY_HEIGHT / 2 : 0.08
        const point = project(centre.x, centre.y, z + lift)
        const name = layout.trapNames[nameIndex] ?? 'Unknown trap'
        const selected = selectedTrap === name

        const markerSize = selected ? 9 : 7

        context.fillStyle = 'rgba(18, 27, 36, 0.9)'
        context.fillRect(
          point.x - markerSize / 2,
          point.y - markerSize / 2,
          markerSize,
          markerSize
        )
        context.lineWidth = selected ? 2 : 1.5
        context.strokeStyle = selected
          ? '#ffffff'
          : (TRAP_COLORS[category] ?? TRAP_COLORS[3])
        context.strokeRect(
          point.x - markerSize / 2,
          point.y - markerSize / 2,
          markerSize,
          markerSize
        )
        context.fillStyle = TRAP_COLORS[category] ?? TRAP_COLORS[3]
        context.fillRect(point.x - 1.5, point.y - 1.5, 3, 3)
        trapPoints.push({ name, x: point.x, y: point.y })
      }
    }
    const requestDraw = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const reset = () => {
      viewRef.current = {
        panX: 0,
        panY: 0,
        pitch: 0.62,
        yaw: -0.72,
        zoom: 1,
      }
      requestDraw()
    }

    resetRef.current = reset

    const drag = {
      active: false,
      mode: 'orbit' as 'orbit' | 'pan',
      moved: 0,
      x: 0,
      y: 0,
    }
    const nearestTrap = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      return trapPoints.findLast(
        (trap) => Math.hypot(trap.x - x, trap.y - y) <= 9
      )
    }
    const onPointerDown = (event: PointerEvent) => {
      drag.active = true
      drag.mode = event.button === 2 || event.shiftKey ? 'pan' : 'orbit'
      drag.moved = 0
      drag.x = event.clientX
      drag.y = event.clientY
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!drag.active) {
        canvas.style.cursor = nearestTrap(event) ? 'pointer' : 'grab'
        return
      }

      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y

      drag.moved += Math.abs(dx) + Math.abs(dy)
      drag.x = event.clientX
      drag.y = event.clientY

      if (drag.mode === 'pan') {
        viewRef.current.panX += dx
        viewRef.current.panY += dy
      } else {
        viewRef.current.yaw += dx * 0.008
        viewRef.current.pitch = Math.min(
          1.3,
          Math.max(0.15, viewRef.current.pitch + dy * 0.006)
        )
      }
      requestDraw()
    }
    const onPointerUp = (event: PointerEvent) => {
      drag.active = false

      if (drag.moved <= 5) {
        const trap = nearestTrap(event)

        if (trap) onSelectTrap(trap.name === selectedTrap ? null : trap.name)
      }
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      viewRef.current.zoom = Math.min(
        6,
        Math.max(0.2, viewRef.current.zoom * Math.exp(-event.deltaY * 0.001))
      )
      requestDraw()
    }
    const onContextMenu = (event: MouseEvent) => event.preventDefault()
    const observer = new ResizeObserver(requestDraw)

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)
    observer.observe(canvas)
    draw()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      resetRef.current = null
    }
  }, [layout, maxVisibleZ, onSelectTrap, resetRef, selectedTrap, showProps])

  return error ? (
    <div className="flex size-full items-center justify-center p-6 text-center text-xs text-destructive">
      {error}
    </div>
  ) : (
    <canvas
      aria-label="Interactive isometric Outpost explorer"
      className="block size-full touch-none"
      ref={canvasRef}
    />
  )
}
