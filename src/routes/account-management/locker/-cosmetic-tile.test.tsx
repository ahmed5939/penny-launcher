import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CosmeticTile } from './-cosmetic-tile'

const cosmetic = { color: null, imageUrl: null, name: 'Peely', rarity: 'rare', seriesColors: null }

describe('CosmeticTile', () => {
  it('reports the equipped tile as pressed', () => {
    const html = renderToStaticMarkup(createElement(CosmeticTile, { cosmetic, onClick: () => undefined, selected: true }))
    expect(html).toContain('aria-pressed="true"')
  })

  it('reports an unequipped button as not pressed', () => {
    const html = renderToStaticMarkup(createElement(CosmeticTile, { cosmetic, onClick: () => undefined }))
    expect(html).toContain('aria-pressed="false"')
  })

  it('leaves a tile that is not a button without a pressed state', () => {
    const html = renderToStaticMarkup(createElement(CosmeticTile, { cosmetic, selected: true }))
    expect(html).not.toContain('aria-pressed')
  })

  it('dims a disabled tile with the arrow cursor, not the not-allowed one', () => {
    const html = renderToStaticMarkup(createElement(CosmeticTile, { cosmetic, disabled: true, onClick: () => undefined }))
    expect(html).toContain('opacity-60')
    expect(html).not.toContain('cursor-not-allowed')
  })
})
