import type { ComponentProps } from 'react'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import alertsStrings from '../../../locales/en-US/home.json'

import { ZonePagination } from './-zone-pagination'

/** The real en-US strings, so a missing key fails here rather than on screen. */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values: Record<string, unknown> = {}) => {
      const lookup = (path: string) =>
        path.split('.').reduce<unknown>(
          (node, part) =>
            node && typeof node === 'object'
              ? (node as Record<string, unknown>)[part]
              : undefined,
          alertsStrings
        )
      const found =
        (typeof values.count === 'number'
          ? lookup(`${key}_${values.count === 1 ? 'one' : 'other'}`)
          : undefined) ?? lookup(key)

      return String(found).replace(/\{\{(\w+)\}\}/g, (_, name) =>
        String(values[name])
      )
    },
  }),
}))

vi.mock('../../../hooks/advanced-mode/world-info', () => ({
  useWorldInfo: () => ({ isReloading: false }),
}))

type Pagination = ComponentProps<typeof ZonePagination>['pagination']

const pagination = (active: number) =>
  ({
    active,
    next: () => undefined,
    previous: () => undefined,
  }) as unknown as Pagination

const render = (active: number) =>
  renderToStaticMarkup(
    createElement(ZonePagination, {
      pagination: pagination(active),
      perPage: 10,
      totalMissions: 23,
      totalPages: 3,
    })
  )

describe('ZonePagination', () => {
  it('ends a fully expanded list in its count, not a disabled Show more', () => {
    const html = render(3)

    expect(html).not.toContain('Show more')
    expect(html).not.toContain('disabled=""')
    expect(html).not.toContain('border-dashed')
    expect(html).toContain('Show less')
    expect(html).toContain('23 missions')
  })

  it('keeps Show more, with its count, before the last page', () => {
    const html = render(2)

    expect(html).toContain('Show more')
    expect(html).toContain('20/23')
  })
})
