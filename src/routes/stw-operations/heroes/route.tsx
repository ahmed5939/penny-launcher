import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'
import { useInventoryStore } from '../../../state/stw-operations/inventory'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/heroes',
  beforeLoad: () => {
    const store = useInventoryStore.getState()
    if (store.filters.kinds[0] !== 'hero') {
      store.updateFilters({ kinds: ['hero'] })
      store.clearSelection()
    }
  },
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
