import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../../hooks/alerts/filters', () => ({
  useAlertsOverviewFiltersData: () => ({
    group: false,
    missionTypes: [],
    rarities: [],
    rewards: [],
    zones: [],
  }),
  useAlertsOverviewFiltersActions: () => ({
    toggleFilterKeys: () => () => {},
    toggleGroup: () => {},
  }),
}))

import { AlertFilters } from './-filters'

const render = () => renderToStaticMarkup(createElement(AlertFilters))

describe('alert filters', () => {
  it('gives every toggle and switch an accessible name', () => {
    const buttons = render().match(/<button[^>]*>/g) ?? []

    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button).toContain('aria-label=')
    }
  })

  it('names Atlas variants apart', () => {
    const markup = render()

    expect(markup).toContain('aria-label="Atlas C2"')
    expect(markup).toContain('aria-label="Atlas C3"')
  })
})
