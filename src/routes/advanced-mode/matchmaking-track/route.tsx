import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/advanced-mode/matchmaking-track',
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
