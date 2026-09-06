import { createRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/plugins/endurance',
  beforeLoad: async () => {
    const plugins = await window.electronAPI.listPlugins()
    if (!plugins.some((plugin) => plugin.id === 'endurance' && plugin.status === 'running' && !plugin.safeMode)) {
      throw redirect({ to: '/plugins' })
    }
  },
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
