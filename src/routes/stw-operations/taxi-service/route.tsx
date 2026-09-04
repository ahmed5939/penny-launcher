import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/taxi-service',
  validateSearch: (search: Record<string, unknown>): { account?: string } => ({
    account: typeof search.account === 'string' ? search.account : undefined,
  }),
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
