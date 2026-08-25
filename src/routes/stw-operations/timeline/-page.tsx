import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { TimelineSeason } from '../../../kernel/core/timeline'

import { CalendarRange, Gift, ScrollText, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { GoToTop } from '../../../components/go-to-top'
import { Input } from '../../../components/ui/input'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemTile } from '../../../components/items/item-tile'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  StatusPill,
} from '../../../components/page'

import { useItemDatabaseStore } from '../../../state/items/database'

import { cn } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={CalendarRange}
        section={t('stw-operations.title')}
        title={
          <span className="flex items-center gap-2">
            {t('stw-operations.options.timeline')}
            <BetaBadge />
          </span>
        }
        description="Every Ventures season in running order, with the items each week's event shop stocks."
      />
      <Content />
    </>
  )
}

function Content() {
  const [detail, setDetail] = useState<ItemDetailSubject | null>(null)
  const [search, setSearch] = useState('')
  const [seasons, setSeasons] = useState<Array<TimelineSeason>>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)

  useEffect(() => {
    const listener = window.electronAPI.responseTimeline(
      async (response) => {
        setSeasons(response.seasons)
        setCurrentIndex(response.currentIndex)
        setErrorMessage(response.errorMessage ?? null)
      }
    )

    window.electronAPI.requestTimeline()

    return () => {
      listener.removeListener()
    }
  }, [])

  /**
   * Searching matches the season, its questlines, and the display name of
   * anything its shop stocks — "find the season with that hero in it" is the
   * question this page exists to answer.
   */
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()

    if (needle.length <= 0) {
      return seasons
    }

    return seasons.filter((season) => {
      if (season.name.toLowerCase().includes(needle)) {
        return true
      }

      if (
        season.questlines.some((questline) =>
          (questline.description ?? '').toLowerCase().includes(needle)
        )
      ) {
        return true
      }

      return season.eventShop.some((week) =>
        week.some((templateId) => {
          const record = records[templateId.toLowerCase()]

          return (
            templateId.toLowerCase().includes(needle) ||
            (record?.name ?? '').toLowerCase().includes(needle)
          )
        })
      )
    })
  }, [records, search, seasons])

  if (errorMessage) {
    return (
      <Callout
        title="Could not load the timeline"
        tone="danger"
      >
        {errorMessage}
      </Callout>
    )
  }

  if (seasons.length <= 0) {
    return (
      <EmptyState
        description="Fetching the season schedule."
        icon={CalendarRange}
        title="Loading timeline"
      />
    )
  }

  return (
    <>
      <Panel id="timeline-card">
        <PanelBody>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Season, questline, or an item in its shop"
              value={search}
            />
          </label>
        </PanelBody>
      </Panel>

      <ol className="space-y-3">
        {filtered.map((season) => (
          <SeasonRow
            isCurrent={seasons.indexOf(season) === currentIndex}
            key={`${season.name}-${season.startsAt}`}
            onInspect={setDetail}
            records={records}
            season={season}
          />
        ))}
      </ol>

      {filtered.length <= 0 && (
        <EmptyState
          description="No season matches that search."
          icon={Search}
          title="No results"
        />
      )}

      <ItemDetailDialog
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null)
          }
        }}
        ratings={ratings}
        records={records}
        subject={detail}
      />

      <GoToTop containerId="timeline-card" />
    </>
  )
}

function SeasonRow({
  isCurrent,
  onInspect,
  records,
  season,
}: {
  isCurrent: boolean
  onInspect: (subject: ItemDetailSubject) => void
  records: ItemRecordMap
  season: TimelineSeason
}) {
  const [open, setOpen] = useState(isCurrent)

  const isPast = new Date(season.endsAt).getTime() < Date.now()

  return (
    <li>
      <Panel
        className={cn(
          isCurrent && 'border-primary/50',
          isPast && !isCurrent && 'opacity-60'
        )}
      >
        <button
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <span
            aria-hidden
            className="h-9 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: season.color ?? '#888' }}
          />

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[0.9375rem] font-semibold">
                {season.name}
              </span>
              {isCurrent && <StatusPill tone="active">Live now</StatusPill>}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {dayjs(season.startsAt).format('MMM D, YYYY')} →{' '}
              {dayjs(season.endsAt).format('MMM D, YYYY')} ·{' '}
              {season.duration} week{season.duration === 1 ? '' : 's'}
              {isCurrent &&
                ` · ends ${dayjs(season.endsAt).fromNow()}`}
              {!isPast &&
                !isCurrent &&
                ` · starts ${dayjs(season.startsAt).fromNow()}`}
            </span>
          </span>

          <span className="shrink-0 text-xs text-muted-foreground">
            {season.eventShop.length} shop week
            {season.eventShop.length === 1 ? '' : 's'}
          </span>
        </button>

        {open && (
          <div className="space-y-4 border-t border-border/60 px-4 py-4">
            {season.questlines.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <ScrollText className="size-3" />
                  Questlines
                </p>
                <ul className="space-y-1.5">
                  {season.questlines.map((questline, index) => (
                    <li
                      className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                      key={`${questline.eventFlag}-${index}`}
                    >
                      {questline.description ?? questline.eventFlag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {season.eventShop.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Gift className="size-3" />
                  Event shop, week by week
                </p>
                <ol className="space-y-3">
                  {season.eventShop.map((week, index) => (
                    <li
                      className="flex flex-wrap items-start gap-2"
                      key={index}
                    >
                      <span className="mt-6 w-12 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        Wk {index + 1}
                      </span>
                      {week.map((templateId) => (
                        <ItemTile
                          key={templateId}
                          onClick={() => onInspect({ templateId })}
                          records={records}
                          size="small"
                          templateId={templateId}
                        />
                      ))}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Panel>
    </li>
  )
}
