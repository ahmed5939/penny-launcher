import type { QuestHistory, StormShield, Zone, ZoneProgress } from './model'
import type { ItemRecordMap } from '../../kernel/core/item-database'

import { useMemo, useState } from 'react'
import { History, Map as MapIcon, Shield } from 'lucide-react'

import { useItemDatabaseStore, getItemRecord } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { recentActivity, stormShields, zoneProgress, zones } from './model'


import { ItemIcon } from '../../components/items/item-icon'
import { AccountResourceGate, AnimatedNumber, EmptyState, Pager, PageHeader, Panel, PanelHeader, ProgressBar, RefreshButton, Segmented, StatRow, StatTile, ToolBadges, paginate, useAccountResource, zoneArt as keyArt } from '../../components/page'

import { cn } from '../../lib/utils'

const PAGE_SIZE = 20

/** The game's zone key art, bundled so the page never reaches out to a website. */
const zoneArt: Record<Zone, string> = {
  Stonewood: keyArt.stonewood,
  Plankerton: keyArt.plankerton,
  'Canny Valley': keyArt['canny-valley'],
  'Twine Peaks': keyArt['twine-peaks'],
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null

const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0)

/**
 * Quest history — the History tab of the PennyDB profile, rebuilt natively:
 * Storm Shield Defences per zone, each zone's questline under the SSD it
 * leads to, and every finished quest. Read live from the selected account's
 * campaign profile.
 */
export function QuestHistoryPage() {
  useRequestItemDatabase()
  const resource = useAccountResource((accountId) => window.electronAPI.requestQuestHistory(accountId), {
    cacheKey: 'stw.quest-history',
    fallbackError: 'Could not load quest history. Refresh to retry.',
    owner: (result) => result.accountId,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<RefreshButton disabled={!resource.accountId} loading={resource.loading} onClick={resource.refresh} />}
        description="Storm Shield Defences, the storyline quests of every zone and when you finished them — read live from the selected account."
        icon={History}
        section="Account"
        status={<ToolBadges readOnly />}
        title="History"
      />
      <AccountResourceGate icon={History} loading={{ title: 'Loading quest history…', description: 'Reading the campaign profile from Epic.' }} resource={resource} what="quest history">
        {(data) => <HistoryBody data={data} key={data.accountId} />}
      </AccountResourceGate>
    </div>
  )
}

function HistoryBody({ data }: { data: QuestHistory }) {
  const records = useItemDatabaseStore((s) => s.records)
  const shields = useMemo(() => stormShields(data), [data])
  const progress = useMemo(() => zoneProgress(data, (id) => getItemRecord(records, id)?.name), [data, records])
  const activity = useMemo(() => recentActivity(data), [data])
  const [zone, setZone] = useState<Zone>(() => shields.find((s) => s.completed < 10)?.zone ?? 'Stonewood')
  const defended = shields.reduce((n, s) => n + s.completed, 0)
  const storyDone = progress.reduce((n, p) => n + p.questsDone, 0)
  const storyTotal = progress.reduce((n, p) => n + p.questsTotal, 0)
  const firstAt = progress.map((p) => p.firstAt).filter((d): d is string => Boolean(d)).sort()[0] ?? null
  const selected = progress.find((p) => p.zone === zone) ?? progress[0]

  return (
    <>
      <StatRow>
        <StatTile label="Storm Shields defended" tone={defended === 40 ? 'success' : 'primary'} value={<><AnimatedNumber value={defended} /><span className="text-sm text-muted-foreground">/40</span></>}>
          <ProgressBar className="mt-2.5" total={40} value={defended} />
        </StatTile>
        <StatTile label="Storyline quests" value={<>{storyDone.toLocaleString()}<span className="text-sm text-muted-foreground">/{storyTotal.toLocaleString()}</span></>}>
          <ProgressBar className="mt-2.5" total={storyTotal} value={storyDone} />
        </StatTile>
        <StatTile label="Quests finished" value={activity.length.toLocaleString()} />
        <StatTile label="Playing since" value={<span className="text-base">{day(firstAt) ?? '—'}</span>} />
      </StatRow>

      <Panel>
        <PanelHeader compact icon={Shield} title="Storm Shield Defences" />
        <div className="grid gap-px bg-border/30 sm:grid-cols-2 xl:grid-cols-4">
          {shields.map((shield) => <ShieldCard key={shield.zone} onSelect={() => setZone(shield.zone)} selected={shield.zone === zone} shield={shield} />)}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          actions={<Segmented onChange={setZone} options={zones.map((z) => ({ value: z, label: z }))} value={zone} />}
          compact
          icon={MapIcon}
          title="Zone questline"
        />
        {selected && <ZoneDetail progress={selected} records={records} />}
      </Panel>

      <Activity activity={activity} nameOf={(id) => getItemRecord(records, id)?.name ?? null} records={records} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Dates are when Epic last changed each quest’s state, which for a finished quest is when it was done. The questline grouping is PennyDB’s list of storyline quest names; a quest the item database cannot name is shown as not done rather than guessed.
      </p>
    </>
  )
}

/** One zone's shield: its key art, the count, and ten pips — one per defence. Picking it opens that zone's questline below. */
function ShieldCard({ onSelect, selected, shield }: { onSelect: () => void; selected: boolean; shield: StormShield }) {
  const latest = shield.levels.filter((l) => l.doneAt).map((l) => l.doneAt!).sort().pop() ?? null
  const complete = shield.completed === 10
  return (
    <button
      aria-pressed={selected}
      className={cn('group relative flex flex-col bg-card text-left transition-colors hover:bg-muted/40', selected && 'bg-primary/[0.06]')}
      onClick={onSelect}
      type="button"
    >
      <span className="relative block h-20 overflow-hidden">
        <img alt="" className="size-full object-cover opacity-80 transition-opacity group-hover:opacity-100" src={zoneArt[shield.zone]} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <span className="absolute inset-x-4 bottom-2 flex items-end justify-between gap-2">
          <span className="text-title font-bold leading-tight">{shield.zone}</span>
          <span className={cn('figure text-xl font-bold leading-none', complete ? 'text-success' : 'text-foreground')}>{shield.completed}<span className="text-xs text-muted-foreground">/10</span></span>
        </span>
      </span>
      <span className="block space-y-2 px-4 pb-3.5 pt-2">
        <ol aria-label={`${shield.zone} defences`} className="grid grid-cols-10 gap-1">
          {shield.levels.map((level) => (
            <li
              className={cn('h-1.5 rounded-full', level.done ? (complete ? 'bg-success' : 'bg-primary') : 'bg-muted')}
              key={level.level}
              title={level.done ? `SSD ${level.level} · ${day(level.doneAt) ?? 'date unknown'}` : `SSD ${level.level} · not defended`}
            />
          ))}
        </ol>
        <span className="block text-xs text-muted-foreground">{latest ? `Last defended ${day(latest)}` : 'Not started'}</span>
      </span>
      {selected && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
    </button>
  )
}

function ZoneDetail({ progress, records }: { progress: ZoneProgress; records: ItemRecordMap }) {
  const pct = percent(progress.questsDone, progress.questsTotal)
  const complete = progress.questsTotal > 0 && progress.questsDone === progress.questsTotal
  const days = progress.firstAt && progress.lastAt ? Math.floor((Date.parse(progress.lastAt) - Date.parse(progress.firstAt)) / 86_400_000) : null
  const levels = progress.levels.filter((l) => l.quests.length > 0)

  return (
    <>
      {/* The zone's key art behind its completion, the way the game's map screen introduces a zone. */}
      <div className="relative overflow-hidden">
        <img alt="" className="absolute inset-0 size-full object-cover opacity-50" src={zoneArt[progress.zone]} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-card/20" />
        <div className="relative flex flex-wrap items-end gap-x-10 gap-y-3 px-5 py-5">
          <div className="min-w-40">
            <p className="text-display font-bold leading-none tracking-tight">{progress.zone}</p>
            <p className="figure mt-2 text-sm text-muted-foreground"><span className={cn('font-bold', complete ? 'text-success' : 'text-foreground')}>{pct}%</span> · {progress.questsDone} / {progress.questsTotal} quests</p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {[
              { label: 'Started', value: day(progress.firstAt) ?? '—' },
              { label: 'Took', value: days !== null && days > 0 ? `${days.toLocaleString()} days` : '—' },
              { label: complete ? 'Finished' : 'Latest', value: day(progress.lastAt) ?? '—' },
            ].map((fact) => (
              <div key={fact.label}>
                <dt className="micro-label">{fact.label}</dt>
                <dd className="mt-1 font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <ProgressBar className="basis-full" total={progress.questsTotal} value={progress.questsDone} />
        </div>
      </div>

      {/* One row per defence: the quests that lead to it, then the defence itself. */}
      <ol className="divide-y divide-border/50 border-t border-border/50">
        {levels.map((level) => {
          const doneCount = level.quests.filter((q) => q.done).length
          return (
            <li aria-label={`SSD ${level.level}`} className="grid gap-3 px-5 py-3.5 md:grid-cols-[8rem_minmax(0,1fr)]" key={level.level}>
              <div>
                <p className={cn('figure text-lg font-bold leading-none', level.defence.done ? 'text-success' : 'text-foreground')}>SSD {level.level}</p>
                <p className="mt-1 text-xs text-muted-foreground">{level.defence.done ? `Defended ${day(level.defence.doneAt) ?? ''}`.trim() : 'Not defended'}</p>
                <p className="figure mt-0.5 text-xs text-muted-foreground">{doneCount}/{level.quests.length} quests</p>
              </div>
              <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                {level.quests.map((q) => (
                  <li className="flex items-center gap-2.5" key={q.name}>
                    <ItemIcon className={cn(!q.done && 'opacity-40 grayscale')} records={records} templateId={q.templateId ?? 'Quest:unknown'} title={q.name} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-ui leading-tight', q.done ? 'font-medium' : 'text-muted-foreground')}>{q.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{q.done ? day(q.doneAt) ?? 'Done' : 'Not done'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
    </>
  )
}

function Activity({ activity, nameOf, records }: { activity: ReturnType<typeof recentActivity>; nameOf: (id: string) => string | null; records: ItemRecordMap }) {
  const [page, setPage] = useState(0)
  const shown = paginate(activity, page, PAGE_SIZE)
  return (
    <Panel>
      <PanelHeader actions={<span className="text-xs text-muted-foreground"><span className="figure">{activity.length.toLocaleString()}</span> quests</span>} compact icon={History} title="Recently finished" />
      {activity.length === 0 ? (
        <EmptyState className="border-0 bg-transparent py-8" description="This account has no dated quests yet." icon={History} title="No quest history" />
      ) : (
        <ul className="grid divide-border/50 md:grid-cols-2">
          {shown.items.map((q, index) => {
            const name = nameOf(q.templateId)
            return (
              <li className="flex items-center gap-3 border-b border-border/50 px-4 py-2 md:odd:border-r" key={`${q.templateId}-${index}`}>
                <ItemIcon records={records} size="small" templateId={q.templateId} title={name ?? 'Unnamed quest'} />
                <span className={cn('min-w-0 flex-1 truncate text-ui', !name && 'text-muted-foreground')}>{name ?? 'Unnamed quest'}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{day(q.changedAt)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={activity.length} />
    </Panel>
  )
}
