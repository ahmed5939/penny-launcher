import { createRoute, redirect } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

/** The embedded PennyDB profile is gone; its History lives on as its own page. */
export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account-management/profile',
  beforeLoad: () => {
    throw redirect({ to: '/account-management/history' })
  },
})
