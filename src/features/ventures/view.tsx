import type { VentureQuest, VenturesProgress } from './model'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, Flame, Lock, Map, RefreshCw, ScrollText, Shield, Star, Target, Zap } from 'lucide-react'

import { useGetSelectedAccount } from '../../hooks/accounts'
import { useItemDatabaseStore, getItemRecord } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { chainNames, levelFloor, nextZone, ventureZones, zonesUnlocked } from './model'

import { Button } from '../../components/ui/button'
import { AnimatedNumber, Callout, Chip, EmptyState, PageHeader, Panel, PanelBody, PanelHeader, ProgressBar, Segmented } from '../../components/page'

import { cn } from '../../lib/utils'

const fortMeta = [
  { key: 'fortitude', label: 'Fortitude', color: '#ff5f4a' },
  { key: 'offense', label: 'Offense', color: '#ffb42e' },
  { key: 'resistance', label: 'Resistance', color: '#4ec9ff' },
  { key: 'technology', label: 'Tech', color: '#a97bff' },
] as const

const stateTone = { claimed: 'success', completed: 'accent', active: 'warning', 'not-started': 'neutral' } as const
const stateLabel = { claimed: 'Claimed', completed: 'Ready to claim', active: 'In progress', 'not-started': 'Not started' } as const

export function VenturesPage() {
  useRequestItemDatabase()
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null
  const records = useItemDatabaseStore((s) => s.records)

  const [data, setData] = useState<VenturesProgress | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempt, refresh] = useState(0)
  const [chain, setChain] = useState<'all' | keyof typeof chainNames>('all')
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    if (!accountId) {
      setLoading(false)
      return
    }
    setLoading(true)
    window.electronAPI
      .requestVentures(accountId)
      .then((result) => {
        if (active && result.accountId === accountId) setData(result)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load Ventures progress. Refresh to retry.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accountId, attempt])

  const current = data && data.accountId === accountId ? data : null
  const xp = current?.xp ?? null
  const unlocked = zonesUnlocked(xp)
  const next = nextZone(xp)
  const floor = levelFloor(xp)
  const prevTotal = next ? (ventureZones[ventureZones.indexOf(next) - 1]?.totalXp ?? 0) : (ventureZones[ventureZones.length - 1]?.totalXp ?? 0)

  const quests = current?.quests ?? []
  const done = quests.filter((q) => q.state === 'claimed').length
  const earned = quests.filter((q) => q.state === 'claimed').reduce((n, q) => n + q.xp, 0)
  const pending = quests.filter((q) => q.state !== 'claimed').reduce((n, q) => n + q.xp, 0)
  const visibleQuests = useMemo(
    () => quests.filter((q) => (chain === 'all' || q.chain === chain) && (showDone || q.state !== 'claimed')),
    [quests, chain, showDone]
  )
  const maxFort = current?.fort ? Math.max(1, ...Object.values(current.fort)) : 1

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button disabled={!accountId || loading} onClick={() => refresh((n) => n + 1)} variant="outline">
            <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
        description="Season XP, zone unlocks, Ventures F.O.R.T. and the five seasonal quest chains, read live from the selected account."
        icon={Map}
        section="Save the World"
        status={
          <>
            <Chip tone="accent">Beta</Chip>
            <Chip>Read-only</Chip>
          </>
        }
        title="Ventures"
      />

      {!accountId ? (
        <EmptyState description="Select an account in the title bar to read its Ventures progress." icon={Map} title="Choose an account" />
      ) : error ? (
        <div role="alert">
          <Callout title="Could not load Ventures" tone="danger">{error}</Callout>
        </div>
      ) : !current ? (
        <div role="status">
          <EmptyState description="Reading the campaign profile from Epic." icon={Map} title="Loading Ventures…" />
        </div>
      ) : (
        <>
          {/* Headline tiles — the site's StatCard, with the level bar and next-zone countdown. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HeroTile accent="#ffb42e" icon={Star} label="Season XP">
              {xp === null ? (
                <p className="mt-2 text-lg font-semibold text-muted-foreground">No Ventures XP yet</p>
              ) : (
                <>
                  <p className="figure mt-2 text-3xl font-bold leading-none"><AnimatedNumber value={xp} /></p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {current.level !== null ? <>Level <span className="figure text-foreground">{current.level}</span></> : floor !== null && floor > 0 ? <>At least level <span className="figure text-foreground">{floor}</span></> : 'Level not reported by Epic'}
                  </p>
                </>
              )}
            </HeroTile>

            <HeroTile accent="#2ed75c" icon={Map} label="Zones unlocked">
              <p className="figure mt-2 text-3xl font-bold leading-none">{unlocked ?? '—'}<span className="text-lg text-muted-foreground">/{ventureZones.length}</span></p>
              {next ? (
                <>
                  <ProgressBar className="mt-3" total={next.totalXp - prevTotal} value={(xp ?? 0) - prevTotal} />
                  <p className="mt-1.5 text-xs text-muted-foreground"><span className="figure text-foreground">{(next.totalXp - (xp ?? 0)).toLocaleString()}</span> XP to PL {next.powerLevel} · level {next.level}</p>
                </>
              ) : (
                <p className="mt-2 text-xs text-success">Every zone is open.</p>
              )}
            </HeroTile>

            <HeroTile accent="#4ec9ff" icon={ScrollText} label="Seasonal quests">
              <p className="figure mt-2 text-3xl font-bold leading-none">{done}<span className="text-lg text-muted-foreground">/{quests.length}</span></p>
              <ProgressBar className="mt-3" total={quests.length} value={done} />
              <p className="mt-1.5 text-xs text-muted-foreground"><span className="figure text-foreground">{earned.toLocaleString()}</span> XP claimed · <span className="figure text-foreground">{pending.toLocaleString()}</span> still on the table</p>
            </HeroTile>

            <HeroTile accent="#a97bff" icon={Flame} label="Ventures F.O.R.T.">
              {current.fort ? (
                <>
                  <p className="figure mt-2 text-3xl font-bold leading-none">{Object.values(current.fort).reduce((a, b) => a + b, 0).toLocaleString()}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Total across the four stats this season.</p>
                </>
              ) : (
                <p className="mt-2 text-lg font-semibold text-muted-foreground">No Ventures F.O.R.T. yet</p>
              )}
            </HeroTile>
          </div>

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
                  fortMeta.map(({ key, label, color }) => {
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
                  <Button onClick={() => setShowDone((v) => !v)} size="sm" variant="ghost">{showDone ? 'Hide claimed' : 'Show claimed'}</Button>
                </>
              }
              description="Five chains of twelve. Each step unlocks the next; XP is paid when the quest is claimed in game."
              icon={ScrollText}
              title="Seasonal quest chains"
            />
            {visibleQuests.length === 0 ? (
              <PanelBody>
                <EmptyState className="border-0 bg-transparent py-8" description={showDone ? 'No quests in this chain.' : 'Every quest in this chain has been claimed.'} icon={CheckCircle2} title={showDone ? 'Nothing here' : 'All done'} />
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
      )}
    </div>
  )
}

function HeroTile({ accent, children, icon: Icon, label }: { accent: string; children: React.ReactNode; icon: typeof Star; label: string }) {
  return (
    <div className="panel relative overflow-hidden px-4 py-3" style={{ boxShadow: `inset 3px 0 0 ${accent}`, backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${accent} 7%, transparent), transparent 45%)` }}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 shrink-0" style={{ color: accent }} />
        <span className="micro-label">{label}</span>
      </div>
      {children}
    </div>
  )
}

function QuestRow({ quest, records }: { quest: VentureQuest; records: ReturnType<typeof useItemDatabaseStore.getState>['records'] }) {
  const record = getItemRecord(records, quest.templateId)
  const objectives = (record?.objectives ?? []).map((o) => ({ ...o, completed: quest.objectives.find((c) => c.backendName === o.backendName)?.completed ?? 0 }))
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
        {quest.state === 'active' && objectives.length > 0 && (
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
