import dayjs from 'dayjs'
import { Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Masonry from 'react-responsive-masonry'

import { GoToTop } from '../../../components/go-to-top'
import { Skeleton } from '../../../components/ui/skeleton'
import {
  AnimatedNumber,
  Chip,
  EmptyState,
  KeyValue,
  PageHeader,
  Panel,
  RefreshButton,
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

/**
 * The wallet, the way the game shows it: the V-Bucks coin large beside the
 * balance, then one card per account in the title-bar scope. Balances fetch
 * themselves when the scope changes, so Refresh is the only control.
 */
export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'account-management'])
  const {
    data,
    handleGetInfo,
    isDisabledForm,
    isLoading,
    vbucksSummary,
  } = useVBucksInformationData()

  return (
    <div
      className="space-y-6"
      id="vbucks-card"
    >
      <PageHeader
        actions={
          <RefreshButton
            disabled={isDisabledForm}
            loading={isLoading}
            onClick={handleGetInfo}
          />
        }
        description="Every account in the title-bar scope: balance, where it came from and what was bought."
        icon={Coins}
        section={t('account-management.title')}
        title={t('account-management.options.vbucks-information')}
      />

      {data.length > 0 ? (
        <>
          <WalletHero
            accounts={data.length}
            total={vbucksSummary}
          />

          <Masonry
            columnsCount={data.length === 1 ? 1 : data.length === 2 ? 2 : 3}
            gutter="0.75rem"
          >
            {data.map((item) => (
              <AccountWallet
                data={item}
                key={item.accountId}
              />
            ))}
          </Masonry>
        </>
      ) : isLoading ? (
        <div
          className="flex items-center gap-4"
          role="status"
        >
          <span className="sr-only">Loading balances…</span>
          <Skeleton className="size-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ) : (
        <EmptyState
          description="Pick one or more accounts in the title bar and their balances load here."
          icon={Coins}
          title="No accounts in scope"
        />
      )}

      <GoToTop containerId="vbucks-card" />
    </div>
  )
}

function WalletHero({ accounts, total }: { accounts: number; total: number }) {
  return (
    <div className="flex items-center gap-5">
      <img
        alt=""
        className="size-20 shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]"
        decoding="async"
        src={vbucksImageUrl}
      />
      <div className="min-w-0">
        <p className="figure text-display-lg font-bold leading-none">
          <AnimatedNumber value={total} />
        </p>
        <p className="mt-2 text-ui text-muted-foreground">
          V-Bucks
          {accounts > 1 && (
            <>
              {' across '}
              <span className="figure">{accounts}</span> accounts
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function AccountWallet({ data }: { data: VBucksInformationData }) {
  const { account, breakdown, details, total } = useParseAccountInfo({ data })
  const bundles = breakdown ? bundleCounts(breakdown.purchaseHistory) : []

  return (
    <Panel>
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        <img
          alt=""
          className="size-10 shrink-0 object-contain"
          decoding="async"
          loading="lazy"
          src={vbucksImageUrl}
        />
        <div className="min-w-0 flex-1">
          <p className="figure text-display-sm font-bold leading-none">
            {numberWithCommaSeparator(total)}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {parseCustomDisplayName(account)}
          </p>
        </div>
      </header>

      {breakdown && (
        <>
          {/* Three figures in a line — where the balance came from. */}
          <dl className="grid grid-cols-3 gap-3 px-4 pb-3">
            <Figure
              label="Purchased"
              value={breakdown.purchased}
            />
            <Figure
              label="Earned"
              value={breakdown.earned}
            />
            <Figure
              label="Complimentary"
              value={breakdown.complimentary}
            />
          </dl>

          <dl className="grid grid-cols-2 gap-3 border-t border-border/40 px-4 py-3">
            <KeyValue
              label="Platform"
              value={breakdown.currentPlatform}
            />
            <KeyValue
              label="Gifts today"
              value={
                breakdown.giftsAllowed ? (
                  breakdown.giftsRemaining !== null ? (
                    <span>
                      <span className="figure">{breakdown.giftsRemaining}</span> left
                    </span>
                  ) : (
                    'Allowed'
                  )
                ) : (
                  <span className="text-muted-foreground">Not allowed</span>
                )
              }
            />
            {breakdown.creatorCode && (
              <KeyValue
                className="col-span-2"
                label="Creator code"
                value={breakdown.creatorCode}
              />
            )}
          </dl>

          {breakdown.sources.length > 0 && (
            <ul className="divide-y divide-border/30 border-t border-border/40 px-4 py-1">
              {breakdown.sources.map((source) => (
                <li
                  className="flex items-center justify-between gap-3 py-1.5 text-xs"
                  key={`${source.type}-${source.platform}`}
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {source.platform}
                    {source.count > 1 && ` ×${source.count}`}
                  </span>
                  <span className="figure shrink-0 font-semibold">
                    {numberWithCommaSeparator(source.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {breakdown.purchaseHistory.length > 0 && (
            <div className="border-t border-border/40 px-4 py-3">
              <p className="text-ui font-medium">
                <span className="figure">{breakdown.purchaseCount}</span>{' '}
                {breakdown.purchaseCount === 1 ? 'purchase' : 'purchases'}
              </p>

              {bundles.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {bundles.map(({ amount, count }) => (
                    <Chip
                      key={amount}
                      tone={count > 1 ? 'accent' : 'neutral'}
                    >
                      {bundleLabel(amount)}
                      {count > 1 && ` ×${count}`}
                    </Chip>
                  ))}
                </div>
              )}

              <ul className="mt-2 max-h-56 divide-y divide-border/30 overflow-y-auto pr-1">
                {breakdown.purchaseHistory.map((purchase, index) => (
                  <li
                    className="flex items-center justify-between gap-3 py-1.5 text-xs"
                    key={`${purchase.date ?? 'unknown'}-${index}`}
                  >
                    <span className="min-w-0 truncate text-muted-foreground">
                      {purchase.date
                        ? dayjs(purchase.date).format('MMM D, YYYY')
                        : 'Unknown date'}
                      {purchase.platform && ` · ${purchase.platform}`}
                    </span>
                    <span className="figure shrink-0 font-semibold">
                      {numberWithCommaSeparator(purchase.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {details.length > 0 && (
        <ul className="divide-y divide-border/30 border-t border-border/40 bg-surface/40 px-4 py-1">
          {details.map(([templateId, currency]) => (
            <li
              className="flex items-center justify-between gap-3 py-1.5 text-xs"
              key={templateId}
            >
              <span className="min-w-0 truncate text-muted-foreground">
                {currency.platform} {currency.template}
              </span>
              <span className="figure shrink-0 font-semibold">
                {numberWithCommaSeparator(currency.quantity)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="micro-label">{label}</dt>
      <dd className="figure mt-1 text-sm font-bold">
        {numberWithCommaSeparator(value)}
      </dd>
    </div>
  )
}
