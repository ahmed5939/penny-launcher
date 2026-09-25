import type { ProfileEntry } from './model'

import { Link } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'

import { Artboard } from '../../components/items/artboard'
import { resolveItemArt } from '../../components/items/item-icon'
import { Panel, PanelHeader, ProgressBar } from '../../components/page'
import { Skeleton } from '../../components/ui/skeleton'

import { useItemDatabaseStore } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'

import { fortStats } from '../../config/constants/fortnite/fort'

import { useProfileResource } from './load'

/**
 * The commander, as a profile opens: who leads the equipped loadout, Power,
 * and the four F.O.R.T. bars. The home screen's way into
 * the Profile page.
 */
export function CommanderCard() {
  const resource = useProfileResource()
  const entry = resource.data

  return (
    <Panel>
      <PanelHeader
        actions={
          <Link className="text-xs font-medium text-primary hover:underline" to="/stw-operations/profile">
            Profile →
          </Link>
        }
        compact
        icon={UserRound}
        title="Commander"
      />

      {entry ? (
        <CommanderBody entry={entry} />
      ) : resource.error ? (
        <p className="px-4 py-3 text-xs text-muted-foreground" role="alert">
          {resource.error}
        </p>
      ) : !resource.accountId ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">Sign in to an account to see its commander.</p>
      ) : (
        <div className="flex gap-3 p-4" role="status">
          <span className="sr-only">Loading…</span>
          <Skeleton className="size-24 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      )}
    </Panel>
  )
}

function CommanderBody({ entry }: { entry: ProfileEntry }) {
  useRequestItemDatabase()
  const records = useItemDatabaseStore((state) => state.records)
  const art = entry.commander ? resolveItemArt(entry.commander.templateId, records) : null
  const fort = entry.fort
  const top = fort ? Math.max(1, ...fortStats.map((stat) => fort[stat.key])) : 1

  return (
    <div className="flex gap-3.5 p-4">
      <Artboard className="aspect-[1/1.15] w-24 shrink-0 rounded-lg" rarity={art?.rarity}>
        {art?.imgUrl && (
          <img
            alt={art.name}
            className="absolute inset-0 size-full object-cover object-top"
            decoding="async"
            src={art.largeImgUrl ?? art.imgUrl}
            title={art.name}
          />
        )}
      </Artboard>

      <div className="min-w-0 flex-1">
        <p className="truncate text-ui font-semibold">{art?.name ?? entry.displayName}</p>
        <p className="micro-label mt-0.5">
          Commander level <span className="figure text-foreground">{entry.commanderLevel || '—'}</span>
        </p>

        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="figure text-display-sm font-bold leading-none text-primary">
            {entry.power ? `${entry.power.approximate ? '≈ ' : ''}${entry.power.value.toFixed(2)}` : '—'}
          </span>
          <span className="micro-label">Power</span>
        </p>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {fortStats.map((stat) => (
            <div key={stat.key} title={`${stat.label} ${fort ? fort[stat.key].toLocaleString() : 'unavailable'}`}>
              <ProgressBar className="h-1 bg-background/70" color={stat.color} label={stat.label} total={top} value={fort?.[stat.key] ?? 0} />
              <p className="mt-1 flex items-baseline gap-1 text-2xs leading-none">
                <span className="font-bold" style={{ color: stat.color }}>{stat.label[0]}</span>
                <span className="figure text-muted-foreground">{fort ? compactFort(fort[stat.key]) : '—'}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 5,662 → "5.7K": four of them have to share a narrow card. */
function compactFort(value: number) {
  if (value <= 0) return '—'
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(value)
}
