import { describe, expect, it } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { pageTabSearch, resolveCollectionSelection } from './page-tabs'

describe('page selection', () => {
  const validate = pageTabSearch(['app', 'menu'] as const, 'app')
  it.each([undefined, null, 7, ['menu'], {}, 'missing'])(
    'falls back for invalid tab %s',
    (tab) => {
      expect(validate({ tab } as Parameters<typeof validate>[0])).toEqual({
        tab: 'app',
      })
    },
  )
  it('accepts a known section', () => {
    expect(validate({ tab: 'menu' } as Parameters<typeof validate>[0])).toEqual(
      { tab: 'menu' },
    )
  })
  it('handles empty, removed and reordered collection members', () => {
    expect(resolveCollectionSelection([], 'removed')).toBeUndefined()
    expect(resolveCollectionSelection(['b', 'a'], 'a')).toBe('a')
    expect(resolveCollectionSelection(['b', 'a'], 'removed', 'a')).toBe('a')
    expect(
      resolveCollectionSelection(['b', 'a'], 'removed', 'also-removed'),
    ).toBe('b')
  })
  it('keeps tab changes in Back/Forward history', async () => {
    const root = createRootRoute()
    const page = createRoute({
      getParentRoute: () => root,
      path: '/test',
      validateSearch: validate,
    })
    const history = createMemoryHistory({ initialEntries: ['/test?tab=app'] })
    const router = createRouter({
      routeTree: root.addChildren([page]),
      history,
    })
    await router.load()
    await router.navigate({
      to: '/test',
      search: { tab: 'menu' },
      resetScroll: false,
    })
    expect(history.location.search).toBe('?tab=menu')
    history.back()
    expect(history.location.search).toBe('?tab=app')
    history.forward()
    expect(history.location.search).toBe('?tab=menu')
  })
})
