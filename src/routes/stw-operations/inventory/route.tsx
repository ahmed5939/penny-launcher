import { createRoute, redirect } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

/** The vault is four pages now; old links land on the first of them. */
export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/inventory',
  beforeLoad: () => {
    throw redirect({ to: '/stw-operations/schematics' })
  },
})
