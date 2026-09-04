import { pageTabSearch } from '../../../lib/navigation/page-tabs'
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/outpost',
  validateSearch: pageTabSearch(['pve_01', 'pve_02', 'pve_03', 'pve_04'] as const, 'pve_01'),
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
