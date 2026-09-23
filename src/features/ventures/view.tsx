import type { VentureQuest, VenturesProgress } from './model'

import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, Flame, Lock, Map, ScrollText, Shield, Star, Target, Zap } from 'lucide-react'

import { useItemDatabaseStore, getItemRecord } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { chainNames, levelFloor, nextZone, ventureObjectiveProgress, ventureSeasonNames, ventureZones, zonesUnlocked } from './model'
import { fortStats } from '../../config/constants/fortnite/fort'
import { raritiesColor, RarityType } from '../../config/constants/resources'

import { Button } from '../../components/ui/button'
import { AccountResourceGate, AnimatedNumber, Chip, EmptyState, PageHeader, Panel, PanelBody, PanelHeader, ProgressBar, RefreshButton, Segmented, StatRow, StatTile, ToolBadges, useAccountResource } from '../../components/page'

import { cn } from '../../lib/utils'

const stateTone = { claimed: 'success', completed: 'accent', active: 'warning', 'not-started': 'neutral' } as const
const stateLabel = { claimed: 'Completed', completed: 'Ready to claim', active: 'In progress', 'not-started': 'Not started' } as const

export function VenturesPage() {
  useRequestItemDatabase()
  const resource = useAccountResource((accountId) => window.electronAPI.requestVentures(accountId), {
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
  const [showDone, setShowDone] = useState(true)
  const xp = current.xp
  const unlocked = zonesUnlocked(xp)
  const next = nextZone(xp)
  const floor = levelFloor(xp)
  const prevTotal = next ? (ventureZones[ventureZones.indexOf(next) - 1]?.totalXp ?? 0) : (ventureZones[ventureZones.length - 1]?.totalXp ?? 0)

  const quests = current.quests
  const done = quests.filter((q) => q.state === 'claimed').length
  const earned = quests.filter((q) => q.state === 'claimed').reduce((n, q) => n + q.xp, 0)
  const pending = quests.filter((q) => q.state !== 'claimed').reduce((n, q) => n + q.xp, 0)
  const visibleQuests = useMemo(
    () => quests.filter((q) => (chain === 'all' || q.chain === chain) && (showDone || q.state !== 'claimed')),
    [quests, chain, showDone]
  )
  const maxFort = current.fort ? Math.max(1, ...Object.values(current.fort)) : 1

  return (
    <>
          <StatRow>
            <StatTile
              accent={raritiesColor[RarityType.Legendary]}
              hint={xp === null ? undefined : current.level !== null ? <>Level <span className="figure text-foreground">{current.level}</span></> : floor !== null && floor > 0 ? <>At least level <span className="figure text-foreground">{floor}</span></> : 'Level not reported by Epic'}
              icon={Star}
              label="Season XP"
              value={xp === null ? <span className="text-base text-muted-foreground">None yet</span> : <AnimatedNumber value={xp} />}
            />
            <StatTile
              hint={next ? <><span className="figure text-foreground">{(next.totalXp - (xp ?? 0)).toLocaleString()}</span> XP to PL {next.powerLevel} · level {next.level}</> : 'Every zone is open.'}
              icon={Map}
              label="Zones unlocked"
              tone={next ? 'default' : 'success'}
              value={<>{unlocked ?? '—'}<span className="text-sm text-muted-foreground">/{ventureZones.length}</span></>}
            >
              {next && <ProgressBar className="mt-2.5" total={next.totalXp - prevTotal} value={(xp ?? 0) - prevTotal} />}
            </StatTile>
            <StatTile
              hint={<><span className="figure text-foreground">{earned.toLocaleString()}</span> XP claimed · <span className="figure text-foreground">{pending.toLocaleString()}</span> left</>}
              icon={ScrollText}
              label="Seasonal quests"
              value={current.season ? <>{done}<span className="text-sm text-muted-foreground">/{quests.length}</span></> : '—'}
            >
              <ProgressBar className="mt-2.5" total={quests.length} value={done} />
            </StatTile>
            <StatTile
              hint={current.fort ? 'Across the four stats this season.' : undefined}
              icon={Flame}
              label="Ventures F.O.R.T."
              value={current.fort ? Object.values(current.fort).reduce((a, b) => a + b, 0).toLocaleString() : <span className="text-base text-muted-foreground">None yet</span>}
            />
          </StatRow>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
            {/* Zone ladder — the site's "Zone Unlocks" strip. */}
            <Panel>
              <PanelHeader description="Each zone opens at a Ventures level; the XP shown is the season total that level needs." icon={Map} title="Zone unlocks" />
              <PanelBody>
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {ventureZones.map((zone, index) => {
                    const open = xp !== null && xp >= zone.totalXp
                    const isNext = next?.level === zone.level
                    return (
                      <li
                        className={cn('relative overflow-hidden rounded-lg border px-3 py-2.5', open ? 'border-success/40 bg-success/5' : isNext ? 'border-primary/40 bg-primary/5' : 'border-border/60 opacity-60')}
                        key={zone.level}
                      >
                        <span aria-hidden className={cn('absolute inset-x-0 top-0 h-0.5', open ? 'bg-success' : isNext ? 'bg-primary' : 'bg-border')} />
                        <div className="flex items-center justify-between gap-2">
                          <span className="micro-label">Zone {index + 1} · Lv {zone.level}</span>
                          {open ? <CheckCircle2 className="size-3.5 text-success" /> : <Lock className="size-3.5 text-muted-foreground" />}
                        </div>
                        <p className={cn('figure mt-1 text-lg font-bold leading-none', open ? 'text-success' : isNext ? 'text-primary' : '')}>PL {zone.powerLevel}</p>
                        <p className="micro-label mt-1.5"><span className="figure">{zone.totalXp.toLocaleString()}</span> XP</p>
                      </li>
                    )
                  })}
                </ol>
              </PanelBody>
            </Panel>

            {/* F.O.R.T. bars. */}
            <Panel>
              <PanelHeader description="Ventures survivors and research, separate from the main campaign." icon={Shield} title="Ventures F.O.R.T." />
              <PanelBody className="space-y-2">
                {current.fort ? (
                  fortStats.map(({ key, label, color }) => {
                    const value = current.fort![key]
                    return (
                      <div className="rounded-lg border border-border/60 px-3 py-2" key={key} style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="micro-label" style={{ color }}>{label}</span>
                          <span className="figure text-sm font-semibold" style={{ color }}>{value.toLocaleString()}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/70" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={maxFort}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / maxFort) * 100)}%`, background: color }} />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">This account has no Ventures F.O.R.T. stats in its profile yet.</p>
                )}
              </PanelBody>
            </Panel>
          </div>

          {/* Quest chains. */}
          <Panel>
            <PanelHeader
              actions={
                <>
                  <Segmented onChange={setChain} options={[{ value: 'all', label: 'All' }, ...Object.entries(chainNames).map(([value, label]) => ({ value: value as keyof typeof chainNames, label }))]} value={chain} />
                  <Button onClick={() => setShowDone((v) => !v)} size="sm" variant="ghost">{showDone ? 'Hide completed' : 'Show completed'}</Button>
                </>
              }
              description="Five chains of twelve for the season most recently recorded in this account’s quests. Includes claimed quests and live progress."
              icon={ScrollText}
              title={current.season ? `${ventureSeasonNames[current.season]} quest chains` : 'Seasonal quest chains'}
            />
            {visibleQuests.length === 0 ? (
              <PanelBody>
                <EmptyState className="border-0 bg-transparent py-8" description={!current.season ? 'No seasonal Ventures quests were returned in this campaign profile. Play Ventures and refresh to load your quest progress.' : showDone ? 'No quests in this chain.' : 'Every quest in this chain has been claimed.'} icon={ScrollText} title={!current.season ? 'No seasonal quest data' : showDone ? 'Nothing here' : 'All done'} />
              </PanelBody>
            ) : (
              <ul className="divide-y divide-border/50">
                {visibleQuests.map((q) => <QuestRow key={q.templateId} quest={q} records={records} />)}
              </ul>
            )}
          </Panel>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Zone thresholds come from player-collected level totals and may drift by a hotfix; the level itself is only shown when Epic reports it. Quest XP is from the bundled reward table. Nothing here claims, rerolls or spends.
          </p>
    </>
  )
}

function QuestRow({ quest, records }: { quest: VentureQuest; records: ReturnType<typeof useItemDatabaseStore.getState>['records'] }) {
  const record = getItemRecord(records, quest.templateId)
  const objectives = (record?.objectives ?? []).map((o) => ({ ...o, completed: ventureObjectiveProgress(quest, o.backendName, o.count) }))
  const completedAt = quest.state === 'claimed' && quest.lastChange ? new Date(quest.lastChange) : null
  const hasCompletionDate = completedAt !== null && Number.isFinite(completedAt.getTime())
  const total = objectives.reduce((n, o) => n + o.count, 0)
  const doneCount = objectives.reduce((n, o) => n + Math.min(o.count, o.completed), 0)
  const Icon = quest.state === 'claimed' ? CheckCircle2 : quest.state === 'completed' ? Target : quest.state === 'active' ? Circle : Lock
  return (
    <li className={cn('flex items-start gap-3 px-5 py-3', quest.state === 'not-started' && 'opacity-60')}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', quest.state === 'claimed' ? 'text-success' : quest.state === 'completed' ? 'text-primary' : 'text-muted-foreground')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="micro-label">{chainNames[quest.chain] ?? quest.chain} · {quest.step}/12</span>
          <span className="text-sm font-semibold">{record?.name ?? quest.templateId.replace('Quest:', '')}</span>
          <Chip tone={stateTone[quest.state]}>{stateLabel[quest.state]}</Chip>
        </div>
        {record?.description && <p className="mt-0.5 text-xs text-muted-foreground">{record.description}</p>}
        {hasCompletionDate && (
          <p className="mt-1 text-xs text-success">Completed <time dateTime={quest.lastChange!}>{completedAt.toLocaleDateString()}</time></p>
        )}
        {quest.state !== 'not-started' && objectives.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {objectives.map((o) => (
              <div key={o.backendName}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{o.description ?? o.backendName}</span>
                  <span className="figure shrink-0">{Math.min(o.count, o.completed)}/{o.count}</span>
                </div>
                <ProgressBar className="mt-1" total={o.count} value={o.completed} />
              </div>
            ))}
          </div>
        )}
        {quest.state === 'active' && objectives.length === 0 && quest.objectives.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">Progress counters: {quest.objectives.map((o) => `${o.backendName} ${o.completed}`).join(' · ')}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="flex items-center justify-end gap-1 text-sm font-semibold"><Zap className="size-3 text-muted-foreground" /><span className="figure">{quest.xp.toLocaleString()}</span></p>
        <p className="micro-label">XP{quest.state === 'active' && total > 0 ? ` · ${Math.round((doneCount / total) * 100)}%` : ''}</p>
      </div>
    </li>
  )
}
