import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageTabs, PageTabPanel } from './page-tabs'

describe('page panels', () => {
  it('hides inactive force-mounted panels and names the tab list', () => {
    const markup = renderToStaticMarkup(
      createElement(PageTabs, {
        label: 'Settings sections',
        value: 'app',
        tabs: [
          { value: 'app', label: 'App' },
          { value: 'menu', label: 'Menu' },
        ],
        onValueChange: () => undefined,
        children: [
          createElement(PageTabPanel, {
            key: 'app',
            value: 'app',
            activeValue: 'app',
            children: 'App content',
          }),
          createElement(PageTabPanel, {
            key: 'menu',
            value: 'menu',
            activeValue: 'app',
            children: 'Menu content',
          }),
        ],
      }),
    )
    expect(markup).toContain('aria-label="Settings sections"')
    expect(markup).toMatch(
      /data-state="inactive"[^>]*role="tabpanel"[^>]*hidden=""/,
    )
    expect(markup).toContain('App content')
    expect(markup).not.toContain('Menu content')
  })
})
