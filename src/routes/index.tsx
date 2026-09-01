import { createRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { memo, useState } from 'react'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs'
import { GoToTop } from '../components/go-to-top'
import { LanguageNotification } from '../components/language-notification'

import { AlertsOverview } from './-index/-alerts-overview/-index'
import { AutomationChips } from './-index/-automation-chips'
import { FetchAlertsButton } from './-index/-components/-fetch-alerts-button'
import { HomeGameInstall } from './-index/-game-install'
import { HomeHero } from './-index/-hero'
import { HomeAlerts } from './-index/-home/-index'
import { PennyDBMissionBoard } from './-index/-home/-pennydb-board'
import { AlertsDone } from './-index/alerts-done'
// import { HeaderNavigation } from './-index/-header-navigation'
import { Route as RootRoute } from './__root'

import { useGetAccounts } from '../hooks/accounts'
import {
  useAlertsSummary,
  useDropzoneConfig,
  useFetchPlayerDataSync,
} from './-index/-hooks'

import { cn } from '../lib/utils'

enum IndexTabs {
  Play = 'play',
  Missions = 'missions',
}

const defaultTab = IndexTabs.Play

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: IndexComponent,
})

export function IndexComponent() {
  const { t } = useTranslation(['alerts'])

  const { isFileAccepted, isFileRejected, getRootProps } =
    useDropzoneConfig()

  useFetchPlayerDataSync()

  return (
    <>
      <div className="flex flex-grow">
        <div
          {...getRootProps({
            className: cn('relative w-full', {
              '[&_.dzm]:hidden': isFileAccepted,
              '[&_.dzm-not-allowed]:hidden': isFileRejected,
            }),
          })}
        >
          <MainContent />

          <div className="dzm bg-background/90 bottom-0 fixed inset-0 h-full p-8 right-0 w-full z-10">
            <div className="border-8 border-dashed border-green-600- flex font-medium h-full items-center justify-center rounded text-2xl w-full">
              {t('world-info.dnd.title')}
            </div>
          </div>
          <div className="dzm-not-allowed bottom-0 fixed inset-0 h-full p-8 right-0 w-full z-10" />
        </div>
      </div>
    </>
  )
}

const MainContent = memo(() => {
  const [tab, setTab] = useState<IndexTabs>(defaultTab)

  return (
    <>
      <Tabs
        className={cn(
          'mb-5 mx-auto w-full max-w-4xl',
          '[&_.tab-content]:mt-6'
        )}
        defaultValue={defaultTab}
        onValueChange={(value) => setTab(value as IndexTabs)}
      >
        <NavigationTab />
        <TabsContent
          className="tab-content"
          value={IndexTabs.Play}
        >
          {tab === IndexTabs.Play && (
            <>
              <HomeHero />
              <HomeGameInstall />
              <AutomationChips />
              <div className="mt-5">
                <HomeAlerts />
                <PennyDBMissionBoardFallback />
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent
          className="tab-content"
          value={IndexTabs.Missions}
        >
          {tab === IndexTabs.Missions && <MissionsContent />}
        </TabsContent>
      </Tabs>

      <GoToTop containerId="alert-navigation-container" />
      <LanguageNotification />
    </>
  )
})

/**
 * Penny DB lists the same daily missions Epic world-info already shows, so it
 * only earns screen space when world-info has nothing: no account signed in,
 * or a fetch that never landed.
 */
function PennyDBMissionBoardFallback() {
  const summary = useAlertsSummary()

  if (!summary.isEmpty || summary.isLoading) {
    return null
  }

  return <PennyDBMissionBoard />
}

function NavigationTab() {
  const { t } = useTranslation(['general'])

  const triggerClassName = cn(
    'relative rounded-none border-b-2 border-transparent bg-transparent px-3.5 pb-2.5 pt-2',
    'text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground',
    'transition-colors hover:text-foreground',
    'data-[state=active]:border-primary data-[state=active]:bg-transparent',
    'data-[state=active]:text-foreground data-[state=active]:shadow-none'
  )

  return (
    <div
      className="flex items-center border-b border-border/60"
      id="alert-navigation-container"
    >
      <TabsList className="h-auto gap-1 rounded-none bg-transparent p-0">
        <TabsTrigger
          className={triggerClassName}
          value={IndexTabs.Play}
        >
          {t('home.tabs.play')}
        </TabsTrigger>
        <TabsTrigger
          className={triggerClassName}
          value={IndexTabs.Missions}
        >
          {t('home.tabs.missions')}
        </TabsTrigger>
      </TabsList>
      <FetchAlertsButton />
    </div>
  )
}

function MissionsContent() {
  const { t } = useTranslation(['alerts'])
  const [view, setView] = useState<'overview' | 'done'>('overview')

  const { accountsArray } = useGetAccounts()
  const doneDisabled = accountsArray.length <= 0

  const pillClassName = (active: boolean) =>
    cn(
      'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
      active
        ? 'border-primary/50 bg-primary/15 text-primary'
        : 'border-border/70 text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      'disabled:cursor-not-allowed disabled:opacity-50',
    )

  return (
    <>
      <div className="mb-4 flex items-center gap-1.5">
        <button
          type="button"
          className={pillClassName(view === 'overview')}
          onClick={() => setView('overview')}
        >
          {t('tabs.overview')}
        </button>
        <button
          type="button"
          className={pillClassName(view === 'done')}
          onClick={() => setView('done')}
          disabled={doneDisabled}
        >
          {t('tabs.done')}
        </button>
      </div>
      {view === 'overview' ? <AlertsOverview /> : <AlertsDone />}
    </>
  )
}
