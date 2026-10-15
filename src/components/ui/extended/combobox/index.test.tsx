import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { Combobox } from './index'

describe('Combobox', () => {
  it('gives the role="combobox" trigger the name from aria-labelledby', () => {
    const markup = renderToStaticMarkup(
      createElement(Combobox, {
        'aria-labelledby': 'account-label',
        options: [{ label: 'One', value: 'one', keywords: [] }],
        value: [],
        onChange: () => undefined,
      })
    )
    const trigger = markup.match(/<button[^>]*role="combobox"[^>]*>/)?.[0]

    expect(trigger).toContain('aria-labelledby="account-label"')
  })
})
