import type { LucideIcon } from 'lucide-react'
import type {
  LeaderboardMetric,
  LeaderboardRow,
} from '../../../kernel/core/leaderboard-parse'
import { UpdateIcon } from '@radix-ui/react-icons'
import { ExternalLink, Search, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { Skeleton } from '../../../components/ui/skeleton'
import {
  Callout,
  Chip,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
} from '../../../components/page'
import {
  isLinkablePennyDBDisplayName,
} from '../../../kernel/core/leaderboard-parse'

import { pennyDbLinks } from '../../../config/about/links'
import {
  leaderboardDefinitionByMetric,
  leaderboardGroups,
} from '../../../config/leaderboards'

import { pennyDBProfileUrl } from '../../../services/endpoints/pennydb'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { cn } from '../../../lib/utils'

import { useLeaderboardData } from './-hooks'

export function RouteComponent() {
  const { t } = useTranslation(['stw-operations', 'sidebar'])
  const [query, setQuery] = useState('')
  const [playerQuery, setPlayerQuery] = useState('')

  const {
    errorMessage,
    handleRefresh,
    isLoading,
    linkedDisplayNames,
    metric,
    rows,
    setMetric,
  } = useLeaderboardData()

  const handleSelectMetric = (next: LeaderboardMetric) => {
    if (next === metric) {
      return
    }

    setMetric(next)
    // Land at the top of the new ranking instead of wherever the previous
    // (possibly much longer) list left the viewport.
    document
      .querySelector('.main-wrapper-content')
      ?.scroll({ behavior: 'instant', top: 0 })
  }

  const activeMetric = leaderboardDefinitionByMetric.get(metric)
  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return leaderboardGroups
    }

    return leaderboardGroups
      .map((group) => ({
        ...group,
        metrics: group.metrics.filter((definition) =>
          definition.label.toLowerCase().includes(normalizedQuery)
        ),
      }))
      .filter((group) => group.metrics.length > 0)
  }, [query])

  const visibleRows = useMemo(() => {
    const normalizedQuery = playerQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return rows
    }

    return rows.filter((row) =>
      row.displayName.toLowerCase().includes(normalizedQuery)
    )
  }, [playerQuery, rows])

  const yourRow = useMemo(
    () =>
      rows.find((row) =>
        linkedDisplayNames.has(row.displayName.toLowerCase())
      ) ?? null,
    [linkedDisplayNames, rows]
  )

  return (
    <>
      <PageHeader
        icon={Trophy}
        section={t('sidebar:stw-operations.title')}
        title={
          <span className="flex items-center gap-2">
            {t('leaderboards.title')}
            <BetaBadge />
          </span>
        }
        description={t('leaderboards.description')}
        actions={
          <>
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                t('leaderboards.refresh')
              )}
            </Button>
            <Button
              onClick={() =>
                window.electronAPI.openExternalURL(
                  pennyDbLinks.stwLeaderboard
                )
              }
              variant="outline"
            >
              <ExternalLink className="size-4" />
              {t('leaderboards.open-on-pennydb')}
            </Button>
          </>
        }
      />

      <Panel
        className="overflow-visible"
        id="leaderboards-card"
      >
        <PanelBody className="p-0">
          <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
            {/*
              The sidebar is sticky against the app scroll viewport, so it
              stays put while the (much taller) ranking list scrolls past it.
              This needs `overflow-visible` on the Panel above — an
              `overflow-hidden` ancestor would neuter `position: sticky`.
            */}
            <aside className="rounded-t-xl border-b border-border/60 bg-surface/30 lg:rounded-bl-xl lg:rounded-tr-none lg:border-b-0 lg:border-r">
              <div className="flex flex-col lg:sticky lg:top-0 lg:max-h-[calc(100vh_-_var(--header-height)_-_var(--status-bar-height)_-_1.25rem)]">
                <div className="border-b border-border/60 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    {t('leaderboards.metric.label')}
                  </p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      aria-label={t('leaderboards.search')}
                      className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t('leaderboards.search')}
                      type="search"
                      value={query}
                    />
                  </div>
                </div>

                <div className="max-h-80 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-2 lg:max-h-none">
                {visibleGroups.map((group) => (
                  <section key={group.label}>
                    <h2 className="px-2 pb-1 text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </h2>
                    <div className="space-y-0.5">
                      {group.metrics.map((definition) => {
                        const active = definition.metric === metric

                        return (
                          <button
                            aria-pressed={active}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors',
                              active
                                ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/25'
                                : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                            )}
                            key={definition.metric}
                            onClick={() => handleSelectMetric(definition.metric)}
                            type="button"
                          >
                            <MetricIcon {...definition} />
                            <span className="truncate">{definition.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
                  {visibleGroups.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      {t('leaderboards.no-metrics')}
                    </p>
                  )}
                </div>
              </div>
            </aside>

            <div className="min-w-0 space-y-4 p-4">
              {activeMetric && (
                <div className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-3">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-surface/70 p-2">
                    {typeof activeMetric.icon === 'string' ? (
                      <img alt="" className="size-full object-contain" src={activeMetric.icon} />
                    ) : (
                      <activeMetric.icon className="size-5 shrink-0 text-primary" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">{activeMetric.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {rows.length > 0
                        ? t('leaderboards.ranked-count', {
                            count: rows.length,
                          })
                        : t('leaderboards.top-commanders')}
                    </p>
                  </div>
                  <div className="relative w-full sm:w-56">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      aria-label={t('leaderboards.search-players')}
                      className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                      onChange={(event) =>
                        setPlayerQuery(event.target.value)
                      }
                      placeholder={t('leaderboards.search-players')}
                      type="search"
                      value={playerQuery}
                    />
                  </div>
                </div>
              )}

              {errorMessage && (
                <Callout title={t('leaderboards.error-title')} tone="danger">
                  {errorMessage}
                </Callout>
              )}

              {yourRow && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  onClick={() => {
                    setPlayerQuery('')
                    requestAnimationFrame(() => {
                      document
                        .getElementById(leaderboardRowId(yourRow.rank))
                        ?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        })
                    })
                  }}
                  type="button"
                >
                  <Trophy className="size-3.5" />
                  {t('leaderboards.your-rank', { rank: yourRow.rank })}
                </button>
              )}

              {rows.length <= 0 ? (
                isLoading ? (
                  <div className="space-y-2 pt-1">
                    {Array.from({ length: 10 }, (_, index) => (
                      <div
                        className="flex items-center gap-3 px-2 py-1.5"
                        key={index}
                      >
                        <Skeleton className="size-7 rounded-lg" />
                        <Skeleton className="h-4 max-w-56 flex-1" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    description={t('leaderboards.empty-description')}
                    icon={Trophy}
                    title={t('leaderboards.empty')}
                  />
                )
              ) : (
                <div>
                  <div className="flex items-center gap-3 border-b border-border/60 px-2 pb-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
                    <span className="w-8 shrink-0 text-center">
                      {t('leaderboards.columns.rank')}
                    </span>
                    <span className="min-w-0 flex-1">
                      {t('leaderboards.columns.commander')}
                    </span>
                    <span className="shrink-0">
                      {t('leaderboards.columns.value')}
                    </span>
                  </div>
                  {visibleRows.length <= 0 ? (
                    <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                      {t('leaderboards.no-players', {
                        query: playerQuery.trim(),
                      })}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {visibleRows.map((row) => (
                        <LeaderboardEntry
                          isLinked={linkedDisplayNames.has(
                            row.displayName.toLowerCase()
                          )}
                          key={`${row.profileId}-${row.rank}`}
                          metric={metric}
                          row={row}
                          youLabel={t('leaderboards.you')}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </PanelBody>
      </Panel>

      <GoToTop containerId="leaderboards-card" />
    </>
  )
}

function leaderboardRowId(rank: number) {
  return `leaderboard-row-${rank}`
}

function RankBadge({ rank }: { rank: number }) {
  const medalClass =
    rank === 1
      ? 'bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/30'
      : rank === 2
        ? 'bg-slate-300/15 text-slate-200 ring-1 ring-inset ring-slate-300/30'
        : rank === 3
          ? 'bg-orange-400/15 text-orange-300 ring-1 ring-inset ring-orange-400/30'
          : 'text-muted-foreground'

  return (
    <span
      className={cn(
        'flex h-7 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
        medalClass
      )}
    >
      {rank}
    </span>
  )
}

function LeaderboardEntry({
  isLinked,
  metric,
  row,
  youLabel,
}: {
  isLinked: boolean
  metric: LeaderboardMetric
  row: LeaderboardRow
  youLabel: string
}) {
  const canLink = isLinkablePennyDBDisplayName(row.displayName)
  const delta = row.delta ?? 0
  const deltaLabel =
    delta > 0 ? `+${numberWithCommaSeparator(delta)}` : delta < 0
      ? numberWithCommaSeparator(delta)
      : null

  const name = canLink ? (
    <button
      className="group flex min-w-0 items-center gap-1.5 text-left hover:text-primary"
      onClick={() =>
        window.electronAPI.openExternalURL(
          pennyDBProfileUrl(row.displayName)
        )
      }
      title={row.displayName}
      type="button"
    >
      <span className="truncate group-hover:underline">
        {row.displayName}
      </span>
      <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  ) : (
    <span className="truncate" title={row.displayName}>
      {row.displayName}
    </span>
  )

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-2 py-1.5 text-[0.8125rem] font-medium text-foreground/90',
        isLinked &&
          'rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20'
      )}
      id={leaderboardRowId(row.rank)}
    >
      <RankBadge rank={row.rank} />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {name}
        {isLinked && <Chip tone="accent">{youLabel}</Chip>}
      </span>
      {deltaLabel && (
        <Chip tone={delta > 0 ? 'success' : 'danger'}>{deltaLabel}</Chip>
      )}
      <span className="shrink-0 text-sm font-bold tabular-nums">
        {formatLeaderboardValue(row.value, metric)}
      </span>
    </li>
  )
}

function MetricIcon({ icon: Icon }: { icon: string | LucideIcon }) {
  if (typeof Icon !== 'string') {
    return <Icon className="size-5 shrink-0 text-primary" />
  }

  return (
    <img
      alt=""
      className="size-5 shrink-0 object-contain"
      loading="lazy"
      src={Icon}
    />
  )
}

function formatLeaderboardValue(
  value: number,
  metric: LeaderboardMetric
) {
  if (metric.startsWith('frostnite_')) {
    return new Date(value).toLocaleString(undefined, {
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      second: '2-digit',
    })
  }

  return numberWithCommaSeparator(value)
}
