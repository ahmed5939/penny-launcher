import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { nearestWithValue, Sparkline, sparklineGeometry } from './sparkline'

const points = [
  { t: 0, value: 100 },
  { t: 1, value: 200 },
  { t: 2, value: null },
  { t: 3, value: 50 },
  { t: 4, value: 400 },
]

describe('Sparkline', () => {
  it('breaks the line at a gap instead of drawing it as zero', () => {
    const { max, runs, positions } = sparklineGeometry(points)

    expect(max).toBe(400)
    expect(runs).toHaveLength(2)
    expect(runs[0].map((p) => p.x)).toEqual([0, 25])
    expect(runs[1].map((p) => p.x)).toEqual([75, 100])
    expect(positions[2].y).toBeNull()
    // Zero at the bottom of the box, the peak at the top.
    expect(positions[4].y).toBeLessThan(positions[0].y!)
  })

  it('snaps to the nearest point that has a value', () => {
    expect(nearestWithValue(points, 2)).toBe(1)
    expect(nearestWithValue(points, 4)).toBe(4)
    expect(nearestWithValue([{ t: 0, value: null }], 0)).toBeNull()
  })

  it('reads the newest value and the peak, and lists every point for screen readers', () => {
    const html = renderToStaticMarkup(
      createElement(Sparkline, {
        formatTime: (t) => `h${t}`,
        formatValue: (value) => value.toLocaleString('en-GB'),
        label: 'Peak players',
        points,
        unit: 'players',
      })
    )

    expect(html).toContain('400</span> players')
    expect(html).toContain('Peak <span class="figure')
    expect(html).toContain('<th scope="row">h2</th><td>No data</td>')
  })

  it('draws nothing without a single value', () => {
    expect(
      renderToStaticMarkup(
        createElement(Sparkline, { formatTime: String, formatValue: String, label: 'x', points: [{ t: 0, value: null }] })
      )
    ).toBe('')
  })
})
