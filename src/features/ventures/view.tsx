import type { VentureQuest, VenturesProgress } from './model'

import { useMemo, useState } from 'react'
import { CheckCircle2, Flame, Lock, Map, ScrollText, Zap } from 'lucide-react'

import { useItemDatabaseStore, getItemRecord } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { chainNames, levelFloor, nextZone, ventureObjectiveProgress, ventureSeasonNames, ventureZones, zonesUnlocked } from './model'
import { fortStats } from '../../config/constants/fortnite/fort'
import { images } from '../../images'

import { Button } from '../../components/ui/button'
import { ItemIcon } from '../../components/items/item-icon'
import { AccountResourceGate, AnimatedNumber, Chip, EmptyState, FilterBar, PageHeader, Panel, PanelBody, PanelHeader, ProgressBar, RefreshButton, Segmented, ToolBadges, useAccountResource } from '../../components/page'

import { cn } from '../../lib/utils'
import { usePageBackdrop } from '../../components/page/page-backdrop'
import { seasonBackdrop } from '../../config/backdrops'

const stateTone = { claimed: 'success', completed: 'accent', active: 'warning', 'not-started': 'neutral' } as const
const stateLabel = { claimed: 'Completed', completed: 'Ready to claim', active: 'In progress', 'not-started': 'Not started' } as const

export function VenturesPage() {
  useRequestItemDatabase()
  const resource = useAccountResource((accountId) => window.electronAPI.requestVentures(accountId), {
    cacheKey: 'stw.ventures',
    fallbackError: 'Could not load Ventures progress. Refresh to retry.',
    owner: (result) => result.accountId,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        actions={<RefreshButton disabled={!resource.accountId} loading={resource.loading} onClick={resource.refresh} />}
        description="Season XP, zone unlocks, Ventures F.O.R.T. and the five seasonal quest chains, read live from the selected account."
        icon={Map}
        section="Save the World"
        status={<ToolBadges beta readOnly />}
        title="Ventures"
      />
      <AccountResourceGate icon={Map} loading={{ title: 'Loading Ventures…', description: 'Reading the campaign profile from Epic.' }} resource={resource} what="Ventures progress">
        {(data) => <Progress current={data} key={data.accountId} />}
      </AccountResourceGate>
    </div>
  )
}

function Progress({ current }: { current: VenturesProgress }) {
  const records = useItemDatabaseStore((s) => s.records)
  const [chain, setChain] = useState<'all' | keyof typeof chainNames>('all')
  const [showDone, setShowDone] = useState(false)
  usePageBackdrop(seasonBackdrop(current.season ? ventureSeasonNames[current.season] : null))
  const xp = current.xp
  const unlocked = zonesUnlocked(xp)
  const next = nextZone(xp)
  const floor = levelFloor(xp)
  const prevTotal = next ? (ventureZones[ventureZones.indexOf(next) - 1]?.totalXp ?? 0) : 0

  const quests = current.quests
  const done = quests.filter((q) => q.state === 'claimed').length
  const pending = quests.filter((q) => q.state !== 'claimed').reduce((n, q) => n + q.xp, 0)
  const chains = useMemo(
    () =>
      Object.keys(chainNames).flatMap((key) => {
        const steps = quests.filter((q) => q.chain === key)
        if (steps.length === 0) return []
        return [{ key, steps, current: steps.find((q) => q.state !== 'claimed') ?? null }]
      }),
    [quests]
  )
  const visibleQuests = useMemo(
    () => quests.filter((q) => (chain === 'all' || q.chain === chain) && (showDone || q.state !== 'claimed')),
    [quests, chain, showDone]
  )
  const fortTotal = current.fort ? Object.values(current.fort).reduce((a, b) => a + b, 0) : null

  return (
    <>
      {/* The season at a glance: XP, where it gets you next, and the ladder it climbs. */}
      <Panel>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <img alt="" className="size-12 shrink-0 object-contain" draggable={false} src={images.phoenixxp} />
            <div>
              <p className="text-xs text-muted-foreground">{current.season ? ventureSeasonNames[current.season] : 'Ventures'} · season XP</p>
              <p className="figure text-display-sm font-bold leading-tight">{xp === null ? '—' : <AnimatedNumber value={xp} />}</p>
              <p className="text-xs text-muted-foreground">
                {xp === null ? 'No Ventures XP yet' : current.level !== null ? <>Level <span className="figure text-foreground">{current.level}</span></> : floor ? <>Level <span className="figure text-foreground">{floor}</span>+</> : 'Level not reported by Epic'}
              </p>
            </div>
          </div>

          <div className="min-w-56 flex-1">
            <p className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
              {next ? (
                <>
                  <span>Next zone <span className="figure font-semibold text-primary"><Zap className="inline size-3 fill-current" />{next.powerLevel}</span> at level <span className="figure text-foreground">{next.level}</span></span>
                  <span><span className="figure text-foreground">{(next.totalXp - (xp ?? 0)).toLocaleString()}</span> XP to go</span>
                </>
              ) : (
                <span className="text-success">Every zone is open</span>
              )}
            </p>
            <ProgressBar className="mt-1.5" total={next ? next.totalXp - prevTotal : 1} value={next ? (xp ?? 0) - prevTotal : 1} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              <span className="figure text-foreground">{unlocked ?? 0}</span>/{ventureZones.length} zones · <span className="figure text-foreground">{done}</span>/{quests.length} quests · <span className="figure text-foreground">{pending.toLocaleString()}</span> quest XP left
            </p>
          </div>

          <div className="flex items-end gap-5">
            {current.fort ? (
              <>
                {fortStats.map(({ key, label, color }) => (
                  <div key={key}>
                    <p className="text-xs" style={{ color }}>{label}</p>
                    <p className="figure text-title font-semibold">{current.fort![key].toLocaleString()}</p>
                  </div>
                ))}
                <div className="border-l border-border/40 pl-5">
                  <p className="text-xs text-muted-foreground">F.O.R.T.</p>
                  <p className="figure text-title font-semibold">{fortTotal!.toLocaleString()}</p>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No Ventures F.O.R.T. yet</p>
            )}
          </div>
        </div>

        {/* Zone ladder as one track: filled up to the XP you have. */}
        <ol className="grid grid-cols-5 gap-x-1 gap-y-3 border-t border-border/30 px-5 py-3.5 lg:grid-cols-10">
          {ventureZones.map((zone, index) => {
            const open = xp !== null && xp >= zone.totalXp
            const isNext = next?.level === zone.level
            const from = ventureZones[index - 1]?.totalXp ?? 0
            const fill = open ? 100 : isNext && xp !== null ? Math.max(0, Math.min(100, ((xp - from) / (zone.totalXp - from)) * 100)) : 0
            return (
              <li key={zone.level} title={`${zone.totalXp.toLocaleString()} XP`}>
                <div className="h-1 overflow-hidden rounded-full bg-muted/70">
                  <div className={cn('h-full rounded-full', open ? 'bg-success' : 'bg-primary')} style={{ width: `${fill}%` }} />
                </div>
                <p className={cn('figure mt-1.5 flex items-center gap-1 text-ui font-semibold leading-none', open ? 'text-success' : isNext ? 'text-primary' : 'text-muted-foreground/70')}>
                  {open ? <CheckCircle2 className="size-3" /> : isNext ? <Zap className="size-3 fill-current" /> : <Lock className="size-3" />}
                  {zone.powerLevel}
                </p>
                <p className="mt-0.5 text-2xs text-muted-foreground">Lvl <span className="figure">{zone.level}</span></p>
              </li>
            )
          })}
        </ol>
      </Panel>

      {/* What you're working on: the live step of each chain. */}
      <Panel>
        <PanelHeader compact icon={Flame} title="Current quests" />
        {chains.length === 0 ? (
          <PanelBody>
            <EmptyState className="border-0 bg-transparent py-8" description="No seasonal Ventures quests in this campaign profile. Play Ventures, then refresh." icon={ScrollText} title="No seasonal quest data" />
          </PanelBody>
        ) : (
          <ul className="grid lg:grid-cols-2 2xl:grid-cols-3">
            {chains.map((c) => <ChainCard chain={c.key} current={c.current} key={c.key} records={records} steps={c.steps} />)}
          </ul>
        )}
      </Panel>

      {/* Every step, for looking ahead. Compact: the game's boilerplate descriptions add nothing. */}
      {quests.length > 0 && (
        <Panel>
          <PanelHeader
            actions={<Button onClick={() => setShowDone((v) => !v)} size="sm" variant="ghost">{showDone ? 'Hide completed' : `Show completed (${done})`}</Button>}
            compact
            icon={ScrollText}
            title="All quests"
          />
          <FilterBar>
            <Segmented onChange={setChain} options={[{ value: 'all', label: 'All chains' }, ...Object.entries(chainNames).map(([value, label]) => ({ value: value as keyof typeof chainNames, label }))]} value={chain} />
            <span className="text-xs text-muted-foreground"><span className="figure text-foreground">{visibleQuests.length}</span> shown</span>
          </FilterBar>
          {visibleQuests.length === 0 ? (
            <PanelBody>
              <EmptyState className="border-0 bg-transparent py-8" description="Every quest in this chain has been claimed." icon={ScrollText} title="All done" />
            </PanelBody>
          ) : (
            <ul className="grid md:grid-cols-2 2xl:grid-cols-3">
              {visibleQuests.map((q) => <QuestRow key={q.templateId} quest={q} records={records} />)}
            </ul>
          )}
        </Panel>
      )}

      <p className="text-xs text-muted-foreground">
        Zone thresholds are player-collected and may drift after a hotfix. F.O.R.T. is Ventures-only. Read-only: nothing here claims or spends.
      </p>
    </>
  )
}

type Records = ReturnType<typeof useItemDatabaseStore.getState>['records']

/** One chain: its live step with objectives, and how far along the chain you are. */
function ChainCard({ chain, current, records, steps }: { chain: string; current: VentureQuest | null; records: Records; steps: Array<VentureQuest> }) {
  const claimed = steps.filter((q) => q.state === 'claimed').length
  const quest = current ?? steps[steps.length - 1]
  const record = getItemRecord(records, quest.templateId)
  const objectives = (record?.objectives ?? []).map((o) => ({ ...o, completed: ventureObjectiveProgress(quest, o.backendName, o.count) }))
  const chainName = chainNames[chain] ?? 'Seasonal'
  return (
    <li className={cn('flex gap-3 border-b border-border/30 px-4 py-3.5', current?.state === 'completed' && 'bg-primary/5')}>
      <ItemIcon className={cn(!current && 'opacity-60')} records={records} size="large" templateId={quest.templateId} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{chainName} · <span className="figure text-foreground">{claimed}</span>/{steps.length}</span>
          {current ? current.state !== 'not-started' && <Chip tone={stateTone[current.state]}>{stateLabel[current.state]}</Chip> : <Chip tone="success">Chain complete</Chip>}
        </p>
        <div aria-hidden className="mt-1.5 flex gap-0.5">
          {steps.map((q) => (
            <span className={cn('h-1 flex-1 rounded-full', q.state === 'claimed' ? 'bg-success' : q === current ? 'bg-primary' : 'bg-muted/70')} key={q.templateId} />
          ))}
        </div>
        {current ? (
          <>
            <p className="mt-2 truncate text-ui font-semibold leading-tight">{record?.name ?? `${chainName} quest ${current.step}`}</p>
            {objectives.length > 0 && current.state !== 'not-started' ? (
              <ul className="mt-1.5 space-y-1.5">
                {objectives.map((o) => (
                  <li key={o.backendName}>
                    <p className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 flex-1 text-muted-foreground">{o.description ?? 'Objective'}</span>
                      <span className="figure shrink-0">{Math.min(o.count, o.completed).toLocaleString()} / {o.count.toLocaleString()}</span>
                    </p>
                    <ProgressBar className="mt-1" total={o.count} value={o.completed} />
                  </li>
                ))}
              </ul>
            ) : (
              objectives[0]?.description && <p className="mt-1 text-xs text-muted-foreground">{objectives[0].description}</p>
            )}
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <img alt="" className="size-4" draggable={false} src={images.phoenixxp} />
              <span className="figure text-foreground">{current.xp.toLocaleString()}</span> XP
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">All {steps.length} steps claimed.</p>
        )}
      </div>
    </li>
  )
}

/** A single line per quest for the full list. */
function QuestRow({ quest, records }: { quest: VentureQuest; records: Records }) {
  const record = getItemRecord(records, quest.templateId)
  const chainName = chainNames[quest.chain] ?? 'Seasonal'
  const objective = record?.objectives?.[0]?.description
  return (
    <li className="flex items-center gap-3 border-b border-border/30 px-4 py-2">
      <ItemIcon className={cn(quest.state === 'not-started' && 'opacity-50 grayscale')} records={records} size="small" templateId={quest.templateId} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-ui font-medium leading-tight', quest.state === 'not-started' && 'text-muted-foreground')}>{record?.name ?? `${chainName} quest ${quest.step}`}</p>
        <p className="truncate text-xs text-muted-foreground" title={objective}>
          {chainName} <span className="figure">{quest.step}</span>{objective && <> · {objective}</>}
        </p>
      </div>
      {quest.state === 'claimed' ? <CheckCircle2 aria-label="Completed" className="size-3.5 shrink-0 text-success" /> : quest.state !== 'not-started' && <Chip tone={stateTone[quest.state]}>{stateLabel[quest.state]}</Chip>}
      <span className="figure w-14 shrink-0 text-right text-xs text-muted-foreground">{quest.xp.toLocaleString()}</span>
    </li>
  )
}
