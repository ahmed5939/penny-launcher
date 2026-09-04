import { pageTabSearch } from '../../../lib/navigation/page-tabs'
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/xpboosts',
  validateSearch: pageTabSearch(['accounts', 'lookup'] as const, 'accounts'),
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
