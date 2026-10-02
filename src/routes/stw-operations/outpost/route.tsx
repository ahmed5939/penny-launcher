import type { SearchSchemaInput } from '@tanstack/react-router'
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

const zoneIds = ['pve_01', 'pve_02', 'pve_03', 'pve_04'] as const

export type OutpostZoneId = (typeof zoneIds)[number]

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/outpost',
  /** No zone in the URL means "where I last built", which only the page knows. */
  validateSearch: (
    search: SearchSchemaInput & { tab?: unknown }
  ): { tab?: OutpostZoneId } => ({
    tab: zoneIds.find((id) => id === search.tab),
  }),
  component: lazyRouteComponent(() => import('./-page'), 'RouteComponent'),
})
