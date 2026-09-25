import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import type {
  LeaderboardMetric,
  LeaderboardRow,
} from '../../../kernel/core/leaderboard-parse'
import { ExternalLink, Search, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  PanelSectionHeader,
  RefreshButton,
  SearchField,
  ToolBadges,
} from '../../../components/page'
import {
  isLinkablePennyDBDisplayName,
} from '../../../kernel/core/leaderboard-parse'

import { pennyDbLinks } from '../../../config/about/links'
import { raritiesColor, RarityType } from '../../../config/constants/resources'
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
        status={<ToolBadges beta />}
        title={t('leaderboards.title')}
        description={t('leaderboards.description')}
        actions={
          <>
            <RefreshButton
              label={t('leaderboards.refresh')}
              loading={isLoading}
              onClick={handleRefresh}
            />
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
                  <SearchField
                    className="block w-full min-w-0"
                    label={t('leaderboards.search')}
                    onChange={setQuery}
                    placeholder={t('leaderboards.search')}
                    value={query}
                  />
                </div>

                <div className="max-h-80 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-2 lg:max-h-none">
                {visibleGroups.map((group) => (
                  <section key={group.label}>
                    <PanelSectionHeader
                      className="border-b-0 px-2 pb-1 pt-0"
                      title={group.label}
                    />
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
                    <EmptyState
                      className="border-0 bg-transparent py-8"
                      icon={Search}
                      title={t('leaderboards.no-metrics')}
                    />
                  )}
                </div>
              </div>
            </aside>

            <div className="min-w-0 space-y-4 p-4">
              {activeMetric && (
                <div className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-3">
                  {typeof activeMetric.icon === 'string' ? (
                    <img alt="" className="size-10 shrink-0 object-contain" src={activeMetric.icon} />
                  ) : (
                    <activeMetric.icon className="size-7 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-title font-semibold">{activeMetric.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {rows.length > 0
                        ? t('leaderboards.ranked-count', {
                            count: rows.length,
                          })
                        : t('leaderboards.top-commanders')}
                    </p>
                  </div>
                  <SearchField
                    className="w-full min-w-0 flex-none sm:w-56"
                    label={t('leaderboards.search-players')}
                    onChange={setPlayerQuery}
                    placeholder={t('leaderboards.search-players')}
                    value={playerQuery}
                  />
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
                  {!playerQuery.trim() && rows.length >= 3 && (
                    <Podium
                      linkedDisplayNames={linkedDisplayNames}
                      metric={metric}
                      rows={rows.slice(0, 3)}
                    />
                  )}
                  <div className="flex items-center gap-3 border-b border-border/60 px-2 pb-1.5 text-xs font-medium text-muted-foreground">
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
                    <EmptyState
                      className="border-0 bg-transparent py-8"
                      icon={Search}
                      title={t('leaderboards.no-players', {
                        query: playerQuery.trim(),
                      })}
                    />
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

/** Gold, silver and bronze, borrowed from the rarity palette. */
const medalColors: Record<number, string> = {
  1: raritiesColor[RarityType.Mythic],
  2: raritiesColor[RarityType.Common],
  3: raritiesColor[RarityType.Legendary],
}

function medalStyle(color: string | undefined): CSSProperties | undefined {
  if (!color) return undefined

  return {
    backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)`,
    color,
  }
}

/**
 * The top three, as a game's results screen shows them: first in the middle
 * and tallest, the medal colour carried by the figure rather than a box.
 */
function Podium({
  linkedDisplayNames,
  metric,
  rows,
}: {
  linkedDisplayNames: Set<string>
  metric: LeaderboardMetric
  rows: Array<LeaderboardRow>
}) {
  const [first, second, third] = rows
  const order = [second, first, third].filter(Boolean)

  return (
    <ol
      aria-label="Top three"
      className="mb-3 grid grid-cols-3 items-end gap-2"
    >
      {order.map((row) => {
        const color = medalColors[row.rank]
        const isLinked = linkedDisplayNames.has(row.displayName.toLowerCase())

        return (
          <li
            className={cn(
              'flex min-w-0 flex-col items-center gap-1 rounded-xl px-3 text-center',
              row.rank === 1 ? 'pb-4 pt-5' : 'pb-3 pt-3'
            )}
            key={`${row.profileId}-${row.rank}`}
            style={{
              backgroundImage: `linear-gradient(to top, color-mix(in srgb, ${color} 14%, transparent), transparent)`,
            }}
          >
            <Trophy
              className={row.rank === 1 ? 'size-6' : 'size-5'}
              style={{ color }}
            />
            <span
              className="figure text-xs font-semibold"
              style={{ color }}
            >
              #{row.rank}
            </span>
            <span
              className={cn(
                'w-full truncate text-ui font-semibold',
                isLinked && 'text-primary'
              )}
              title={row.displayName}
            >
              {row.displayName}
            </span>
            <span
              className={cn(
                'figure font-bold leading-none',
                row.rank === 1 ? 'text-xl' : 'text-base'
              )}
            >
              {formatLeaderboardValue(row.value, metric)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const medal = medalColors[rank]

  return (
    <span
      className={cn(
        'flex h-7 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
        !medal && 'text-muted-foreground'
      )}
      style={medalStyle(medal)}
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
        'flex items-center gap-3 px-2 py-1.5 text-ui font-medium text-foreground/90',
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
