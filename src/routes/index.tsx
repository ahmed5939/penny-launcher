import { createRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PanelSectionHeader } from '../components/page'
import { AutomationChips } from './-index/-automation-chips'
import { HomeGameInstall } from './-index/-game-install'
import { HomeHero } from './-index/-hero'
import { HomeAlerts } from './-index/-home/-index'
import { PennyDBMissionBoard } from './-index/-home/-pennydb-board'
import { useAlertsSummary } from './-index/-hooks'
import { Route as RootRoute } from './__root'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: IndexComponent,
})

export function IndexComponent() {
  const { t } = useTranslation(['general', 'sidebar'])
  return (
    <div className="home-dashboard space-y-5">
      <HomeHero />
      <div className="home-dashboard-panels grid items-start gap-4">
        <HomeGameInstall />
        <AutomationChips />
      </div>
      <section className="space-y-4">
        <PanelSectionHeader
          title={t('general:home.alerts.title')}
          actions={
            <Link
              to="/stw-operations/missions"
              search={{ tab: 'overview' }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t('sidebar:open-missions')} →
            </Link>
          }
        />
        <HomeAlerts summaryOnly />
        <PennyDBMissionBoardFallback />
      </section>
    </div>
  )
}

function PennyDBMissionBoardFallback() {
  const summary = useAlertsSummary()
  if (!summary.isEmpty || summary.isLoading) return null
  return <PennyDBMissionBoard />
}
