import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type {
  TimelinePayload,
  TimelineQuestline,
  TimelineSeason,
  TimelineSeasonExtras,
} from '../../../kernel/core/timeline'

import { CalendarRange, ScrollText, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import { GoToTop } from '../../../components/go-to-top'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemTile } from '../../../components/items/item-tile'
import {
  Callout,
  Chip,
  EmptyState,
  KeyValue,
  PageHeader,
  Panel,
  PanelBody,
  SearchField,
  Segmented,
  StatusPill,
} from '../../../components/page'

import { useItemDatabaseStore } from '../../../state/items/database'
import { usePageBackdrop } from '../../../components/page/page-backdrop'
import { eventBackdrop, seasonBackdrop } from '../../../config/backdrops'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { cn } from '../../../lib/utils'

/** The colours the game trains players to read the three elements as. */
const elementColors: Record<string, string> = {
  Fire: '#fb923c',
  Water: '#60a5fa',
  Nature: '#4ade80',
}

type DetailTab = 'overview' | 'quests' | 'shop'

function entryName(entry: TimelineQuestline, records: ItemRecordMap) {
  if (entry.name && !/^phase\s*\d+$/i.test(entry.name)) return entry.name

  const heroNames = entry.keyItems
    .filter((templateId) => templateId.toLowerCase().startsWith('hero:'))
    .map((templateId) => records[templateId.toLowerCase()]?.name)
    .filter(Boolean)

  return heroNames.length > 0 ? heroNames.join(', ') : null
}

function availableSeasonItems(season: TimelineSeason) {
  const items = season.extras?.availableItems ?? []

  // The community overview has not yet listed this event-shop hero.
  if (
    season.name.trim().toLowerCase() === 'hexsylvania' &&
    !items.some((item) => item.name.toLowerCase() === 'aerobic assassin')
  ) {
    return [...items, { name: 'Aerobic Assassin', type: 'Ninja' }]
  }

  return items
}

function seasonKey(season: TimelineSeason) {
  return `${season.name}-${season.startsAt}`
}

/** The live season; failing that the next to start; failing that the last. */
function defaultSeasonKey(payload: TimelinePayload) {
  if (payload.seasons.length <= 0) {
    return null
  }

  if (payload.currentIndex >= 0) {
    return seasonKey(payload.seasons[payload.currentIndex])
  }

  const upcoming = payload.seasons.find(
    (season) => new Date(season.endsAt).getTime() > Date.now()
  )

  return seasonKey(upcoming ?? payload.seasons[payload.seasons.length - 1])
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={CalendarRange}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.timeline')}
        description="Every Ventures season in running order — its modifier, llama and event mode via the community Bug List, plus the items each week's event shop stocks."
      />
      <Content />
    </>
  )
}

/** Template id prefixes (record keys are lower-case) an event shop sells. */
const shopItemFamilies = new Set(['hero', 'schematic', 'defender', 'worker'])

const topRarities = new Set(['Legendary', 'Mythic'])

/**
 * Lookup key for matching Bug List names against the item database: case
 * and a leading "The" are ignored ("Ice King" is "The Ice King" in-game).
 */
function itemNameKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, '')
}

/**
 * The Bug List sometimes tacks the item type onto the name ("Chaos Exploder
 * Rifle" for the assault rifle the game calls "Chaos Exploder"). On a miss,
 * trailing words that repeat the type are dropped one at a time and retried.
 */
function findItemByName<T>(
  itemsByName: Map<string, T>,
  item: { name: string; type: string | null }
) {
  const words = itemNameKey(item.name).split(/\s+/)
  const typeWords = new Set(itemNameKey(item.type ?? '').split(/\s+/))

  while (words.length > 0) {
    const match = itemsByName.get(words.join(' '))

    if (match || words.length <= 1 || !typeWords.has(words.at(-1) ?? '')) {
      return match
    }

    words.pop()
  }

  return undefined
}

function Content() {
  useRequestItemDatabase()

  const [detail, setDetail] = useState<ItemDetailSubject | null>(null)
  const [search, setSearch] = useState('')
  const [seasons, setSeasons] = useState<Array<TimelineSeason>>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)

  /**
   * The Trello cards name items in plain English ("Grave Digger") while the
   * shop and the detail dialog speak template ids. Matching display names
   * back against the item database turns those entries into real, clickable
   * items. Where several template ids share a name, the Legendary (or
   * Mythic) one wins — that is the version an event shop actually stocks.
   * Only the families an event shop sells are indexed: quests and card packs
   * reuse item names ("The Dire", "Frostbite") and would steal the match.
   */
  const itemsByName = useMemo(() => {
    const map = new Map<string, { rarity: string | null; templateId: string }>()

    for (const [templateId, record] of Object.entries(records)) {
      if (!record.name || !shopItemFamilies.has(templateId.split(':')[0])) {
        continue
      }

      const key = itemNameKey(record.name)
      const current = map.get(key)

      if (
        !current ||
        (!topRarities.has(current.rarity ?? '') &&
          topRarities.has(record.rarity ?? ''))
      ) {
        map.set(key, { rarity: record.rarity, templateId })
      }
    }

    return map
  }, [records])

  useEffect(() => {
    const listener = window.electronAPI.responseTimeline(
      async (response) => {
        setSeasons(response.seasons)
        setCurrentIndex(response.currentIndex)
        setErrorMessage(response.errorMessage ?? null)
        setHasLoaded(true)
        // Land the reader on the live season, but never steal a selection
        // they have already made.
        setSelectedKey((previous) => previous ?? defaultSeasonKey(response))
      }
    )

    window.electronAPI.requestTimeline()

    return () => {
      listener.removeListener()
    }
  }, [])

  /**
   * Searching matches the season, its questlines, its Bug List facts, and
   * the display name of anything its shop stocks — "find the season with
   * that hero in it" is the question this page exists to answer.
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
          `${entryName(questline, records) ?? ''} ${questline.description ?? ''}`
            .toLowerCase()
            .includes(needle)
        )
      ) {
        return true
      }

      if (
        season.events.some((event) =>
          `${entryName(event, records) ?? ''} ${event.description ?? ''}`
            .toLowerCase()
            .includes(needle)
        )
      ) {
        return true
      }

      if (
        availableSeasonItems(season).some((item) =>
          item.name.toLowerCase().includes(needle)
        )
      ) {
        return true
      }

      if (season.extras) {
        const haystack = [
          season.extras.kind,
          season.extras.modifier,
          season.extras.llamaName,
          season.extras.eventMode,
          ...season.extras.concurrentEvents,
          ...season.extras.availableItems.map((item) => item.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (haystack.includes(needle)) {
          return true
        }
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

  const selected =
    seasons.find((season) => seasonKey(season) === selectedKey) ?? null

  // The season's event mode (Dungeons, Frostnite…), else its Ventures zone.
  usePageBackdrop(eventBackdrop(selected?.extras?.eventMode, selected?.name) ?? seasonBackdrop(selected?.name))

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
        description={
          hasLoaded
            ? 'Epic did not return any Ventures seasons. Try again in a moment.'
            : 'Fetching the season schedule.'
        }
        icon={CalendarRange}
        title={hasLoaded ? 'No seasons available' : 'Loading timeline'}
      />
    )
  }

  return (
    <>
      <Panel id="timeline-card">
        <PanelBody className="p-0">
          <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="border-b border-border/60 bg-surface/30 lg:border-b-0 lg:border-r">
              <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 p-3 backdrop-blur">
                <SearchField
                  className="block w-full min-w-0"
                  label="Search seasons"
                  onChange={setSearch}
                  placeholder="Season, questline, modifier, or an item in its shop"
                  value={search}
                />
              </div>

              <div className="max-h-80 overflow-y-auto p-2 lg:max-h-[70vh]">
                <ol className="space-y-0.5">
                  {filtered.map((season) => (
                    <SeasonListItem
                      isCurrent={seasons.indexOf(season) === currentIndex}
                      isSelected={seasonKey(season) === selectedKey}
                      key={seasonKey(season)}
                      onSelect={() => setSelectedKey(seasonKey(season))}
                      season={season}
                    />
                  ))}
                </ol>
                {filtered.length <= 0 && (
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={Search}
                    title="No season matches that search."
                  />
                )}
              </div>
            </aside>

            <div className="min-w-0 p-4">
              {selected ? (
                <SeasonDetail
                  isCurrent={seasons.indexOf(selected) === currentIndex}
                  itemsByName={itemsByName}
                  onInspect={setDetail}
                  onTabChange={setTab}
                  records={records}
                  season={selected}
                  tab={tab}
                />
              ) : (
                <EmptyState
                  description="Pick a season from the list."
                  icon={CalendarRange}
                  title="No season selected"
                />
              )}
            </div>
          </div>
        </PanelBody>
      </Panel>

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

function SeasonListItem({
  isCurrent,
  isSelected,
  onSelect,
  season,
}: {
  isCurrent: boolean
  isSelected: boolean
  onSelect: () => void
  season: TimelineSeason
}) {
  const isPast = new Date(season.endsAt).getTime() < Date.now()

  return (
    <li>
      <button
        aria-pressed={isSelected}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
          isSelected
            ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/25'
            : 'text-foreground/80 hover:bg-accent hover:text-foreground',
          isPast && !isSelected && !isCurrent && 'opacity-60'
        )}
        onClick={onSelect}
        type="button"
      >
        <span
          aria-hidden
          className={cn(
            'h-8 w-1 shrink-0 rounded-full',
            !season.color && 'bg-muted-foreground'
          )}
          style={
            season.color ? { backgroundColor: season.color } : undefined
          }
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold">
              {season.name}
            </span>
            {isCurrent && (
              <StatusPill
                pulse
                tone="active"
                variant="dot"
              >
                Live now
              </StatusPill>
            )}
          </span>
          <span
            className={cn(
              'mt-0.5 block truncate text-2xs',
              isSelected ? 'text-primary/80' : 'text-muted-foreground'
            )}
          >
            {dayjs(season.startsAt).format('MMM D, YYYY')} →{' '}
            {dayjs(season.endsAt).format('MMM D, YYYY')}
          </span>
        </span>
      </button>
    </li>
  )
}

/**
 * One season, one screen. The old layout stacked every section into a single
 * expanding row and the page collapsed under its own data; here the reader
 * picks the slice instead. Tabs with nothing behind them are disabled rather
 * than hidden, so the page keeps one stable shape across seasons.
 */
function SeasonDetail({
  isCurrent,
  itemsByName,
  onInspect,
  onTabChange,
  records,
  season,
  tab,
}: {
  isCurrent: boolean
  itemsByName: Map<string, { rarity: string | null; templateId: string }>
  onInspect: (subject: ItemDetailSubject) => void
  onTabChange: (tab: DetailTab) => void
  records: ItemRecordMap
  season: TimelineSeason
  tab: DetailTab
}) {
  const isPast = new Date(season.endsAt).getTime() < Date.now()

  const hasQuests = season.questlines.length > 0 || season.events.length > 0
  const hasShop = season.eventShop.length > 0
  const availableItems = availableSeasonItems(season)

  // The tab choice survives switching seasons; when the new season has
  // nothing behind the chosen tab, fall back rather than show a blank pane.
  const activeTab =
    (tab === 'quests' && !hasQuests) || (tab === 'shop' && !hasShop)
      ? 'overview'
      : tab

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-3">
        <span
          aria-hidden
          className={cn(
            'h-10 w-1 shrink-0 rounded-full',
            !season.color && 'bg-muted-foreground'
          )}
          style={
            season.color ? { backgroundColor: season.color } : undefined
          }
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-title font-semibold">{season.name}</h2>
            {isCurrent && (
              <StatusPill
                pulse
                tone="active"
              >
                Live now
              </StatusPill>
            )}
            {season.extras?.kind && <Chip>{season.extras.kind} season</Chip>}
            {season.extras?.eventMode && (
              <Chip>{season.extras.eventMode}</Chip>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {dayjs(season.startsAt).format('MMM D, YYYY')} →{' '}
            {dayjs(season.endsAt).format('MMM D, YYYY')} · {season.duration}{' '}
            week{season.duration === 1 ? '' : 's'}
            {isCurrent && ` · ends ${dayjs(season.endsAt).fromNow()}`}
            {!isPast &&
              !isCurrent &&
              ` · starts ${dayjs(season.startsAt).fromNow()}`}
          </p>
        </div>

        <Segmented<DetailTab>
          onChange={onTabChange}
          options={[
            { label: 'Overview', value: 'overview' },
            {
              disabled: !hasQuests,
              label: 'Quests & events',
              value: 'quests',
            },
            {
              disabled: !hasShop,
              label: `Weekly shop · ${season.eventShop.length}`,
              value: 'shop',
            },
          ]}
          value={activeTab}
        />
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          {season.extras ? (
            <SeasonOverview
              extras={season.extras}
              onInspect={onInspect}
              season={season}
            />
          ) : (
            <EmptyState
              className="border-0 bg-transparent py-8"
              title="The Bug List has no card for this season yet."
            />
          )}

          {availableItems.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
                <Sparkles className="size-3" />
                Available this season
              </p>
              <ul className="flex flex-wrap items-center gap-1.5">
                {availableItems.map((item) => {
                  const match = findItemByName(itemsByName, item)

                  return (
                    <li key={`${item.name}-${item.type}`}>
                      {match ? (
                        <ItemTile
                          onClick={() =>
                            onInspect({ templateId: match.templateId })
                          }
                          records={records}
                          size="small"
                          templateId={match.templateId}
                        />
                      ) : (
                        <Chip>
                          {item.name}
                          {item.type ? ` · ${item.type}` : ''}
                        </Chip>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'quests' && (
        <div className="space-y-4">
          {season.questlines.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
                <ScrollText className="size-3" />
                Questlines
              </p>
              <ul className="space-y-1.5">
                {season.questlines.map((questline, index) => (
                  <li
                    className="rounded-lg bg-muted/30 px-3 py-2.5"
                    key={`${questline.eventFlag}-${index}`}
                  >
                    <p className="text-xs font-semibold text-foreground">
                      {entryName(questline, records) ?? 'Questline'}
                      <WeekRange entry={questline} />
                    </p>
                    {questline.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {questline.description}
                      </p>
                    )}
                    <KeyItems
                      items={questline.keyItems}
                      onInspect={onInspect}
                      records={records}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {season.events.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
                <CalendarRange className="size-3" />
                Limited-time events
              </p>
              <ul className="grid gap-2 lg:grid-cols-2">
                {season.events.map((event, index) => (
                  <li
                    className="rounded-lg bg-muted/30 px-3 py-2.5"
                    key={`${event.eventFlag}-${index}`}
                  >
                    <p className="text-xs font-semibold text-foreground">
                      {entryName(event, records) ?? 'Event'}
                      <WeekRange entry={event} />
                    </p>
                    {event.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                    <KeyItems
                      items={event.keyItems}
                      onInspect={onInspect}
                      records={records}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'shop' && (
        <ol className="divide-y divide-border/40">
          {season.eventShop.map((week, index) => (
            <li
              className="flex flex-wrap items-start gap-2 py-2.5 first:pt-0"
              key={index}
            >
              <span className="mt-5 w-14 shrink-0 text-xs font-medium text-muted-foreground">
                Week <span className="figure text-foreground">{index + 1}</span>
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
      )}
    </div>
  )
}

/**
 * The season's character sheet, from its card on The Bug List — kind,
 * alert elements, modifier, llama, event mode, and what else runs alongside.
 * Only rendered for the selected season: the screenshot behind `imageUrl`
 * is a multi-megabyte original, so nothing else may fetch it.
 */
function SeasonOverview({
  extras,
  onInspect,
  season,
}: {
  extras: TimelineSeasonExtras
  onInspect: (subject: ItemDetailSubject) => void
  season: TimelineSeason
}) {
  return (
    <div className="space-y-3">
      {extras.imageUrl && (
        <figure>
          <img
            alt={`${season.name} loading screen`}
            className="max-h-56 w-full rounded-xl object-cover"
            loading="lazy"
            src={extras.imageUrl}
          />
          {extras.imageCredit && (
            <figcaption className="mt-1 text-2xs text-muted-foreground">
              Image by {extras.imageCredit}, via The Bug List
            </figcaption>
          )}
        </figure>
      )}

      <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-muted/30 px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {extras.kind && (
          <KeyValue
            label="Season type"
            value={
              extras.improvedRewards === null
                ? extras.kind
                : `${extras.kind} — ${
                    extras.improvedRewards
                      ? 'improved rewards'
                      : 'standard rewards'
                  }`
            }
          />
        )}
        {extras.alertElements.length > 0 && (
          <KeyValue
            label="Mission alerts"
            value={
              <span className="flex flex-wrap gap-1.5">
                {extras.alertElements.map((element) => (
                  <Chip key={element}>
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: elementColors[element] }}
                    />
                    {element}
                  </Chip>
                ))}
              </span>
            }
          />
        )}
        {extras.modifier && (
          <KeyValue
            label="Modifier"
            value={extras.modifier}
          />
        )}
        {extras.llamaName && (
          <KeyValue
            label="Seasonal llama"
            value={
              season.llamaType ? (
                <button
                  className="underline-offset-2 hover:underline"
                  onClick={() =>
                    onInspect({ templateId: season.llamaType as string })
                  }
                  type="button"
                >
                  {extras.llamaName}
                </button>
              ) : (
                extras.llamaName
              )
            }
          />
        )}
        {extras.eventMode && (
          <KeyValue
            label="Event mode"
            value={extras.eventMode}
          />
        )}
        {extras.concurrentEvents.length > 0 && (
          <KeyValue
            label="Also this season"
            value={extras.concurrentEvents.join(' · ')}
          />
        )}
      </dl>
    </div>
  )
}

function WeekRange({
  entry,
}: {
  entry: { startWeek: number | null; endWeek: number | null }
}) {
  if (entry.startWeek === null && entry.endWeek === null) return null

  return (
    <span className="ml-2 font-normal text-muted-foreground">
      · week {entry.startWeek ?? 1}
      {entry.endWeek !== null && entry.endWeek !== entry.startWeek
        ? `–${entry.endWeek}`
        : ''}
    </span>
  )
}

function KeyItems({
  items,
  onInspect,
  records,
}: {
  items: Array<string>
  onInspect: (subject: ItemDetailSubject) => void
  records: ItemRecordMap
}) {
  // Placeholder ids like `Weapon:peglegweapon_t01` have no art or record.
  const known = items.filter((templateId) => records[templateId.toLowerCase()])

  if (known.length <= 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {known.map((templateId) => (
        <ItemTile
          key={templateId}
          onClick={() => onInspect({ templateId })}
          records={records}
          size="small"
          templateId={templateId}
        />
      ))}
    </div>
  )
}
