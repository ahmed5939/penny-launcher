import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { Route as RootRoute } from '../../__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/auto-update-quests',
  component: lazyRouteComponent(
    () => import('../auto-daily-reroll/-page'),
    'UpdateRouteComponent',
  ),
})
