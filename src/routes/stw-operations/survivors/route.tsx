import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'
import { useInventoryStore } from '../../../state/stw-operations/inventory'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/survivors',
  beforeLoad: () => {
    const store = useInventoryStore.getState()
    if (store.filters.kinds[0] !== 'survivor') {
      store.updateFilters({ kinds: ['survivor'] })
      store.clearSelection()
    }
  },
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
