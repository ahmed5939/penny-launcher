import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ShareMenu } from './-share'

describe('loadout share menu', () => {
  it('keeps the trigger named and enabled, so focus stays on it while the image is made', () => {
    const markup = renderToStaticMarkup(
      createElement(ShareMenu, {
        card: () => createElement('div'),
        fileName: 'penny-loadout-1',
        onCopyToAccount: () => undefined,
      }),
    )
    const trigger = markup.match(/<button[^>]*aria-label="Share this loadout"[^>]*>/)?.[0]

    expect(trigger).toBeDefined()
    expect(trigger).not.toMatch(/\sdisabled[\s=>]/)
  })
})
