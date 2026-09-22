import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { Route as RootRoute } from '../../__root'
export const Route = createRoute({ getParentRoute: () => RootRoute, path: '/stw-operations/rare-item-finder', component: lazyRouteComponent(() => import('./-page'), 'RouteComponent') })
