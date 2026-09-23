import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'
import { useInventoryStore } from '../../../state/stw-operations/inventory'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/schematics',
  beforeLoad: () => {
    const store = useInventoryStore.getState()
    if (store.filters.kinds[0] !== 'schematic') {
      store.updateFilters({ kinds: ['schematic'] })
      store.clearSelection()
    }
  },
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
