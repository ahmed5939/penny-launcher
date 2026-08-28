import type {
  LeaderboardMetric,
  LeaderboardRow,
} from '../../../kernel/core/leaderboard-parse'
import type { SegmentedOption } from '../../../components/page'

import { UpdateIcon } from '@radix-ui/react-icons'
import { ExternalLink, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Callout,
  Chip,
  EmptyState,
  ListRow,
  PageHeader,
  Panel,
  PanelBody,
  Segmented,
} from '../../../components/page'

import {
  isLinkablePennyDBDisplayName,
} from '../../../kernel/core/leaderboard-parse'

import { pennyDbLinks } from '../../../config/about/links'

import { pennyDBProfileUrl } from '../../../services/endpoints/pennydb'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'

import { useLeaderboardData } from './-hooks'

const metricOrder: Array<LeaderboardMetric> = [
  'power_level',
  'stw_matches_played',
  'account_stw_level',
  'stw_collectionbook_level',
  'llamas_opened',
]

export function RouteComponent() {
  const { t } = useTranslation(['stw-operations', 'sidebar'])

  const {
    errorMessage,
    handleRefresh,
    isLoading,
    linkedDisplayNames,
    metric,
    rows,
    setMetric,
  } = useLeaderboardData()

  const metricOptions: Array<SegmentedOption<LeaderboardMetric>> =
    metricOrder.map((value) => ({
      label: t(`leaderboards.metric.${value}`),
      value,
    }))

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

      <Panel id="leaderboards-card">
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold text-muted-foreground">
              {t('leaderboards.metric.label')}
            </p>
            <Segmented
              className="max-w-full flex-wrap"
              onChange={setMetric}
              options={metricOptions}
              value={metric}
            />
          </div>

          {errorMessage && (
            <Callout
              title={t('leaderboards.error-title')}
              tone="danger"
            >
              {errorMessage}
            </Callout>
          )}

          {rows.length <= 0 ? (
            <EmptyState
              description={
                isLoading
                  ? t('leaderboards.loading-description')
                  : t('leaderboards.empty-description')
              }
              icon={Trophy}
              title={
                isLoading
                  ? t('leaderboards.loading')
                  : t('leaderboards.empty')
              }
            />
          ) : (
            <ul className="divide-y divide-border/50">
              {rows.map((row) => (
                <LeaderboardEntry
                  isLinked={linkedDisplayNames.has(
                    row.displayName.toLowerCase()
                  )}
                  key={`${row.profileId}-${row.rank}`}
                  metricLabel={t(`leaderboards.metric.${metric}`)}
                  row={row}
                  youLabel={t('leaderboards.you')}
                />
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <GoToTop containerId="leaderboards-card" />
    </>
  )
}

function LeaderboardEntry({
  isLinked,
  metricLabel,
  row,
  youLabel,
}: {
  isLinked: boolean
  metricLabel: string
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
      className="truncate text-left hover:text-primary hover:underline"
      onClick={() =>
        window.electronAPI.openExternalURL(
          pennyDBProfileUrl(row.displayName)
        )
      }
      title={row.displayName}
      type="button"
    >
      {row.displayName}
    </button>
  ) : (
    <span className="truncate">{row.displayName}</span>
  )

  return (
    <ListRow
      caption={
        <span className="flex items-center gap-1.5">
          {metricLabel}
          {isLinked && <Chip tone="accent">{youLabel}</Chip>}
          {deltaLabel && (
            <Chip tone={delta > 0 ? 'success' : 'danger'}>{deltaLabel}</Chip>
          )}
        </span>
      }
      figure={numberWithCommaSeparator(row.value)}
      name={
        <span className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {row.rank}
          </span>
          {name}
          {canLink && (
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
          )}
        </span>
      }
    />
  )
}
