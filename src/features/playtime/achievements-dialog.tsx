import type { LibraryArt } from '../library/model'
import type { AchievementRow, GameAchievementsResult } from './achievements'

import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Callout, EmptyState, ProgressBar, Segmented, StatRow, StatTile } from '../../components/page'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'

import { sizedArt } from '../library/model'

import { cn } from '../../lib/utils'

/**
 * One game's Epic achievements for one account: how far along it is, then
 * every achievement — unlocked ones first, newest first, then the rest from
 * most to least common. Hidden ones stay hidden until unlocked, as on the
 * store, unless the player asks to see them.
 */

type Filter = 'all' | 'unlocked' | 'locked'

const dateFormat: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

function formatDate(iso: string | null) {
  const parsed = iso ? new Date(iso) : null

  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString(undefined, dateFormat) : null
}

function formatPercent(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

export function AchievementsDialog({
  accountId,
  game,
  onClose,
}: {
  accountId: string
  game: { art: LibraryArt; sandboxId: string; title: string | null }
  onClose: () => void
}) {
  const [result, setResult] = useState<GameAchievementsResult | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true

    setResult(null)
    window.electronAPI
      .requestGameAchievements(accountId, game.sandboxId)
      .then((value) => live && setResult(value))
      .catch(() => live && setResult({ ok: false, error: 'Could not load achievements. Try again.' }))

    return () => {
      live = false
    }
  }, [accountId, attempt, game.sandboxId])

  const title = (result?.ok ? result.data.title : null) ?? game.title ?? 'Achievements'
  const art = sizedArt(game.art.wide ?? (result?.ok ? result.data.art.wide : null), 1280, 720)

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <div className="relative h-44 shrink-0 overflow-hidden bg-muted">
          {art && (
            <img
              alt=""
              className="size-full object-cover"
              decoding="async"
              src={art}
            />
          )}
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <DialogHeader className="absolute inset-x-6 bottom-4 space-y-1 text-left sm:text-left">
            <DialogTitle className="text-display-sm font-bold leading-tight">{title}</DialogTitle>
            <DialogDescription className="text-ui text-foreground/80">
              Epic achievements on this account
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-4">
          {!result && (
            <p className="text-ui text-muted-foreground" role="status">
              Loading achievements from Epic…
            </p>
          )}

          {result && !result.ok && (
            <Callout title="Achievements unavailable" tone="danger">
              <p>{result.error}</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            </Callout>
          )}

          {result?.ok && <AchievementList data={result.data} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AchievementList({ data }: { data: Extract<GameAchievementsResult, { ok: true }>['data'] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [reveal, setReveal] = useState(false)
  const locked = data.rows.length - data.unlocked
  const hiddenLocked = data.rows.filter((row) => row.hidden && !row.unlocked).length
  const rows = useMemo(
    () =>
      data.rows.filter((row) =>
        filter === 'all' ? true : filter === 'unlocked' ? row.unlocked : !row.unlocked
      ),
    [data.rows, filter]
  )

  return (
    <>
      <StatRow>
        <StatTile label="Unlocked" value={`${data.unlocked} / ${data.total}`}>
          <ProgressBar className="mt-2" label="Achievements unlocked" total={data.total} value={data.unlocked} />
        </StatTile>
        <StatTile
          label="XP"
          value={`${data.unlockedXp.toLocaleString()} / ${data.totalXp.toLocaleString()}`}
        />
        <StatTile
          hint={
            data.platinumRarity !== null
              ? `${formatPercent(data.platinumRarity)} of players have it`
              : undefined
          }
          label="Platinum"
          tone={data.platinum ? 'success' : 'default'}
          value={data.platinum ? 'Earned' : 'Not yet'}
        />
      </StatRow>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Filter>
          options={[
            { label: `All ${data.rows.length}`, value: 'all' },
            { label: `Unlocked ${data.unlocked}`, value: 'unlocked' },
            { label: `Locked ${locked}`, value: 'locked' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {hiddenLocked > 0 && filter !== 'unlocked' && (
          <Button className="ml-auto" size="sm" variant="ghost" onClick={() => setReveal((value) => !value)}>
            {reveal ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}
            {reveal ? 'Hide spoilers' : `Show ${hiddenLocked} hidden`}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-6"
          title={filter === 'unlocked' ? 'None unlocked yet' : 'Every achievement unlocked'}
        />
      ) : (
        <ul className="divide-y divide-border/30">
          {rows.map((row) => (
            <AchievementItem key={row.name} masked={row.hidden && !row.unlocked && !reveal} row={row} />
          ))}
        </ul>
      )}
    </>
  )
}

function AchievementItem({ masked, row }: { masked: boolean; row: AchievementRow }) {
  const icon = masked ? null : row.unlocked ? row.unlockedIcon : (row.lockedIcon ?? row.unlockedIcon)
  const unlockedOn = formatDate(row.unlockedAt)
  const caption = [
    row.unlocked ? (unlockedOn ? `Unlocked ${unlockedOn}` : 'Unlocked') : null,
    row.rarity !== null ? `${formatPercent(row.rarity)} of players` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-center gap-3 py-2.5">
      {icon ? (
        <img
          alt=""
          className={cn('size-11 shrink-0 rounded-md object-cover', !row.unlocked && 'opacity-60')}
          decoding="async"
          loading="lazy"
          src={icon}
        />
      ) : (
        <span className="size-11 shrink-0 rounded-md bg-muted" />
      )}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-ui font-medium leading-tight',
            row.unlocked ? 'text-foreground' : 'text-foreground/70'
          )}
        >
          {masked ? 'Hidden achievement' : row.title}
        </span>
        <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {masked ? 'Its details stay hidden until it is unlocked.' : (row.description ?? '')}
        </span>
        {caption && <span className="mt-0.5 block text-xs text-muted-foreground/80">{caption}</span>}
      </span>

      <span className={cn('figure shrink-0 text-sm font-bold', row.unlocked ? 'text-foreground/90' : 'text-muted-foreground')}>
        {row.xp} XP
      </span>
    </li>
  )
}
