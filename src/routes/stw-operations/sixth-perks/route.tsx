import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { Route as RootRoute } from '../../__root'
export const Route = createRoute({ getParentRoute: () => RootRoute, path: '/stw-operations/sixth-perks', component: lazyRouteComponent(() => import('./-page'), 'RouteComponent') })
/** The planner is its own page; both routes share one lazy chunk and the latest scan. */
export const CompletionRoute = createRoute({ getParentRoute: () => RootRoute, path: '/stw-operations/sixth-perks/completion', component: lazyRouteComponent(() => import('./-page'), 'CompletionRouteComponent') })
