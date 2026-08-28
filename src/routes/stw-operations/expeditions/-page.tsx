import type { ExpeditionActionNotification, ExpeditionSlot } from '../../../kernel/core/expeditions'

import { UpdateIcon } from '@radix-ui/react-icons'
import { CheckCheck, Clock3, Compass, Play, ShieldAlert, Timer, Users, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import { Button } from '../../../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import { Callout, EmptyState, PageHeader, Panel, StatRow, StatTile, StatusPill } from '../../../components/page'
import { useExpeditionsData } from './-hooks'
import { useGetAccounts } from '../../../hooks/accounts'
import { parseCustomDisplayName } from '../../../lib/utils'

type BoardItem = { accountId: string; accountName: string; slot: ExpeditionSlot }

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Compass}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.expeditions')}
        description="Refresh offers, build an eligible hero team, dispatch expeditions, and collect rewards."
      />
      <ExpeditionBoard />
    </>
  )
}

function ExpeditionBoard() {
  const {
    data, handleAction, handleCollect, handleLoad, isCollecting,
    isDisabledCollect, isDisabledForm, isLoading, pending, scopeCount,
    totalAvailable, totalInFlight, totalReady,
  } = useExpeditionsData()
  const { accountList } = useGetAccounts()
  const items: Array<BoardItem> = data.flatMap((entry) => {
    const account = accountList[entry.accountId]
    return entry.slots.map((slot) => ({
      accountId: entry.accountId,
      accountName: account ? parseCustomDisplayName(account) : entry.accountId,
      slot,
    }))
  })
  const errors = data.filter((entry) => entry.errorMessage)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <p className="mr-auto text-xs text-muted-foreground">
          {scopeCount} selected {scopeCount === 1 ? 'account' : 'accounts'}
        </p>
        <Button variant="secondary" onClick={handleLoad} disabled={isDisabledForm}>
          <UpdateIcon className={isLoading ? 'animate-spin' : ''} /> Refresh board
        </Button>
        <Button onClick={handleCollect} disabled={isDisabledCollect}>
          {isCollecting ? <UpdateIcon className="animate-spin" /> : <CheckCheck className="size-4" />}
          Collect all ready ({totalReady})
        </Button>
      </div>

      <StatRow className="lg:grid-cols-3">
        <StatTile icon={Play} label="Available" value={totalAvailable} />
        <StatTile icon={Timer} label="In flight" value={totalInFlight} />
        <StatTile icon={CheckCheck} label="Ready" tone={totalReady > 0 ? 'success' : 'default'} value={totalReady} />
      </StatRow>

      {errors.map((entry) => (
        <Callout key={entry.accountId} title={accountList[entry.accountId] ? parseCustomDisplayName(accountList[entry.accountId]) : entry.accountId} tone="warning">
          {entry.errorMessage}
        </Callout>
      ))}

      <Tabs defaultValue="available">
        <TabsList className="grid h-11 w-full grid-cols-3">
          <TabsTrigger value="available">Available ({totalAvailable})</TabsTrigger>
          <TabsTrigger value="in-flight">In flight ({totalInFlight})</TabsTrigger>
          <TabsTrigger value="ready">Ready ({totalReady})</TabsTrigger>
        </TabsList>
        <BoardTab state="available" items={items} pending={pending} onAction={handleAction} />
        <BoardTab state="in-flight" items={items} pending={pending} onAction={handleAction} />
        <BoardTab state="ready" items={items} pending={pending} onAction={handleAction} />
      </Tabs>
    </>
  )
}

function BoardTab({ items, onAction, pending, state }: {
  items: Array<BoardItem>
  onAction: (accountId: string, slot: ExpeditionSlot, action: ExpeditionActionNotification['action']) => void
  pending: Array<string>
  state: ExpeditionSlot['state']
}) {
  const visible = items.filter((item) => item.slot.state === state)

  return (
    <TabsContent value={state} className="mt-3">
      {visible.length === 0 ? (
        <EmptyState
          icon={state === 'ready' ? CheckCheck : state === 'in-flight' ? Timer : Compass}
          title={`No ${state === 'in-flight' ? 'running' : state} expeditions`}
          description={state === 'available' ? 'Refresh the board to ask Epic for current expedition offers.' : 'Nothing needs attention here.'}
        />
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-border/50">
            {visible.map((item) => (
              <ExpeditionRow item={item} key={`${item.accountId}-${item.slot.itemId}`} pending={pending.includes(item.slot.itemId)} onAction={onAction} />
            ))}
          </ul>
        </Panel>
      )}
    </TabsContent>
  )
}

function ExpeditionRow({ item, onAction, pending }: {
  item: BoardItem
  onAction: (accountId: string, slot: ExpeditionSlot, action: ExpeditionActionNotification['action']) => void
  pending: boolean
}) {
  const { accountId, accountName, slot } = item
  const hasTeam = Boolean(slot.squadId) && slot.criteria.length > 0 && slot.suggestedHeroIds.length === slot.criteria.length

  return (
    <li className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{slot.name}</p>
          <StatusPill tone={slot.state === 'ready' ? 'active' : slot.state === 'in-flight' ? 'warning' : 'idle'}>
            {slot.state === 'in-flight' ? 'In flight' : slot.state}
          </StatusPill>
          {slot.tier > 0 && <span className="text-xs text-muted-foreground">Tier {slot.tier}</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{accountName} · {slot.vehicle} · {slot.duration}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slot.criteria.map((criterion, index) => (
            <span key={`${criterion.rarity}-${criterion.type}-${index}`} className="rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-[0.65rem] text-muted-foreground">
              {criterion.rarity} {criterion.type || 'Hero'}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        {slot.maxTargetPower > 0 && <p className="flex items-center gap-2"><ShieldAlert className="size-3.5" /> Target power {slot.minTargetPower}–{slot.maxTargetPower}</p>}
        {slot.state === 'available' && <p className="flex items-center gap-2"><Users className="size-3.5" /> Team found {slot.suggestedHeroIds.length}/{slot.criteria.length}</p>}
        {slot.state === 'in-flight' && <p className="flex items-center gap-2"><Clock3 className="size-3.5" /> Completes {dayjs(slot.endTime).fromNow()}</p>}
        {slot.state === 'in-flight' && slot.successChance > 0 && <p>{Math.round(slot.successChance * 100)}% success chance</p>}
        {slot.state === 'available' && slot.expiresAt && <p>Offer expires {dayjs(slot.expiresAt).fromNow()}</p>}
      </div>

      <div className="flex justify-end">
        {pending ? (
          <Button disabled><UpdateIcon className="animate-spin" /> Working</Button>
        ) : slot.state === 'available' ? (
          <Button disabled={!hasTeam} title={hasTeam ? 'Dispatch recommended heroes' : 'No usable squad or complete eligible team'} onClick={() => onAction(accountId, slot, 'start')}>
            <Play className="size-4" /> Dispatch
          </Button>
        ) : slot.state === 'ready' ? (
          <Button onClick={() => onAction(accountId, slot, 'collect')}><CheckCheck className="size-4" /> Collect</Button>
        ) : (
          <Button variant="ghost" className="text-destructive" onClick={() => onAction(accountId, slot, 'abandon')}><XCircle className="size-4" /> Abandon</Button>
        )}
      </div>
    </li>
  )
}
