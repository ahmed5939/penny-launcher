import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'

import { useMemo, useRef, useState } from 'react'

import { cn } from '../../lib/utils'

export type SparkPoint = { t: string | number; value: number | null }

/** Plot box is 100 × 100, stretched to the element; the line keeps its 2px. */
const top = 6
const bottom = 96

/**
 * Where every point sits, and the runs between gaps.
 *
 * The y axis starts at zero: a sparkline of player counts that starts at its
 * own minimum turns 8,000 → 8,400 into a cliff. A `null` value is a gap in
 * the data (an hour Epic lost), so the line breaks there instead of diving
 * to zero or bridging over it.
 */
export function sparklineGeometry(points: ReadonlyArray<SparkPoint>) {
  const max = points.reduce((best, point) => Math.max(best, point.value ?? 0), 0)
  const step = points.length > 1 ? 100 / (points.length - 1) : 0
  const positions = points.map((point, index) => ({
    x: points.length > 1 ? index * step : 50,
    y:
      point.value === null
        ? null
        : max > 0
          ? bottom - (point.value / max) * (bottom - top)
          : bottom,
  }))
  const runs: Array<Array<{ x: number; y: number }>> = []
  let run: Array<{ x: number; y: number }> = []

  for (const position of positions) {
    if (position.y === null) {
      if (run.length > 0) runs.push(run)
      run = []
    } else {
      run.push({ x: position.x, y: position.y })
    }
  }

  if (run.length > 0) runs.push(run)

  return { max, positions, runs }
}

/** The nearest point with a value to index `index`, or null if none has one. */
export function nearestWithValue(points: ReadonlyArray<SparkPoint>, index: number) {
  for (let distance = 0; distance < points.length; distance += 1) {
    for (const candidate of [index - distance, index + distance]) {
      if (candidate >= 0 && candidate < points.length && points[candidate].value !== null) {
        return candidate
      }
    }
  }

  return null
}

const linePath = (run: ReadonlyArray<{ x: number; y: number }>) =>
  run.length === 1
    ? // A lone hour between two gaps: a zero-length line with round caps draws a dot.
      `M${run[0].x} ${run[0].y}L${run[0].x + 0.01} ${run[0].y}`
    : run.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('')

const areaPath = (run: ReadonlyArray<{ x: number; y: number }>) =>
  run.length < 2
    ? ''
    : `${linePath(run)}L${run[run.length - 1].x} ${bottom}L${run[0].x} ${bottom}Z`

/**
 * A small line over time, with a readout.
 *
 * Built for a single series in a dialog or a stat line: one 2px line in the
 * primary colour with a faint wash under it, the y axis at zero, gaps left as
 * gaps. Hovering (or arrowing through with the keyboard) snaps a hairline to
 * the nearest point and the readout above says its value and time; at rest
 * the readout shows the newest point. The peak is labelled on the right, so
 * the shape always has a scale. Every value is also in a visually hidden
 * table, so nothing depends on hovering.
 */
export function Sparkline({
  className,
  formatTime,
  formatValue,
  label,
  peakLabel = 'Peak',
  points,
  unit,
}: {
  className?: string
  formatTime: (t: SparkPoint['t']) => string
  formatValue: (value: number) => string
  /** Accessible name: what the line is ("Peak players, last 24 hours"). */
  label: string
  peakLabel?: string
  points: ReadonlyArray<SparkPoint>
  /** After the readout's figure: "players". */
  unit?: ReactNode
}) {
  const geometry = useMemo(() => sparklineGeometry(points), [points])
  const latest = useMemo(() => nearestWithValue(points, points.length - 1), [points])
  const [active, setActive] = useState<number | null>(null)
  const $plot = useRef<HTMLDivElement>(null)
  const shown = active ?? latest
  const shownPosition = shown === null ? null : geometry.positions[shown]

  if (latest === null) {
    return null
  }

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = $plot.current?.getBoundingClientRect()

    if (!box || box.width === 0 || points.length === 0) return

    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))

    setActive(nearestWithValue(points, Math.round(fraction * (points.length - 1))))
  }

  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = active ?? latest
    const move = (index: number, direction: 1 | -1) => {
      for (let next = index; next >= 0 && next < points.length; next += direction) {
        if (points[next].value !== null) return next
      }

      return index
    }

    if (event.key === 'ArrowLeft') setActive(move(Math.max(0, from - 1), -1))
    else if (event.key === 'ArrowRight') setActive(move(Math.min(points.length - 1, from + 1), 1))
    else if (event.key === 'Home') setActive(move(0, 1))
    else if (event.key === 'End') setActive(latest)
    else if (event.key === 'Escape') setActive(null)
    else return

    event.preventDefault()
  }

  return (
    <figure className={cn('space-y-2', className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span aria-live="polite" className="min-w-0 truncate text-xs text-muted-foreground">
          {shown !== null && points[shown].value !== null && (
            <>
              <span className="figure text-sm font-semibold text-foreground">{formatValue(points[shown].value!)}</span>
              {unit && <> {unit}</>}
              <span> · {formatTime(points[shown].t)}</span>
            </>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {peakLabel} <span className="figure font-semibold text-foreground/85">{formatValue(geometry.max)}</span>
        </span>
      </figcaption>

      <div
        aria-label={`${label}. Use the arrow keys to read each point.`}
        className="relative h-20 touch-none select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onBlur={() => setActive(null)}
        onKeyDown={step}
        onPointerLeave={() => setActive(null)}
        onPointerMove={pick}
        ref={$plot}
        role="group"
        tabIndex={0}
      >
        <svg aria-hidden className="absolute inset-0 size-full overflow-visible text-primary" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line className="text-border" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" x1={0} x2={100} y1={bottom} y2={bottom} />
          {geometry.runs.map((run, index) => (
            <path d={areaPath(run)} fill="currentColor" fillOpacity={0.1} key={`a${index}`} />
          ))}
          {geometry.runs.map((run, index) => (
            <path
              d={linePath(run)}
              fill="none"
              key={`l${index}`}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {active !== null && shownPosition && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-border" style={{ left: `${shownPosition.x}%` }} />
        )}
        {shownPosition && shownPosition.y !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"
            style={{ left: `${shownPosition.x}%`, top: `${shownPosition.y}%` }}
          />
        )}
      </div>

      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((point, index) => (
            <tr key={index}>
              <th scope="row">{formatTime(point.t)}</th>
              <td>{point.value === null ? 'No data' : formatValue(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
