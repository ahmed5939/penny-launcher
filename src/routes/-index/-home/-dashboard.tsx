import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ExpeditionSlot, ExpeditionsEntry } from '../../../kernel/core/expeditions'
import type { QuestsPayload } from '../../../kernel/core/quests'
import type { ItemRecordMap } from '../../../state/items/database'
import type { AccountResource } from '../../../components/page'

import { Link } from '@tanstack/react-router'
import { Compass, ScrollText } from 'lucide-react'
import { useMemo } from 'react'

import {
  Callout,
  Chip,
  EmptyState,
  ListRow,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
} from '../../../components/page'
import { Skeleton } from '../../../components/ui/skeleton'
import { ItemIcon } from '../../../components/items/item-icon'
import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/utils'

import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { getItemRecord, useItemDatabaseStore } from '../../../state/items/database'
import { useGetSelectedAccount } from '../../../hooks/accounts'
import { relativeTime } from '../../../lib/dates'
import { HomeHero } from '../-hero'
import { CommanderCard } from '../../../features/commander-profile/commander-card'

import {
  useAutoExpeditionsStatus,
  useDailyRerollStatus,
  useHomeExpeditions,
  useHomeQuests,
  useMinuteClock,
} from './-dashboard-hooks'
import {
  formatCountdown,
  isDailyQuest,
  msUntilDailyReset,
  summariseExpeditions,
} from './-dashboard-model'

/**
 * "How is the selected account doing today?" — the account-bound reads the
 * tool pages already make, summarised, each linking to its full page.
 */
/**
 * Home for the selected account: the launcher hero with today's numbers,
 * then what to play (alert rewards, dailies) beside what is running
 * (expeditions, automation, the install). Season news lives on Timeline and
 * the rewards feed on Recycled rewards; Home only carries what you act on.
 */
export function HomeDashboard({ main, side }: { main: ReactNode; side: ReactNode }) {
  const { selected } = useGetSelectedAccount()

  if (!selected) {
    return (
      <>
        <HomeHero />
        {main}
      </>
    )
  }

  return <Dashboard key={selected.accountId} main={main} side={side} />
}

function Dashboard({ main, side }: { main: ReactNode; side: ReactNode }) {
  useRequestItemDatabase()
  const records = useItemDatabaseStore((state) => state.records)
  const now = useMinuteClock()

  const quests = useHomeQuests()
  const expeditions = useHomeExpeditions()

  const dailies = useMemo(() => (quests.data ? dailyQuests(quests.data, records) : null), [quests.data, records])
  const summary = useMemo(() => (expeditions.data ? summariseExpeditions(expeditions.data.slots) : null), [expeditions.data])

  return (
    <>
      <HomeHero
        today={{
          dailies: dailies ? { done: dailies.filter((quest) => quest.done).length, total: dailies.length } : null,
          expeditionsReady: summary ? summary.ready : null,
          resetIn: formatCountdown(msUntilDailyReset(now)),
        }}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {main}
          <DailyQuestsPanel dailies={dailies} records={records} resource={quests} />
        </div>
        <div className="min-w-0 space-y-6">
          <CommanderCard />
          <ExpeditionsPanel now={now} resource={expeditions} />
          {side}
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ tiles */

function OpenLink({ children, to }: { children: ReactNode; to: string }) {
  return (
    <Link className="text-xs font-medium text-primary hover:underline" to={to}>
      {children} →
    </Link>
  )
}

function PanelShell({ actions, children, icon, title }: { actions?: ReactNode; children: ReactNode; icon: LucideIcon; title: string }) {
  return (
    <Panel>
      <PanelHeader actions={actions} compact icon={icon} title={title} />
      {children}
    </Panel>
  )
}

function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 px-4 py-3" role="status">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton className="h-8 w-full" key={index} />
      ))}
    </div>
  )
}

function PanelError({ children }: { children: ReactNode }) {
  return (
    <div className="p-3" role="alert">
      <Callout tone="danger">{children}</Callout>
    </div>
  )
}

/** A one-line status strip at the bottom of a panel: what the automation for this is doing. */
function AutomationLine({ children, to }: { children: ReactNode; to: string }) {
  return (
    <p className="flex items-center gap-2 border-t border-border/60 bg-surface/60 px-4 py-2 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <OpenLink to={to}>Settings</OpenLink>
    </p>
  )
}

type DailyQuest = {
  itemId: string
  templateId: string
  rewards: Array<{ item: string; quantity: number }>
  name: string
  objective: string | null
  completed: number
  count: number
  done: boolean
  /** 0–1. */
  progress: number
}

function prettify(templateId: string) {
  return (templateId.split(':').pop() ?? templateId).replace(/^daily_/i, '').replace(/_/g, ' ')
}

function dailyQuests(payload: QuestsPayload, records: ItemRecordMap): Array<DailyQuest> {
  return payload.quests.flatMap((quest) => {
    const record = getItemRecord(records, quest.templateId)
    if (quest.state !== 'Active' || !isDailyQuest(quest.templateId, record?.category)) return []

    const progress = new Map(quest.objectives.map((objective) => [objective.backendName.toLowerCase(), objective.completed]))
    const objectives = record?.objectives.length
      ? record.objectives.map((objective) => ({ description: objective.description?.trim() || null, completed: progress.get(objective.backendName.toLowerCase()) ?? 0, count: objective.count }))
      : quest.objectives.map((objective) => ({ description: null, completed: objective.completed, count: 0 }))
    const count = objectives.reduce((n, objective) => n + objective.count, 0)
    const completed = objectives.reduce((n, objective) => n + (objective.count > 0 ? Math.min(objective.completed, objective.count) : objective.completed), 0)

    return [{
      itemId: quest.itemId,
      templateId: quest.templateId,
      rewards: record?.rewards ?? [],
      name: record?.name ?? prettify(quest.templateId),
      objective: objectives[0]?.description ?? null,
      completed,
      count,
      done: count > 0 && completed >= count,
      progress: count > 0 ? completed / count : 0,
    }]
  })
}

function DailyQuestsPanel({ dailies, records, resource }: { dailies: Array<DailyQuest> | null; records: ItemRecordMap; resource: AccountResource<QuestsPayload> }) {
  const reroll = useDailyRerollStatus()
  const config = resource.accountId ? reroll.data?.accounts[resource.accountId] : undefined

  return (
    <PanelShell actions={<OpenLink to="/stw-operations/quests">Quest log</OpenLink>} icon={ScrollText} title="Daily quests">
      {!dailies ? (
        resource.error ? <PanelError>{resource.error}</PanelError> : <RowsSkeleton />
      ) : dailies.length === 0 ? (
        <EmptyState className="border-0 bg-transparent py-6" description="Every daily is claimed. The next one arrives at 00:00 UTC." title="No daily quests in the log" />
      ) : (
        /*
         * One card per daily, drawn the way the quest log draws a quest: the
         * game's quest icon, the objective, a progress bar and the reward art.
         */
        <ul className="grid gap-px bg-border/40 sm:grid-cols-3">
          {dailies.map((quest) => (
            <li className="flex flex-col gap-2.5 bg-card p-4" key={quest.itemId}>
              <div className="flex items-start gap-3">
                <ItemIcon records={records} size="large" templateId={quest.templateId} />
                <div className="min-w-0 flex-1">
                  <p className="text-ui font-semibold leading-snug">{quest.name}</p>
                  {quest.objective && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{quest.objective}</p>}
                </div>
              </div>
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between text-xs">
                  {quest.done ? <Chip tone="success">Done</Chip> : <span className="text-muted-foreground">Progress</span>}
                  <span className="figure font-semibold">{quest.count > 0 ? `${quest.completed.toLocaleString()} / ${quest.count.toLocaleString()}` : quest.completed.toLocaleString()}</span>
                </div>
                {quest.count > 0 && <ProgressBar total={quest.count} value={Math.min(quest.completed, quest.count)} />}
                {quest.rewards.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 pt-0.5">
                    {quest.rewards.slice(0, 4).map((reward) => (
                      <li className="figure flex items-center gap-1 rounded-md bg-muted/50 py-0.5 pl-0.5 pr-2 text-xs" key={reward.item}>
                        <ItemIcon records={records} size="small" templateId={reward.item} />
                        {reward.quantity.toLocaleString()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AutomationLine to="/stw-operations/auto-daily-reroll">
        {reroll.error
          ? 'Auto daily reroll status unavailable.'
          : !config?.enabled
            ? 'Auto daily reroll is off for this account.'
            : `Auto daily reroll on${config.lastResult ? ` · ${config.lastResult}` : ''}${config.lastActivity ? ` · ${relativeTime(config.lastActivity)}` : ''}`}
      </AutomationLine>
    </PanelShell>
  )
}

function expeditionOrder(slot: ExpeditionSlot) {
  if (slot.state === 'ready') return 0
  return slot.endTime ? Date.parse(slot.endTime) : Infinity
}

function ExpeditionsPanel({ now, resource }: { now: number; resource: AccountResource<ExpeditionsEntry> }) {
  const auto = useAutoExpeditionsStatus()
  const config = resource.accountId ? auto.data?.[resource.accountId] : undefined
  const slots = useMemo(
    () => (resource.data?.slots ?? []).filter((slot) => slot.state !== 'available').sort((a, b) => expeditionOrder(a) - expeditionOrder(b)),
    [resource.data]
  )
  const summary = resource.data ? summariseExpeditions(resource.data.slots) : null

  return (
    <PanelShell actions={<OpenLink to="/stw-operations/expeditions">Expeditions</OpenLink>} icon={Compass} title="Expeditions">
      {!summary ? (
        resource.error ? <PanelError>{resource.error}</PanelError> : <RowsSkeleton />
      ) : (
        <>
          {/*
            One line that says what to do, in the tone it deserves, instead
            of three bare counters: collect first, then send, then wait.
          */}
          <PanelBody className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className={cn('text-ui font-semibold', summary.ready > 0 ? 'text-success' : summary.available > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {summary.ready > 0
                  ? `${summary.ready} back and ready to collect`
                  : summary.available > 0
                    ? `${summary.available} ready to send`
                    : 'Every slot is busy'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {summary.inFlight} out{summary.nextReturn?.endTime ? ` · next back in ${formatCountdown(Date.parse(summary.nextReturn.endTime) - now)}` : ''}
              </p>
            </div>
            {(summary.ready > 0 || summary.available > 0) && (
              <Button asChild size="sm" variant={summary.ready > 0 ? 'default' : 'secondary'}>
                <Link to="/stw-operations/expeditions">{summary.ready > 0 ? 'Collect' : 'Send'}</Link>
              </Button>
            )}
          </PanelBody>
          {slots.length === 0 ? (
            null
          ) : (
            <ul className="divide-y divide-border/60 border-t border-border/60 px-4 py-1">
              {slots.slice(0, 4).map((slot) => (
                <ListRow
                  caption={`${slot.vehicle} · tier ${slot.tier} · ${Math.round(slot.successChance * 100)}% success`}
                  figure={slot.state === 'ready' || !slot.endTime ? <Chip tone="success">Ready</Chip> : formatCountdown(Date.parse(slot.endTime) - now)}
                  key={slot.itemId}
                  name={slot.name}
                />
              ))}
            </ul>
          )}
        </>
      )}
      <AutomationLine to="/stw-operations/expeditions">
        {auto.error
          ? 'Auto expeditions status unavailable.'
          : !config?.enabled
            ? 'Auto expeditions is off for this account.'
            : config.lastError
              ? `Auto expeditions on · last error: ${config.lastError}`
              : `Auto expeditions on${config.nextRunAt ? ` · next run ${relativeTime(config.nextRunAt)}` : ''}${config.lastActivity ? ` · last ${relativeTime(config.lastActivity)}` : ''}`}
      </AutomationLine>
    </PanelShell>
  )
}
