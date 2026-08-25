import { RouterProvider, createRouter } from '@tanstack/react-router'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import dayjs from 'dayjs'
import { createRoot } from 'react-dom/client'

import { IndexComponent } from './routes'
import { routeTree } from './routeTree.gen'

// import { LoadWorldInfoFiles } from './bootstrap/components/advanced-mode/load-world-info-files'
import {
  LoadHomeWorldInfo,
  LoadWorldInfoData,
} from './bootstrap/components/advanced-mode/load-world-info'
import { LoadAccounts } from './bootstrap/components/load-accounts'
import { LoadAutoLlamas } from './bootstrap/components/load-auto-llamas'
import { LoadAutomation } from './bootstrap/components/load-automation'
import { LoadFriends } from './bootstrap/components/load-friends'
import { LoadItemDatabase } from './bootstrap/components/load-item-database'
import { LoadSettings } from './bootstrap/components/load-settings'
import { LauncherNotifications } from './bootstrap/components/launcher-notifications'

import { Toaster } from './components/ui/sonner'
import { ThemeProvider } from './components/theme-provider'

import 'dayjs/locale/es'
import { localeReady } from './locale'

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(timezone)
dayjs.extend(utc)

const root = createRoot(document.getElementById('app')!)
const router = createRouter({ routeTree })

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
      <LoadFriends />
      <LoadItemDatabase />
      <LoadHomeWorldInfo />
      <LoadWorldInfoData />
      {/* <LoadWorldInfoFiles /> */}
      <LoadAutomation />
      <LoadAutoLlamas />
      <LauncherNotifications />

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

localeReady
  .catch((error: unknown) => {
    console.error('[penny] locale init failed, rendering anyway', error)
  })
  .finally(render)

export { router }
