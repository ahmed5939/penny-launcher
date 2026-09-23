import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'
import { useInventoryStore } from '../../../state/stw-operations/inventory'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/defenders',
  beforeLoad: () => {
    const store = useInventoryStore.getState()
    if (store.filters.kinds[0] !== 'defender') {
      store.updateFilters({ kinds: ['defender'] })
      store.clearSelection()
    }
  },
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
