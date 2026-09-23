import { createRoute, redirect } from '@tanstack/react-router'

import { Route as RootRoute } from '../../__root'

/** Quest updates and rerolls share the Daily quests page; keeps old links working. */
export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/auto-update-quests',
  beforeLoad: () => {
    throw redirect({ to: '/stw-operations/auto-daily-reroll' })
  },
})
