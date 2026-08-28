import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'

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
import { cn } from '../../../lib/utils'

export function HomeAlerts() {
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
      <h2 className="micro-label mb-2 px-0.5">
        {t('home.alerts.title')}
      </h2>
      <ul className="gap-3 grid grid-cols-2 sm:grid-cols-3">
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
      </ul>

      <div className="mt-6 space-y-6">
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
      </div>
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
  return (
    <li className="panel-interactive group relative flex items-center gap-3 overflow-hidden p-3">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex size-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20">
        <img decoding="async" loading="lazy"
          src={imageUrl}
          className="size-7"
        />
      </div>
      <div className="relative min-w-0 flex-grow">
        {isLoading ? (
          <div className="h-[1.4rem] w-14 animate-pulse rounded bg-muted" />
        ) : (
          <div className="truncate text-lg font-bold leading-tight tabular-nums">
            {numberWithCommaSeparator(quantity)}
          </div>
        )}
        <div className="mt-0.5 text-[0.7rem] leading-tight text-muted-foreground">
          {title}
        </div>
      </div>
    </li>
  )
}

function AlertsEmptyState() {
  const { t } = useTranslation(['general'])
  const { fetchAlerts, isDisabled, isReloading } = useFetchAlerts()
  const account = usePrimaryAccount()

  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 ring-1 ring-inset ring-primary/20">
        <RefreshCw
          className={cn('size-5 text-primary', {
            'animate-spin': isReloading,
          })}
        />
      </div>
      <div>
        <p className="font-semibold">
          {t(
            account
              ? 'home.alerts.empty-title'
              : 'home.alerts.login-title'
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            account
              ? 'home.alerts.empty-description'
              : 'home.alerts.login-description'
          )}
        </p>
      </div>
      {account && (
        <Button
          className="mt-1"
          disabled={isDisabled}
          variant="secondary"
          onClick={fetchAlerts}
        >
          {t('home.alerts.refresh')}
        </Button>
      )}
    </div>
  )
}
