import { pageTabSearch } from '../../lib/navigation/page-tabs'
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/settings',
  validateSearch: pageTabSearch(['app', 'overlay', 'menu', 'accounts'] as const, 'app'),
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
