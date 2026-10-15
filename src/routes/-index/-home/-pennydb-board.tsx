import { ExternalLink, MapPinned, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'

import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import {
  Chip,
  EmptyState,
  FilterBar,
  Panel,
  PanelBody,
  PanelHeader,
  Picker,
  type PickerOption,
  RefreshButton,
  Segmented,
} from '../../../components/page'

import { pennyDbLinks } from '../../../config/about/links'
import {
  isPennyDBVBuckReward,
  pennyDBMissionZones,
  pennyDBZoneColors,
  pennyDBZoneLetters,
  type PennyDBMissionReward,
  type PennyDBMissionZone,
} from '../../../services/endpoints/pennydb'
import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { cn } from '../../../lib/utils'

import {
  filterPennyDBBoardRows,
  usePennyDBMissionsBoard,
  type PennyDBBoardFilter,
  type PennyDBBoardRow,
} from './-pennydb-hooks'

const zoneLabelKeys: Record<PennyDBMissionZone, string> = {
  stonewood: 'home.mission-board.zones.stonewood',
  plankerton: 'home.mission-board.zones.plankerton',
  canny_valley: 'home.mission-board.zones.canny-valley',
  twine_peaks: 'home.mission-board.zones.twine-peaks',
  ventures: 'home.mission-board.zones.ventures',
}

/**
 * Read-only daily missions from Penny DB. Does not claim or buy anything —
 * Epic world-info on this same page still owns alerts and completions.
 */
export function PennyDBMissionBoard() {
  const { t } = useTranslation(['general'])
  const {
    alertCount,
    errorMessage,
    isLoading,
    lastUpdatedAt,
    refresh,
    rows,
    vbucksCount,
  } = usePennyDBMissionsBoard()
  const [zone, setZone] = useState<PennyDBMissionZone | 'all'>('twine_peaks')
  const [filter, setFilter] = useState<PennyDBBoardFilter>('all')

  const visible = useMemo(
    () => filterPennyDBBoardRows(rows, zone, filter),
    [filter, rows, zone]
  )

  const zoneOptions: Array<PickerOption<PennyDBMissionZone | 'all'>> = [
    {
      label: t('home.mission-board.zone-all'),
      value: 'all',
    },
    ...pennyDBMissionZones.map((id) => ({
      label: t(zoneLabelKeys[id]),
      value: id,
    })),
  ]

  const updatedLabel = lastUpdatedAt
    ? dayjs(lastUpdatedAt).format('LT')
    : null

  return (
    <Panel
      aria-busy={isLoading}
    >
      <PanelHeader
        compact
        icon={MapPinned}
        title={t('home.mission-board.title')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {updatedLabel && (
              <span className="text-caption text-muted-foreground">
                {t('home.mission-board.updated', { time: updatedLabel })}
              </span>
            )}
            <RefreshButton
              label={t('home.mission-board.refresh')}
              loading={isLoading}
              onClick={refresh}
            />
            <Button
              onClick={() =>
                window.electronAPI.openExternalURL(pennyDbLinks.stwMissions)
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              <ExternalLink className="size-3.5" />
              {t('home.mission-board.open-site')}
            </Button>
          </div>
        }
      />
      <FilterBar>
        <Picker
          label={t('home.mission-board.zone')}
          onChange={setZone}
          options={zoneOptions}
          value={zone}
        />
        <Segmented
          label="Mission filter"
          onChange={setFilter}
          options={[
            {
              label: t('home.mission-board.filter-all'),
              value: 'all',
            },
            {
              label: t('home.mission-board.filter-alerts'),
              value: 'alerts',
            },
            {
              label: t('home.mission-board.filter-vbucks'),
              value: 'vbucks',
            },
          ]}
          value={filter}
        />
      </FilterBar>
      <PanelBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={alertCount > 0 ? 'accent' : 'neutral'}>
            {t('home.mission-board.alerts-count', { count: alertCount })}
          </Chip>
          <Chip tone={vbucksCount > 0 ? 'warning' : 'neutral'}>
            {t('home.mission-board.vbucks-count', { count: vbucksCount })}
          </Chip>
        </div>

        {errorMessage && !isLoading && rows.length === 0 ? (
          <EmptyState
            action={
              <RefreshButton
                label={t('home.mission-board.refresh')}
                loading={isLoading}
                onClick={refresh}
              />
            }
            description={errorMessage}
            title={t('home.mission-board.error')}
          />
        ) : isLoading && rows.length === 0 ? (
          <BoardSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState title={t('home.mission-board.empty')} />
        ) : (
          <ul className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
            {visible.map((row) => (
              <MissionBoardRow
                key={row.id}
                row={row}
              />
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  )
}

function MissionBoardRow({ row }: { row: PennyDBBoardRow }) {
  const { t } = useTranslation(['general'])
  const color = pennyDBZoneColors[row.zone]
  const letter = pennyDBZoneLetters[row.zone]
  const typeName = row.mission.missionType?.name ?? t('unknown')
  const typeIcon = row.mission.missionType?.icon
  const baseRewards = row.mission.rewards ?? []
  const alertRewards = row.mission.alertRewards ?? []

  return (
    <li
      className={cn(
        'flex min-h-12 overflow-hidden rounded-lg',
        row.hasVBucks && 'bg-warning/[0.07]',
        !row.hasVBucks && row.hasAlert && 'bg-primary/[0.04]'
      )}
    >
      <span
        aria-hidden
        className="w-[3px] shrink-0"
        style={{ backgroundColor: color }}
      />

      <span
        className="relative flex w-9 shrink-0 items-center justify-center border-r border-border/50"
        style={{ color }}
      >
        <span
          aria-hidden
          className="absolute inset-0 bg-current opacity-[0.08]"
        />
        <span className="figure relative text-ui font-bold leading-none">
          {letter}
        </span>
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5">
        {typeIcon ? (
          <img
            alt=""
            className="size-6 shrink-0 object-contain"
            decoding="async"
            loading="lazy"
            src={typeIcon}
          />
        ) : (
          <span className="grid size-6 shrink-0 place-items-center text-2xs font-bold text-muted-foreground">
            ?
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-ui font-semibold leading-tight">
            {typeName}
          </span>
          <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
            {t(zoneLabelKeys[row.zone])}
            {row.hasAlert && (
              <>
                {' · '}
                <span className="font-semibold text-primary">
                  {t('home.mission-board.alert')}
                </span>
              </>
            )}
            {row.hasVBucks && (
              <>
                {' · '}
                <span className="font-semibold text-warning">
                  {t('home.mission-board.filter-vbucks')}
                </span>
              </>
            )}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 items-center justify-end gap-1 border-l border-border/40 px-2.5">
        <Zap
          aria-hidden
          className="size-3 shrink-0 fill-current text-primary/50"
        />
        <span className="figure text-sm font-bold tabular-nums leading-none">
          {row.mission.pl || '—'}
        </span>
      </span>

      <span
        className={cn(
          'flex min-w-[9.5rem] max-w-[14rem] shrink-0 items-center gap-1 overflow-hidden border-l px-2',
          row.hasAlert || row.hasVBucks
            ? 'border-primary/20 bg-primary/[0.06]'
            : 'border-border/40 bg-muted/20'
        )}
      >
        <RewardStrip
          rewards={alertRewards}
          variant="alert"
        />
        {alertRewards.length > 0 && baseRewards.length > 0 && (
          <span
            aria-hidden
            className="h-4 w-px shrink-0 bg-border"
          />
        )}
        <RewardStrip
          rewards={baseRewards}
          variant="base"
        />
      </span>
    </li>
  )
}

function RewardStrip({
  rewards,
  variant,
}: {
  rewards: Array<PennyDBMissionReward>
  variant: 'alert' | 'base'
}) {
  const { t } = useTranslation(['general'])
  const shown = rewards.slice(0, variant === 'alert' ? 4 : 3)
  const extra = rewards.length - shown.length

  return (
    <>
      {shown.map((reward, index) => {
        const isVBuck = isPennyDBVBuckReward(reward)
        const quantity = reward.quantity ?? 0
        const name = reward.name || reward.itemType || t('unknown')
        const label = quantity > 1 ? `${name} ×${quantity}` : name

        return (
          <span
            aria-label={label}
            className={cn(
              'relative grid size-7 shrink-0 place-items-center rounded-md bg-background/60 ring-1 ring-inset',
              isVBuck
                ? 'ring-warning/70'
                : variant === 'alert'
                  ? 'ring-primary/35'
                  : 'ring-border/60'
            )}
            key={`${reward.itemType ?? reward.name ?? index}-${index}`}
            role="img"
            title={label}
          >
            {reward.icon ? (
              <img
                alt=""
                className="size-5 object-contain"
                decoding="async"
                loading="lazy"
                src={reward.icon}
              />
            ) : (
              <span className="text-3xs font-bold text-muted-foreground">
                ?
              </span>
            )}
            {quantity > 1 && (
              <span className="figure absolute -bottom-0.5 -right-0.5 rounded bg-background/90 px-0.5 text-3xs font-bold leading-none">
                {numberWithCommaSeparator(quantity)}
              </span>
            )}
          </span>
        )
      })}
      {extra > 0 && (
        <span className="figure shrink-0 text-2xs text-muted-foreground/70">
          +{extra}
        </span>
      )}
    </>
  )
}

function BoardSkeleton() {
  const { t } = useTranslation(['general'])

  return (
    <div
      className="space-y-1"
      role="status"
    >
      <span className="sr-only">{t('home.mission-board.loading')}</span>
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton
          className="h-12 rounded-lg bg-muted/30"
          key={index}
        />
      ))}
    </div>
  )
}
