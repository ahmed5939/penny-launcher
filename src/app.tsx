import { RouterProvider, createRouter } from '@tanstack/react-router'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import dayjs from 'dayjs'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'

import { IndexComponent } from './routes'
import { routeTree } from './routeTree.gen'

// import { LoadWorldInfoFiles } from './bootstrap/components/advanced-mode/load-world-info-files'
import {
  LoadHomeWorldInfo,
} from './bootstrap/components/advanced-mode/load-world-info'
import { LoadAccounts } from './bootstrap/components/load-accounts'
import { LoadAutoLlamas } from './bootstrap/components/load-auto-llamas'
import { LoadAutomation } from './bootstrap/components/load-automation'
import { LoadFriends } from './bootstrap/components/load-friends'
import { LoadItemDatabase } from './bootstrap/components/load-item-database'
import { LoadPennyDBMissions } from './bootstrap/components/load-pennydb-missions'
import { LoadSettings } from './bootstrap/components/load-settings'
import { LauncherNotifications } from './bootstrap/components/launcher-notifications'

import { Toaster } from './components/ui/sonner'
import { ThemeProvider } from './components/theme-provider'

import { useAccountScopeStore } from './state/accounts/scope'

import 'dayjs/locale/es'
import { localeReady } from './locale'

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(timezone)
dayjs.extend(utc)

const root = createRoot(document.getElementById('app')!)
const router = createRouter({ routeTree })

// Add-ons request routes through the main process. Keep that bridge inside
// TanStack Router so packaged file:// URLs are never manipulated directly.
window.electronAPI.pluginNavigation(async (route) => {
  if (!route.startsWith('/')) return

  router.history.push(route)
})

// The account scope lives in this process; add-ons run in the main process.
// Mirror every scope change across so context.accounts.getScoped() answers
// without plugins reaching into renderer state.
const reportAccountScope = (state: {
  primary: string | null
  members: Array<string>
}) => {
  window.electronAPI.syncAccountScopeForPlugins({
    primary: state.primary,
    members: state.members,
  })
}

reportAccountScope(useAccountScopeStore.getState())
useAccountScopeStore.subscribe((state, previous) => {
  if (
    state.primary === previous.primary &&
    state.members === previous.members
  ) {
    return
  }

  reportAccountScope(state)
})

/**
 * Locale data is fetched lazily, so give the starting language a chance to
 * land before the first paint — it is a single small chunk, far cheaper than
 * the ~650KB of every-language JSON this used to inline into the bundle.
 *
 * The render is deliberately NOT conditional on that succeeding. A failed or
 * slow translation fetch should degrade to untranslated labels, never to a
 * blank window.
 */
function render() {
  root.render(
    <ThemeProvider>
      <LoadSettings />
      <LoadAccounts />
      <LauncherNotifications />
      <DeferredBootstrap />

      <RouterProvider
        router={router}
        /**
         * Used when app is packaged (static, default home)
         */
        defaultNotFoundComponent={IndexComponent}
      />

      <Toaster position="bottom-center" />
    </ThemeProvider>
  )
}

function DeferredBootstrap() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    // lib.dom types requestIdleCallback as always present, but the typeof
    // guard stays: the timeout fallback covers any runtime without it.
    const hasIdleCallback =
      typeof window.requestIdleCallback === 'function'
    const timers: Array<number> = []
    const advance = () => {
      setStage(1)
      timers.push(window.setTimeout(() => setStage(2), 700))
      timers.push(window.setTimeout(() => setStage(3), 1_800))
    }
    const id = hasIdleCallback
      ? window.requestIdleCallback(advance, {
          timeout: 1_500,
        })
      : window.setTimeout(advance, 250)

    return () => {
      if (hasIdleCallback) {
        window.cancelIdleCallback(id)
      } else {
        window.clearTimeout(id)
      }

      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return (
    <>
      {stage >= 1 && (
        <>
          <LoadFriends />
          <LoadHomeWorldInfo />
        </>
      )}
      {stage >= 2 && (
        <>
          <LoadAutomation />
          <LoadAutoLlamas />
          <LoadItemDatabase />
        </>
      )}
      {stage >= 3 && <LoadPennyDBMissions />}
    </>
  )
}

// i18next starts loading immediately, but translation chunks no longer hold
// the first frame hostage. React updates consumers when the resources land.
void localeReady.catch((error: unknown) => {
  console.error('[penny] locale init failed', error)
})
render()

export { router }
