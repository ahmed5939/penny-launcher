import type { IslandCard, IslandPanel } from './model'
import type { IslandRef } from './parts'
import type { WatchedIsland, WatchlistPayload } from './watchlist'

import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Compass, Plus, Star, TreePalm, TrendingUp, UserPlus, X } from 'lucide-react'

import {
  AnimatedNumber,
  Callout,
  Chip,
  EmptyState,
  FilterBar,
  Pager,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Picker,
  RefreshButton,
  SearchField,
  Segmented,
  StatRow,
  StatTile,
  ToolBadges,
  paginate,
} from '../../components/page'
import { Button } from '../../components/ui/button'

import { relativeTime } from '../../lib/dates'

import { IslandDialog } from './island-dialog'
import { discoverySummary, formatPlayers, hasTrend, islandWebUrl, risingIslands, uniqueIslands } from './model'
import { IslandArt, IslandTile, PlayerFigure, ThresholdPicker } from './parts'
import { refreshDiscovery, updateWatchlist, useIslandsBridge, useIslandsStore } from './store'

const PAGE_SIZE = 24

type SortKey = 'players' | 'rising' | 'name'

/** Long enough that a normal read never shows it; the first read signs in and fetches a token. */
const slowAfterMs = 4_000

function useSlow(active: boolean) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    setSlow(false)

    if (!active) return

    const timer = setTimeout(() => setSlow(true), slowAfterMs)

    return () => clearTimeout(timer)
  }, [active])

  return slow
}

/**
 * Islands — Fortnite's creator islands as Discover lists them, with live
 * player counts, an hour-on-hour trend, and a watchlist that raises a
 * Windows notification when an island gets busy. Anonymous throughout: no
 * account is read or needed.
 */
export function IslandsPage() {
  useIslandsBridge()

  const panels = useIslandsStore((state) => state.panels)
  const loadedAt = useIslandsStore((state) => state.loadedAt)
  const loading = useIslandsStore((state) => state.loading)
  const watchlist = useIslandsStore((state) => state.watchlist)
  const slow = useSlow(loading && panels.length === 0)
  const [open, setOpen] = useState<IslandRef | null>(null)

  const watched = useMemo(
    () => new Map((watchlist?.islands ?? []).map((island) => [island.code, island])),
    [watchlist]
  )
  const toggleWatch = (island: IslandRef) =>
    updateWatchlist(
      watched.has(island.code)
        ? { action: 'remove', code: island.code }
        : { action: 'add', code: island.code, title: island.title }
    )

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<RefreshButton loading={loading} onClick={() => refreshDiscovery(true)} />}
        description="Live player counts from Fortnite's Discover."
        icon={TreePalm}
        section="Tools"
        status={<ToolBadges beta readOnly />}
        title="Islands"
      />

      <DiscoveryNotice />

      {panels.length === 0 && loading && (
        <div role="status">
          <EmptyState
            description={slow ? 'This can take a few seconds.' : undefined}
            icon={TreePalm}
            title="Loading Discover…"
          />
        </div>
      )}

      {panels.length > 0 && (
        <Discover
          loadedAt={loadedAt}
          onOpen={setOpen}
          onToggleWatch={toggleWatch}
          panels={panels}
          watched={watched}
        />
      )}

      <Watching onOpen={setOpen} panels={panels} watchlist={watchlist} />

      {open && <IslandDialog island={open} onClose={() => setOpen(null)} watched={watched.get(open.code) ?? null} />}
    </div>
  )
}

/** What went wrong with the last read, and what to do about it. */
function DiscoveryNotice() {
  const discovery = useIslandsStore((state) => state.discovery)
  const hasPanels = useIslandsStore((state) => state.panels.length > 0)

  if (!discovery) return null

  if (discovery.status === 'no-account') {
    return (
      <EmptyState
        action={
          <Button asChild variant="outline">
            <Link params={{ type: 'quick-login' }} to="/accounts/add/$type">
              <Plus className="mr-2 size-4" />
              Add an account
            </Link>
          </Button>
        }
        description="Add an account to see Discover."
        icon={UserPlus}
        title="Discover needs a linked account"
      />
    )
  }

  if (discovery.status === 'ok') {
    // A read that worked but could not name its tiles.
    return discovery.errorMessage ? (
      <div role="alert">
        <Callout tone="warning">{discovery.errorMessage}</Callout>
      </div>
    ) : null
  }

  return (
    <div role="alert">
      <Callout title="Could not load Discover" tone="danger">
        {discovery.errorMessage ?? 'The discovery service did not answer. Try Refresh.'}
        {hasPanels && ' The islands below are from the last successful read.'}
      </Callout>
    </div>
  )
}

function Discover({
  loadedAt,
  onOpen,
  onToggleWatch,
  panels,
  watched,
}: {
  loadedAt: string | null
  onOpen: (island: IslandRef) => void
  onToggleWatch: (island: IslandRef) => void
  panels: Array<IslandPanel>
  watched: Map<string, WatchedIsland>
}) {
  const summary = useMemo(() => discoverySummary(panels), [panels])
  const rising = useMemo(() => risingIslands(panels), [panels])
  const trend = useMemo(() => hasTrend(panels), [panels])
  const [genre, setGenre] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('players')
  const [page, setPage] = useState(0)

  const panel = panels.find((candidate) => candidate.key === genre)
  const listed = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const source = panel ? panel.islands : uniqueIslands(panels)
    const matches = needle
      ? source.filter((island) => island.title.toLowerCase().includes(needle) || island.code.includes(needle))
      : source

    return [...matches].sort(compareBy(sort))
  }, [panel, panels, query, sort])
  const visible = paginate(listed, page, PAGE_SIZE)

  const tile = (island: IslandCard) => (
    <IslandTile
      island={island}
      key={island.code}
      onOpen={() => onOpen(island)}
      onToggleWatch={() => onToggleWatch(island)}
      watched={watched.has(island.code)}
    />
  )

  return (
    <>
      <StatRow>
        <StatTile label="Islands listed" value={<AnimatedNumber value={summary.islands} />} />
        <StatTile
          hint={summary.hidden > 0 ? `${summary.hidden.toLocaleString('en-GB')} hide their count` : undefined}
          label="Players across them"
          value={formatPlayers(summary.players)}
        />
        <StatTile
          hint={summary.busiest ? `${formatPlayers(summary.busiest.ccu)} playing` : undefined}
          label="Busiest island"
          value={<span className="line-clamp-1 text-base">{summary.busiest?.title ?? 'Unavailable'}</span>}
        />
      </StatRow>

      {rising.length > 0 && (
        <Panel>
          <PanelHeader actions={<span className="text-xs text-muted-foreground">Change over the last hour</span>} compact icon={TrendingUp} title="Rising now" />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{rising.map(tile)}</div>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          actions={loadedAt && <span className="text-xs text-muted-foreground">Read {relativeTime(loadedAt)}</span>}
          compact
          icon={Compass}
          title="Discover"
        />
        <FilterBar>
          <Picker
            label="Genre"
            onChange={(value) => {
              setGenre(value)
              setPage(0)
            }}
            options={[{ value: 'all', label: 'All genres' }, ...panels.map((p) => ({ value: p.key, label: p.label }))]}
            value={panel ? genre : 'all'}
          />
          <SearchField
            label="Search islands"
            onChange={(value) => {
              setQuery(value)
              setPage(0)
            }}
            placeholder="Search by name or code"
            value={query}
          />
          <Segmented<SortKey>
            onChange={(value) => {
              setSort(value)
              setPage(0)
            }}
            options={[
              { value: 'players', label: 'Most players' },
              { value: 'rising', label: 'Rising', disabled: !trend },
              { value: 'name', label: 'A–Z' },
            ]}
            value={sort === 'rising' && !trend ? 'players' : sort}
          />
        </FilterBar>
        {visible.items.length > 0 ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{visible.items.map(tile)}</div>
        ) : (
          <EmptyState className="border-0 bg-transparent py-8" description="Try another genre, or clear the search." icon={Compass} title="No islands match" />
        )}
        <Pager onPageChange={setPage} page={visible.page} pageSize={PAGE_SIZE} total={listed.length} />
      </Panel>
    </>
  )
}

/** Hidden counts sort last; ties keep the panel's own order. */
function compareBy(sort: SortKey) {
  return (a: IslandCard, b: IslandCard) => {
    if (sort === 'name') return a.title.localeCompare(b.title, 'en-GB', { sensitivity: 'base' })
    if (sort === 'rising') return (b.delta1h ?? -Infinity) - (a.delta1h ?? -Infinity) || 0
    return (b.ccu ?? -1) - (a.ccu ?? -1)
  }
}

function Watching({
  onOpen,
  panels,
  watchlist,
}: {
  onOpen: (island: IslandRef) => void
  panels: Array<IslandPanel>
  watchlist: WatchlistPayload | null
}) {
  const live = useMemo(() => new Map(uniqueIslands(panels).map((island) => [island.code, island])), [panels])
  const islands = watchlist?.islands ?? []

  return (
    <Panel>
      <PanelHeader
        actions={islands.length > 0 && <span className="text-xs text-muted-foreground">Checked every 10 minutes</span>}
        compact
        icon={Star}
        title="Watching"
      />
      {watchlist?.errorMessage && (
        <div className="px-4 pt-4" role="alert">
          <Callout tone="warning">{watchlist.errorMessage}</Callout>
        </div>
      )}
      {islands.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-8"
          description="Star an island to follow its player count and get notified when it gets busy."
          icon={Star}
          title="No islands watched yet"
        />
      ) : (
        <PanelBody className="py-1">
          <ul className="divide-y divide-border/40">
            {islands.map((island) => {
              const card = live.get(island.code)
              const ref: IslandRef = card ?? {
                code: island.code,
                title: island.title,
                imageUrl: island.imageUrl,
                url: islandWebUrl(island.code),
              }

              return (
                <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3" key={island.code}>
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(ref)} type="button">
                    <span className="block aspect-video w-24 shrink-0 overflow-hidden rounded-md">
                      <IslandArt src={card?.imageUrl ?? island.imageUrl} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-ui font-semibold">{island.title}</span>
                        {island.above && <Chip tone="accent">Busy</Chip>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {island.lastCheckedAt ? (
                          <>
                            <PlayerFigure ccu={island.lastPeakCcu} className="font-semibold text-foreground/85" /> players at the last 10-minute peak · checked {relativeTime(island.lastCheckedAt)}
                          </>
                        ) : (
                          'Not checked yet'
                        )}
                      </span>
                    </span>
                  </button>
                  <ThresholdPicker
                    onChange={(threshold) => updateWatchlist({ action: 'threshold', code: island.code, threshold })}
                    threshold={island.threshold}
                    title={island.title}
                  />
                  <Button
                    aria-label={`Stop watching ${island.title}`}
                    className="text-muted-foreground"
                    onClick={() => updateWatchlist({ action: 'remove', code: island.code })}
                    size="icon"
                    title="Stop watching"
                    variant="ghost"
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        </PanelBody>
      )}
    </Panel>
  )
}
