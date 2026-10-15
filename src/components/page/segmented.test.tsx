import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Radar } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { Segmented } from './segmented'

describe('Segmented', () => {
  it('is a radio group with one tab stop, on the selected option', () => {
    const markup = renderToStaticMarkup(
      createElement(Segmented, {
        label: 'Squad view',
        onChange: () => undefined,
        options: [
          { label: 'All', value: 'all' },
          { label: 'Ready', value: 'ready' },
          { label: 'Scan', value: 'scan', icon: Radar },
        ],
        value: 'ready',
      }),
    )
    expect(markup).toContain('role="radiogroup"')
    expect(markup).toContain('aria-label="Squad view"')
    expect(markup).not.toContain('role="tab"')

    const tabStops = markup.match(/<button[^>]*tabindex="0"[^>]*>[^<]*<\/button>/g) ?? []
    expect(tabStops).toHaveLength(1)
    expect(tabStops[0]).toContain('aria-checked="true"')
    expect(tabStops[0]).toContain('>Ready</button>')
  })

  it('names an icon option for assistive technology', () => {
    const markup = renderToStaticMarkup(
      createElement(Segmented, {
        onChange: () => undefined,
        options: [
          { label: 'List', value: 'list' },
          { label: 'Scan', value: 'scan', icon: Radar },
        ],
        value: 'list',
      }),
    )
    const scan = (markup.match(/<button[^>]*>/g) ?? []).find((tag) => tag.includes('title="Scan"'))
    expect(scan).toContain('aria-label="Scan"')
    expect(scan).toContain('role="radio"')
  })
})
