import type { IslandRef } from './parts'
import type { WatchedIsland } from './watchlist'

import { useEffect, useMemo } from 'react'
import { CalendarDays, ExternalLink, LineChart, Star, Tags } from 'lucide-react'

import { DetailSection } from '../../components/items/detail-parts'
import { Callout, Chip, KeyValue, Sparkline } from '../../components/page'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'

import { dayFigures, formatMinutes, formatPercent } from './metrics'
import { formatPlayers, isCreatorIslandCode } from './model'
import { IslandArt, PlayerFigure, ThresholdPicker, TrendFigure } from './parts'
import { loadMetrics, updateWatchlist, useIslandsStore } from './store'

const hourLabel = (t: string | number) =>
  new Date(t).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })

const dayLabel = (t: string) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

const figure = (value: number | null) => <span className="figure">{formatPlayers(value)}</span>

/**
 * One island: its art, its code, a way to open it on fortnite.com, watching,
 * and what Epic's ecosystem API says about it — the last day's peak players
 * as a line, and the last finished day's figures.
 */
export function IslandDialog({
  island,
  onClose,
  watched,
}: {
  island: IslandRef
  onClose: () => void
  watched: WatchedIsland | null
}) {
  const metrics = useIslandsStore((state) => state.metrics[island.code] ?? null)
  const loading = useIslandsStore((state) => Boolean(state.metricsLoading[island.code]))
  const hasFigures = isCreatorIslandCode(island.code)

  useEffect(() => {
    if (hasFigures) loadMetrics(island.code)
  }, [hasFigures, island.code])

  const day = useMemo(
    () => (metrics ? dayFigures(metrics.day, Date.parse(metrics.fetchedAt)) : null),
    [metrics]
  )
  const hourly = metrics?.hour.peakCCU ?? []
  const details = metrics?.island ?? null
  const creator = island.creator ?? details?.creatorCode
  const caption = [creator && `by ${creator}`, island.ageRating, details?.createdIn]
    .filter(Boolean)
    .join(' · ')

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <div className="relative h-56 shrink-0 overflow-hidden">
          <IslandArt src={island.heroImageUrl ?? island.imageUrl} />
          <span aria-hidden className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/70 to-transparent" />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <DialogHeader className="absolute inset-x-6 bottom-4 space-y-1 text-left sm:text-left">
            <DialogTitle className="text-display-sm font-bold leading-tight">{island.title}</DialogTitle>
            <DialogDescription className="text-ui text-foreground/80">
              {caption || (hasFigures ? 'Creator island' : 'Made by Epic')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 pb-6 pt-4">
          <dl className="grid gap-4 sm:grid-cols-3">
            <KeyValue copyable label="Island code" value={<span className="figure">{island.code}</span>} />
            {island.ccu !== undefined ? (
              <KeyValue
                label="Playing now"
                value={
                  <span className="flex items-center gap-2">
                    <PlayerFigure ccu={island.ccu} className="font-semibold" />
                    {island.delta1h !== null && island.delta1h !== undefined && island.delta1h !== 0 && <TrendFigure className="text-xs" value={island.delta1h} />}
                  </span>
                }
              />
            ) : (
              watched && <KeyValue label="Last 10-minute peak" value={figure(watched.lastPeakCcu)} />
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            {island.url && (
              <Button onClick={() => island.url && window.electronAPI.openExternalURL(island.url)} variant="outline">
                <ExternalLink className="mr-2 size-4" />
                Open on fortnite.com
              </Button>
            )}
            {hasFigures &&
              (watched ? (
                <>
                  <Button aria-pressed onClick={() => updateWatchlist({ action: 'remove', code: island.code })} title="Stop watching this island" variant="outline">
                    <Star className="mr-2 size-4 fill-current text-primary" />
                    Watching
                  </Button>
                  <ThresholdPicker
                    onChange={(threshold) => updateWatchlist({ action: 'threshold', code: island.code, threshold })}
                    threshold={watched.threshold}
                    title={island.title}
                  />
                </>
              ) : (
                <Button onClick={() => updateWatchlist({ action: 'add', code: island.code, title: island.title })} variant="outline">
                  <Star className="mr-2 size-4" />
                  Watch
                </Button>
              ))}
          </div>

          {!hasFigures && (
            <Callout tone="info">Epic doesn’t publish figures for its own modes.</Callout>
          )}

          {hasFigures && loading && !metrics && (
            <p className="text-xs text-muted-foreground" role="status">Loading figures from Epic…</p>
          )}

          {metrics?.errorMessage && (
            <div role="alert">
              <Callout tone={metrics.status === 'error' ? 'danger' : 'warning'}>{metrics.errorMessage}</Callout>
            </div>
          )}

          {hourly.some((point) => point.value !== null) && (
            <DetailSection icon={LineChart} title="Peak players, last 24 hours">
              <Sparkline
                formatTime={hourLabel}
                formatValue={(value) => formatPlayers(value)}
                label="Peak players each hour, last 24 hours"
                points={hourly}
                unit="players"
              />
            </DetailSection>
          )}

          {day && (
            <DetailSection icon={CalendarDays} title={day.partial ? 'Today so far (UTC)' : `${dayLabel(day.t)} (UTC)`}>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KeyValue label="Unique players" value={figure(day.uniquePlayers)} />
                <KeyValue label="Plays" value={figure(day.plays)} />
                <KeyValue label="Time played" value={<span className="figure">{formatMinutes(day.minutesPlayed)}</span>} />
                <KeyValue label="Favourites" value={figure(day.favorites)} />
                <KeyValue label="Peak players" value={figure(day.peakCCU)} />
                <KeyValue label="Recommendations" value={figure(day.recommendations)} />
                <KeyValue label="Day 1 retention" value={<span className="figure">{formatPercent(metrics?.retention?.d1 ?? null)}</span>} />
                <KeyValue label="Day 7 retention" value={<span className="figure">{formatPercent(metrics?.retention?.d7 ?? null)}</span>} />
              </dl>
            </DetailSection>
          )}

          {details && details.tags.length > 0 && (
            <DetailSection icon={Tags} title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {details.tags.map((tag) => (
                  <Chip key={tag}>{tag}</Chip>
                ))}
              </div>
            </DetailSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
