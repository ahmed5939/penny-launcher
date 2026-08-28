import { UpdateIcon } from '@radix-ui/react-icons'
import dayjs from 'dayjs'
import { Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Masonry from 'react-responsive-masonry'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Chip,
  PageHeader,
  Panel,
} from '../../../components/page'

import type {
  VBucksInformationData,
  VBucksInformationPurchase,
} from '../../../state/management/vbucks-information'

import { useParseAccountInfo, useVBucksInformationData } from './-hooks'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { assets } from '../../../lib/repository'
import { parseCustomDisplayName } from '../../../lib/utils'

const vbucksImageUrl = assets('currency_mtxswap')

/**
 * The standard V-Bucks bundles, by granted amount — used to name history
 * entries ("2,800 V-Bucks") instead of showing a bare number.
 */
const KNOWN_BUNDLES: Array<[number, string]> = [
  [13500, '13,500 V-Bucks'],
  [5000, '5,000 V-Bucks'],
  [2800, '2,800 V-Bucks'],
  [1000, '1,000 V-Bucks'],
]

function bundleLabel(amount: number): string {
  return (
    KNOWN_BUNDLES.find(([value]) => value === amount)?.[1] ??
    `${numberWithCommaSeparator(amount)} V-Bucks`
  )
}

function bundleCounts(
  history: Array<VBucksInformationPurchase>,
): Array<{ amount: number; count: number }> {
  const counts = new Map<number, number>()

  for (const purchase of history) {
    counts.set(purchase.amount, (counts.get(purchase.amount) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([amount, count]) => ({ amount, count }))
    .sort((a, b) => b.amount - a.amount)
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'account-management'])

  return (
    <>
      <PageHeader
        icon={Coins}
        section={t('account-management.title')}
        title={t('account-management.options.vbucks-information')}
        description={t('vbucks-information.description', {
          ns: 'account-management',
        })}
      />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['account-management', 'general'])

  const {
    data,
    handleGetInfo,
    isDisabledForm,
    isLoading,
    vbucksSummary,
  } = useVBucksInformationData()

  return (
    <>
      {/* The account question is answered by the titlebar picker. */}
      <div className="flex items-center border-b border-border/60 pb-3">
        <Button
          className="ml-auto min-w-40"
          onClick={handleGetInfo}
          disabled={isDisabledForm}
        >
          {isLoading ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            t('vbucks-information.form.submit-button')
          )}
        </Button>
      </div>

      {data.length > 0 && (
        <>
          {/*
            The grand total was centred display type floating between two
            cards. It reads better as a banner that owns the results below.
          */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-5 py-4">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('vbucks-information.results.title', {
                total: data.length,
              })}
            </span>
            <span className="flex items-center gap-1.5 text-3xl font-bold tabular-nums">
              <img decoding="async" loading="lazy"
                src={vbucksImageUrl}
                className="size-7"
                alt="vbucks"
              />
              {numberWithCommaSeparator(vbucksSummary)}
            </span>
          </div>

          <Masonry
            columnsCount={3}
            gutter="0.75rem"
          >
            {data.map((item) => (
              <AccountInfo
                data={item}
                key={item.accountId}
              />
            ))}
          </Masonry>
        </>
      )}

      <GoToTop containerId="selector-card" />
    </>
  )
}

function AccountInfo({ data }: { data: VBucksInformationData }) {
  const { account, breakdown, details, total } = useParseAccountInfo({ data })

  return (
    <Panel key={data.accountId}>
      <header className="border-b border-border/60 px-4 py-3">
        <p className="truncate text-[0.8125rem] font-medium">
          {parseCustomDisplayName(account)}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xl font-bold tabular-nums">
          <img decoding="async" loading="lazy"
            src={vbucksImageUrl}
            className="size-5"
            alt="vbucks"
          />
          {numberWithCommaSeparator(total)}
        </p>
      </header>

      {breakdown && (
        <div className="border-b border-border/40 px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            <BreakdownStat
              label="Purchased"
              value={breakdown.purchased}
            />
            <BreakdownStat
              label="Earned"
              value={breakdown.earned}
            />
            <BreakdownStat
              label="Complimentary"
              value={breakdown.complimentary}
            />
          </div>

          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>
              Platform: <span className="text-foreground">{breakdown.currentPlatform}</span>
            </p>
            <p>
              Gifts today:{' '}
              <span className="text-foreground">
                {breakdown.giftsAllowed
                  ? breakdown.giftsRemaining !== null
                    ? `${breakdown.giftsRemaining} remaining`
                    : 'Allowed'
                  : 'Not allowed'}
              </span>
            </p>
            {breakdown.creatorCode && (
              <p>
                Creator code: <span className="text-foreground">{breakdown.creatorCode}</span>
              </p>
            )}
          </div>

          {breakdown.sources.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border/40 pt-2">
              {breakdown.sources.map((source) => (
                <li
                  className="flex items-center justify-between gap-3 text-xs"
                  key={`${source.type}-${source.platform}`}
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {source.platform}
                    {source.count > 1 && ` ×${source.count}`}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {numberWithCommaSeparator(source.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {breakdown.purchaseHistory.length > 0 && (
            <div className="mt-3 border-t border-border/40 pt-2">
              <p className="micro-label text-muted-foreground">
                Purchase history · {breakdown.purchaseCount}{' '}
                {breakdown.purchaseCount === 1 ? 'purchase' : 'purchases'}
              </p>

              {bundleCounts(breakdown.purchaseHistory).length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {bundleCounts(breakdown.purchaseHistory).map(
                    ({ amount, count }) => (
                      <Chip key={amount} tone={count > 1 ? 'accent' : 'neutral'}>
                        {bundleLabel(amount)}
                        {count > 1 && ` ×${count}`}
                      </Chip>
                    ),
                  )}
                </div>
              )}

              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                {breakdown.purchaseHistory.map((purchase, index) => (
                  <li
                    className="flex items-center justify-between gap-3 text-xs"
                    key={`${purchase.date ?? 'unknown'}-${index}`}
                  >
                    <span className="min-w-0 truncate text-muted-foreground">
                      {purchase.date
                        ? dayjs(purchase.date).format('MMM D, YYYY')
                        : 'Unknown date'}
                      {purchase.platform && ` · ${purchase.platform}`}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {numberWithCommaSeparator(purchase.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {details.length > 0 && (
        <ul className="divide-y divide-border/40">
          {details.map(([templateId, currency]) => (
            <li
              className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
              key={templateId}
            >
              <span className="min-w-0 truncate text-muted-foreground">
                {currency.platform} {currency.template}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {numberWithCommaSeparator(currency.quantity)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function BreakdownStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border border-border/60 px-2 py-1.5 text-center">
      <p className="text-sm font-semibold tabular-nums">
        {numberWithCommaSeparator(value)}
      </p>
      <p className="micro-label text-muted-foreground">{label}</p>
    </div>
  )
}
