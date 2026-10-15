import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { InputSecret } from './input-secret'

describe('InputSecret', () => {
  it('passes field wiring through to the input and names the show toggle', () => {
    const markup = renderToStaticMarkup(
      createElement(InputSecret, { id: 'x', 'aria-invalid': true })
    )

    expect(markup).toContain('id="x"')
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('aria-label="Show value"')
  })

  it('leaves a custom icon button as a plain button, not a toggle', () => {
    const markup = renderToStaticMarkup(
      createElement(InputSecret, {
        iconButton: 'Copy',
        buttonProps: { 'aria-label': 'Copy code' },
      })
    )

    expect(markup).toContain('aria-label="Copy code"')
    expect(markup).not.toContain('aria-pressed')
  })
})
