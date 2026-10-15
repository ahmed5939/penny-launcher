import { Compass } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  EmptyState,
  RefreshButton,
  StatRow,
  StatTile,
} from '../../../components/page'

import { LoadingMissions } from '../-components/-loading'
import { EndgameTwinePeaksSection } from './endgame-twine-peaks'
import { EndgameVenturesSection } from './endgame-ventures'
import { SurvivorsSection } from './survivors'
import { UncommonPerkUpSection } from './uncommon-perk-up'
import { VBucksSection } from './vbucks'

import {
  useAlertItemCounter,
  useAlertsSummary,
  useFetchAlerts,
} from '../-hooks'
import { useHomeData } from './-hooks'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { isLegendaryOrMythicSurvivor } from '../../../lib/validations/resources'
import { assets } from '../../../lib/repository'

export function HomeAlerts({ summaryOnly = false }: { summaryOnly?: boolean }) {
  const { t } = useTranslation(['general'])

  const {
    endgame,
    loading,
    survivors,
    uncommonPerks,
    vbucks,
  } = useHomeData()
  const summary = useAlertsSummary()
  const vbucksTotal = useAlertItemCounter({
    data: vbucks,
    key: 'currency_mtxswap',
  })
  const survivorsTotal = useAlertItemCounter({
    data: survivors,
    validationFn: isLegendaryOrMythicSurvivor,
  })
  const uncommonPerksTotal = useAlertItemCounter({
    data: uncommonPerks,
    key: 'alteration_upgrade_uc',
  })

  // Nothing loaded yet: four zeroes look like "no rewards today", which is a
  // different thing entirely. Say so, and offer the fix.
  if (summary.isEmpty && !summary.isLoading) {
    return <AlertsEmptyState />
  }

  return (
    <>
      {!summaryOnly && <h2 className="micro-label mb-2 px-0.5">
        {t('home.alerts.title')}
      </h2>}
      <StatRow>
        <PreviewItem
          imageUrl={assets('currency_mtxswap')}
          isLoading={summary.isLoading}
          quantity={vbucksTotal}
          title={t('home.alerts.vbucks')}
        />
        <PreviewItem
          imageUrl={assets('voucher_generic_worker_sr')}
          isLoading={summary.isLoading}
          quantity={survivorsTotal}
          title={t('home.alerts.survivors')}
        />
        <PreviewItem
          imageUrl={assets('reagent_alteration_upgrade_uc')}
          isLoading={summary.isLoading}
          quantity={uncommonPerksTotal}
          title={t('home.alerts.perk-up')}
        />
      </StatRow>

      {!summaryOnly && <div className="mt-6 space-y-6">
        {loading.isFetching ? (
          <div className="space-y-6">
            <LoadingMissions
              total={3}
              section
              showTitle
            />
            <LoadingMissions
              total={3}
              section
              showTitle
            />
          </div>
        ) : (
          <>
            <VBucksSection data={vbucks} />
            <SurvivorsSection data={survivors} />
            <EndgameTwinePeaksSection data={endgame.twinePeaks} />
            <EndgameVenturesSection data={endgame.ventures} />
            <UncommonPerkUpSection data={uncommonPerks} />
          </>
        )}
      </div>}
    </>
  )
}

function PreviewItem({
  imageUrl,
  isLoading,
  quantity,
  title,
}: {
  imageUrl: string
  isLoading?: boolean
  title: string
  quantity: number
}) {
  const { t } = useTranslation(['general'])

  return (
    <StatTile
      label={title}
      value={
        isLoading ? (
          /*
           * `Skeleton` is a div, and the tile's figure sits inside a paragraph.
           * The same pulsing bar as a span keeps the markup valid.
           */
          <span role="status">
            <span
              aria-hidden
              className="block h-7 w-16 animate-pulse rounded bg-muted"
            />
            <span className="sr-only">{t('home.alerts.loading')}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {numberWithCommaSeparator(quantity)}
            {/* The reward's own art, beside the figure, not an icon in a tinted tile. */}
            <img
              alt=""
              className="size-6 object-contain"
              decoding="async"
              loading="lazy"
              src={imageUrl}
            />
          </span>
        )
      }
    />
  )
}

function AlertsEmptyState() {
  const { t } = useTranslation(['general'])
  const { fetchAlerts, isDisabled, isReloading } = useFetchAlerts()
  const account = usePrimaryAccount()

  /*
   * `useFetchAlerts` exposes one disabled flag that already covers the reload
   * in flight, so it goes to `disabled` and the reload itself to `loading`.
   */
  return (
    <EmptyState
      icon={Compass}
      title={t(
        account ? 'home.alerts.empty-title' : 'home.alerts.login-title'
      )}
      description={t(
        account
          ? 'home.alerts.empty-description'
          : 'home.alerts.login-description'
      )}
      action={
        account && (
          <RefreshButton
            disabled={isDisabled}
            label={t('home.alerts.refresh')}
            loading={isReloading}
            onClick={fetchAlerts}
          />
        )
      }
    />
  )
}
