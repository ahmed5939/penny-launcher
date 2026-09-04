import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { Route as RootRoute } from '../../__root'
import { pageTabSearch } from '../../../lib/navigation/page-tabs'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/missions',
  validateSearch: pageTabSearch(['overview', 'done'] as const, 'overview'),
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
