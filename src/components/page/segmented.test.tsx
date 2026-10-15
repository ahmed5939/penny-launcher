import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Radar } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { Segmented, type SegmentedOption } from './segmented'

function render(options: Array<SegmentedOption<string>>, value: string, label?: string) {
  return renderToStaticMarkup(
    createElement(Segmented, { label, onChange: () => undefined, options, value }),
  )
}

/** Every button's opening tag, in order. Content is skipped, so SVG icons don't hide a button. */
function buttonTags(markup: string) {
  return markup.match(/<button[^>]*>/g) ?? []
}

/** Positions, among the buttons, of every button that is a tab stop. */
function tabStops(markup: string) {
  return buttonTags(markup).flatMap((tag, index) => (tag.includes('tabindex="0"') ? [index] : []))
}

describe('Segmented', () => {
  it('is a radio group with one tab stop, on the selected option', () => {
    const markup = render(
      [
        { label: 'All', value: 'all' },
        { label: 'Ready', value: 'ready' },
        { label: 'Scan', value: 'scan', icon: Radar },
      ],
      'ready',
      'Squad view',
    )
    expect(markup).toContain('role="radiogroup"')
    expect(markup).toContain('aria-label="Squad view"')
    expect(markup).not.toContain('role="tab"')
    expect(tabStops(markup)).toEqual([1])
    expect(buttonTags(markup)[1]).toContain('aria-checked="true"')
  })

  it('names a selected icon option and keeps it the tab stop', () => {
    const markup = render(
      [
        { label: 'List', value: 'list' },
        { label: 'Scan', value: 'scan', icon: Radar },
      ],
      'scan',
    )
    const scan = buttonTags(markup)[1]
    expect(scan).toContain('aria-label="Scan"')
    expect(scan).toContain('role="radio"')
    expect(scan).toContain('aria-checked="true"')
    expect(tabStops(markup)).toEqual([1])
  })

  it('moves the tab stop to the first enabled option when the selected one is disabled', () => {
    const markup = render(
      [
        { label: 'All', value: 'all' },
        { label: 'Ready', value: 'ready', disabled: true },
        { label: 'Scan', value: 'scan' },
      ],
      'ready',
    )
    expect(tabStops(markup)).toEqual([0])
    expect(buttonTags(markup)[0]).toContain('aria-checked="false"')
    expect(buttonTags(markup)[1]).toContain('aria-checked="true"')
  })

  it('moves the tab stop to the first enabled option when no option matches the value', () => {
    const markup = render(
      [
        { label: 'All', value: 'all', disabled: true },
        { label: 'Ready', value: 'ready' },
        { label: 'Scan', value: 'scan' },
      ],
      'missing',
    )
    expect(tabStops(markup)).toEqual([1])
    expect(markup).not.toContain('aria-checked="true"')
  })
})
