import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/settings/tweaks',
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
