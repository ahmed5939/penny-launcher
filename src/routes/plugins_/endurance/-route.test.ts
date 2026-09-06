import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../__root', async () => {
  const { createRootRoute } = await import('@tanstack/react-router')
  return { Route: createRootRoute() }
})

import { Route } from './route'

afterEach(() => vi.unstubAllGlobals())

describe('Endurance add-on route', () => {
  it.each([
    [],
    [{ id: 'endurance', status: 'disabled' }],
    [{ id: 'endurance', status: 'review' }],
    [{ id: 'endurance', status: 'error' }],
    [{ id: 'endurance', status: 'running', safeMode: true }],
  ])('redirects unavailable plugins to Add-ons: %j', async (...plugins) => {
    vi.stubGlobal('window', { electronAPI: { listPlugins: async () => plugins } })
    await expect(Route.options.beforeLoad!({} as never)).rejects.toMatchObject({
      to: '/plugins',
      isRedirect: true,
    })
  })

  it('allows installed and running Endurance', async () => {
    vi.stubGlobal('window', { electronAPI: { listPlugins: async () => [
      { id: 'endurance', status: 'running', safeMode: false },
    ] } })
    await expect(Route.options.beforeLoad!({} as never)).resolves.toBeUndefined()
  })
})
