import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PlatformIcon } from './platform-icon'

describe('PlatformIcon', () => {
  it('draws a known console as its glyph', () => {
    const markup = renderToStaticMarkup(
      createElement(PlatformIcon, { platform: 'psn' })
    )

    expect(markup).toContain('<svg')
    expect(markup).toContain('aria-label="PlayStation Network"')
  })

  it('names an unknown linked platform in full, not a key slice', () => {
    const markup = renderToStaticMarkup(
      createElement(PlatformIcon, { platform: 'github' })
    )

    expect(markup).toContain('GitHub')
    expect(markup).not.toContain('>git<')
  })
})
