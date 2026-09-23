import type { QuestHistory, StormShield, Zone, ZoneProgress } from './model'

import { useMemo, useState } from 'react'
import { CheckCircle2, History, Shield } from 'lucide-react'

import { useItemDatabaseStore, getItemRecord } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { recentActivity, stormShields, zoneProgress, zones } from './model'

import stonewoodArt from '../../../assets/images/zones/stonewood.webp'
import plankertonArt from '../../../assets/images/zones/plankerton.webp'
import cannyValleyArt from '../../../assets/images/zones/canny-valley.webp'
import twinePeaksArt from '../../../assets/images/zones/twine-peaks.webp'

import { AccountResourceGate, Chip, EmptyState, IconWell, PageHeader, PageTabPanel, PageTabs, Pager, Panel, PanelHeader, ProgressBar, RefreshButton, ToolBadges, paginate, useAccountResource } from '../../components/page'

import { cn } from '../../lib/utils'

const PAGE_SIZE = 20

/** Zone backdrops, bundled so the page never reaches out to a website. */
const zoneArt: Record<Zone, string> = {
  Stonewood: stonewoodArt,
  Plankerton: plankertonArt,
  'Canny Valley': cannyValleyArt,
  'Twine Peaks': twinePeaksArt,
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

  return (
    <>
      <section className="space-y-4" aria-labelledby="ssd-heading">
        <SectionTitle eyebrow="Base fortifications" id="ssd-heading" title="Storm Shield Defences" trailing={<Chip tone={defended === 40 ? 'success' : 'neutral'}>{defended}/40 defended</Chip>} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {shields.map((shield) => <ShieldCard key={shield.zone} shield={shield} />)}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="zones-heading">
        <SectionTitle eyebrow="Storyline" id="zones-heading" title="Zone quest progression" />
        <PageTabs label="Zones" onValueChange={setZone} tabs={zones.map((z) => ({ value: z, label: z }))} value={zone}>
          {progress.map((p) => (
            <PageTabPanel activeValue={zone} key={p.zone} value={p.zone}>
              <ZoneDetail progress={p} />
            </PageTabPanel>
          ))}
        </PageTabs>
      </section>

      <Activity activity={activity} nameOf={(id) => getItemRecord(records, id)?.name ?? null} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Dates are when Epic last changed each quest’s state, which for a finished quest is when it was done. The questline grouping is PennyDB’s list of storyline quest names; a quest the item database cannot name is shown as not done rather than guessed.
      </p>
    </>
  )
}

function SectionTitle({ eyebrow, id, title, trailing }: { eyebrow: string; id: string; title: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold leading-tight tracking-tight" id={id}>{title}</h2>
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-1 w-10 rounded-full bg-primary" />
          <span className="micro-label">{eyebrow}</span>
        </div>
      </div>
      {trailing}
    </div>
  )
}

/** The website's zone card: zone art as a wash that wakes up on hover, count pill, bar and ten pips. */
function ShieldCard({ shield }: { shield: StormShield }) {
  const pct = percent(shield.completed, 10)
  const latest = shield.levels.filter((l) => l.doneAt).map((l) => l.doneAt!).sort().pop() ?? null
  return (
    <article className="panel group relative overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
      <span aria-hidden className="absolute inset-x-0 top-0 z-[2] h-0.5 bg-primary/70" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-10 grayscale transition-all duration-700 group-hover:opacity-25 group-hover:grayscale-0"
        style={{ backgroundImage: `url(${zoneArt[shield.zone]})` }}
      />
      <div className="relative space-y-4 p-5">
        <div className="flex items-center justify-between">
          <IconWell icon={Shield} tone="accent" />
          <span className="figure rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-bold">{shield.completed}/10</span>
        </div>
        <div>
          <h3 className="text-lg font-bold leading-tight">{shield.zone}</h3>
          <p className="micro-label mt-1">{latest ? `Last defended ${day(latest)}` : 'Not started'}</p>
        </div>
        <div className="space-y-2">
          <ProgressBar total={10} value={shield.completed} />
          <div className="flex items-center justify-between">
            <span className="micro-label">Progress</span>
            <span className="figure text-xs font-bold">{pct}%</span>
          </div>
        </div>
        <ol aria-label={`${shield.zone} defences`} className="grid grid-cols-5 gap-1.5 pt-1">
          {shield.levels.map((level) => (
            <li
              className={cn('h-1.5 rounded-full transition-all', level.done ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.45)]' : 'bg-muted opacity-60')}
              key={level.level}
              title={level.done ? `SSD ${level.level} · ${day(level.doneAt) ?? 'date unknown'}` : `SSD ${level.level} · not defended`}
            />
          ))}
        </ol>
      </div>
    </article>
  )
}

function ZoneDetail({ progress }: { progress: ZoneProgress }) {
  const pct = percent(progress.questsDone, progress.questsTotal)
  const complete = progress.questsTotal > 0 && progress.questsDone === progress.questsTotal
  const days = progress.firstAt && progress.lastAt ? Math.floor((Date.parse(progress.lastAt) - Date.parse(progress.firstAt)) / 86_400_000) : null
  const levels = progress.levels.filter((l) => l.quests.length > 0)

  return (
    <div className="space-y-6">
      {/* Zone hero. */}
      <div className="panel relative overflow-hidden">
        <span aria-hidden className="absolute inset-x-0 top-0 z-[2] h-0.5 bg-primary" />
        <span aria-hidden className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url(${zoneArt[progress.zone]})` }} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/75 to-background/40" />
        <div className="relative space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="micro-label">Zone progression</p>
              <h3 className="mt-1 text-3xl font-bold leading-none tracking-tight md:text-4xl">{progress.zone}</h3>
              <p className="mt-2 text-sm text-muted-foreground">Storm Shield questline overview</p>
            </div>
            <div className="md:text-right">
              <p className="micro-label">Completion</p>
              <p className="figure text-4xl font-bold leading-none md:text-5xl">{pct}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{progress.questsDone} / {progress.questsTotal} quests</p>
            </div>
          </div>
          <ProgressBar className="h-2.5" total={progress.questsTotal} value={progress.questsDone} />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Started', value: day(progress.firstAt) ?? '—' },
              { label: 'Duration', value: days !== null && days > 0 ? `${days.toLocaleString()} days` : '—' },
              { label: complete ? 'Completed' : 'Latest', value: day(progress.lastAt) ?? '—' },
            ].map((tile) => (
              <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-center backdrop-blur-sm" key={tile.label}>
                <p className="micro-label">{tile.label}</p>
                <p className="mt-2 text-base font-semibold">{tile.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SSD levels. */}
      <div className="space-y-3">
        {levels.map((level) => {
          const doneCount = level.quests.filter((q) => q.done).length
          const ordered = [...level.quests].sort((a, b) => Number(b.done) - Number(a.done) || (a.doneAt ?? '').localeCompare(b.doneAt ?? ''))
          return (
            <article
              aria-label={`SSD ${level.level}`}
              className="panel space-y-4 p-5 transition-transform duration-200 hover:-translate-y-0.5"
              key={level.level}
              style={{ boxShadow: `inset 3px 0 0 hsl(var(${level.defence.done ? '--success' : '--border'}))` }}
            >
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="figure text-2xl font-bold leading-none">SSD {level.level}</span>
                  <span className="text-xs text-muted-foreground">{doneCount}/{level.quests.length} quests</span>
                </div>
                {level.defence.done ? (
                  <div className="text-right">
                    <p className="micro-label text-success">Defended</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{day(level.defence.doneAt) ?? 'Date unknown'}</p>
                  </div>
                ) : (
                  <Chip>Not defended</Chip>
                )}
              </header>
              <ul className="grid gap-2 md:grid-cols-2">
                {ordered.map((q) => (
                  <li
                    className={cn('flex items-start gap-3 rounded-lg border p-3 transition-colors', q.done ? 'border-primary/20 bg-primary/5' : 'border-border/50 bg-transparent')}
                    key={q.name}
                  >
                    <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border', q.done ? 'border-primary/40 bg-primary/15' : 'border-border/60')}>
                      {q.done && <span className="size-2.5 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm leading-snug', q.done ? 'font-medium' : 'text-muted-foreground')}>{q.name}</span>
                      {q.doneAt && <span className="mt-1 block text-xs text-muted-foreground">{day(q.doneAt)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function Activity({ activity, nameOf }: { activity: ReturnType<typeof recentActivity>; nameOf: (id: string) => string | null }) {
  const [page, setPage] = useState(0)
  const shown = paginate(activity, page, PAGE_SIZE)
  return (
    <Panel>
      <PanelHeader actions={<span className="micro-label">{activity.length.toLocaleString()} quests</span>} description="Every finished quest with a date, newest first." icon={History} title="Recent activity" />
      {activity.length === 0 ? (
        <EmptyState className="border-0 bg-transparent py-8" description="This account has no dated quests yet." icon={History} title="No quest history" />
      ) : (
        <ul className="divide-y divide-border/50">
          {shown.items.map((q, index) => (
            <li className="flex items-center gap-3 px-5 py-2.5 text-sm" key={`${q.templateId}-${index}`}>
              <CheckCircle2 className="size-3.5 shrink-0 text-success" />
              <span className="min-w-0 flex-1 truncate" title={q.templateId}>{nameOf(q.templateId) ?? q.templateId.replace(/^Quest:/i, '')}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{day(q.changedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={activity.length} />
    </Panel>
  )
}
