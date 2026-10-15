import type { OutpostLayout } from '../../../kernel/core/outpost-types'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Blueprint3D, rememberCanvasFallback } from './-blueprint-3d'

const layout: OutpostLayout = {
  bounds: {
    maxX: 2,
    maxY: 2,
    maxZ: 1,
    minX: 0,
    minY: 0,
    minZ: -1,
  },
  cell: 512,
  propNames: ['Tree_04'],
  props: [[5, 5, 3, 0, 12, 1, 0]],
  shapes: ['Floor', 'Solid'],
  structures: [[0, 0, 0, 0, 0, 0, 0, 1]],
  trapNames: [],
  traps: [],
}

/* Session and local storage are browser globals; the test runs in node. */
function memoryStorage() {
  const values = new Map<string, string>()

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key)
    },
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

const render = () =>
  renderToStaticMarkup(
    createElement(Blueprint3D, {
      layout,
      onSelectTrap: () => undefined,
      selectedTrap: null,
      traps: [],
      zoneId: 'pve_01',
    })
  )

describe('Blueprint3D toolbar', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('sessionStorage', memoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps a toggle name fixed while its pressed state changes', () => {
    const html = render()

    expect(html).toMatch(/aria-label="Terrain"[^>]*aria-pressed="true"/)
    expect(html).not.toContain('aria-label="Hide terrain"')
    expect(html).toContain('aria-label="Build grid"')
    expect(html).toContain('aria-label="Storm Shield"')
    expect(html).toContain('aria-label="Full screen"')
  })

  it('names the Map and Top buttons by what they do', () => {
    const html = render()

    expect(html).toContain('title="Show the whole map"')
    expect(html).toContain('title="Look straight down"')
  })

  it('offers no WebGL-only control once the flat view is remembered', () => {
    rememberCanvasFallback(true)
    const html = render()

    expect(html).toContain('Try 3D again')
    expect(html).toContain('Trees and rocks')
    expect(html).toContain('Base')
    expect(html).not.toContain('aria-label="Terrain"')
    expect(html).not.toContain('aria-label="Build grid"')
    expect(html).not.toContain('aria-label="Storm Shield"')
    expect(html).not.toContain('aria-label="Effects"')
    expect(html).not.toContain('>Map<')
    expect(html).not.toContain('>Top<')
    expect(html).not.toContain('Walk</button>')
  })

  it('brings the 3D controls back once the flat view is forgotten', () => {
    rememberCanvasFallback(true)
    rememberCanvasFallback(false)
    const html = render()

    expect(html).not.toContain('Try 3D again')
    expect(html).toContain('aria-label="Terrain"')
    expect(html).toContain('>Top<')
    expect(html).toContain('Walk</button>')
  })
})
