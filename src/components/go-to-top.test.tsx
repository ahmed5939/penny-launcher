import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GoToTop } from './go-to-top'

describe('go to top', () => {
  it('is out of the tab order and the accessibility tree while hidden', () => {
    const markup = renderToStaticMarkup(
      createElement(GoToTop, { containerId: 'codex-card' }),
    )
    expect(markup).toContain('tabindex="-1"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('pointer-events-none')
  })
})
