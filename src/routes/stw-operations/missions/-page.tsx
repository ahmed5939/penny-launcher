import { Compass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader, PageTabs } from '../../../components/page'
import { TabsContent } from '../../../components/ui/tabs'
import { GoToTop } from '../../../components/go-to-top'
import { AlertsOverview } from '../../-index/-alerts-overview/-index'
import { AlertsDone } from '../../-index/alerts-done'
import { FetchAlertsButton } from '../../-index/-components/-fetch-alerts-button'
import { useDropzoneConfig } from '../../-index/-hooks'
import { useGetAccounts } from '../../../hooks/accounts'
import { cn } from '../../../lib/utils'
import { Route } from './route'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'alerts'])
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { accountsArray } = useGetAccounts()
  const hasAccounts = accountsArray.length > 0
  const view = tab === 'done' && !hasAccounts ? 'overview' : tab
  const { isFileAccepted, isFileRejected, getRootProps } = useDropzoneConfig()

  return (
    <div
      {...getRootProps({
        className: cn('relative space-y-4', {
          '[&_.dzm]:hidden': isFileAccepted,
          '[&_.dzm-not-allowed]:hidden': isFileRejected,
        }),
      })}
    >
      <div id="alert-navigation-container">
        <PageHeader
          icon={Compass}
          title={t('sidebar:missions')}
          section={t('sidebar:groups.stw')}
          actions={<FetchAlertsButton />}
        />
      </div>
      <div>
        <PageTabs
          label={t('sidebar:missions')}
          value={view}
          tabs={[
            { value: 'overview', label: t('alerts:tabs.overview') },
            {
              value: 'done',
              label: t('alerts:tabs.done'),
              disabled: !hasAccounts,
            },
          ]}
          onValueChange={(value) => {
            void navigate({
              search: (previous) => ({ ...previous, tab: value }),
              resetScroll: false,
            })
          }}
        >
          <TabsContent value="overview">
            <AlertsOverview />
          </TabsContent>
          <TabsContent value="done">
            {hasAccounts && <AlertsDone />}
          </TabsContent>
        </PageTabs>
      </div>
      <div className="dzm fixed inset-0 z-30 bg-background/90 p-8">
        <div className="flex h-full items-center justify-center rounded border-4 border-dashed border-primary p-4 text-2xl font-medium">
          {t('alerts:world-info.dnd.title')}
        </div>
      </div>
      <div className="dzm-not-allowed fixed inset-0 z-30" />
      <GoToTop containerId="alert-navigation-container" />
    </div>
  )
}
