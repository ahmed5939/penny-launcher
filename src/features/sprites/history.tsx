import type {
  SpriteEvent,
  SpriteEventKind,
} from '../../kernel/core/sprite-history-model'
import type { PickerOption, SegmentedOption } from '../../components/page'

import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { History, Radar } from 'lucide-react'

import { describeRelic } from '../../kernel/core/sprite-history-model'
import { useSpriteHistoryStore } from '../../state/management/sprite-history'
import { useGetAccounts, useGetSelectedAccount } from '../../hooks/accounts'

import {
  EmptyState,
  FieldGroup,
  FieldRow,
  Pager,
  Panel,
  PanelBody,
  PanelHeader,
  Picker,
  Segmented,
  paginate,
} from '../../components/page'
import { Switch } from '../../components/ui/switch'

import { SpriteArt } from './sprite-art'

import { cn, parseCustomDisplayName } from '../../lib/utils'

type Scope = 'account' | 'all'

const scopeOptions: Array<SegmentedOption<Scope>> = [
  { label: 'This account', value: 'account' },
  { label: 'All accounts', value: 'all' },
]

const intervalOptions: Array<PickerOption> = [
  { value: '15', label: 'Every 15 minutes' },
  { value: '30', label: 'Every 30 minutes' },
  { value: '60', label: 'Every hour' },
  { value: '120', label: 'Every 2 hours' },
  { value: '360', label: 'Every 6 hours' },
]

const verbs: Record<SpriteEventKind, string> = {
  secured: 'Secured',
  recovered: 'Recovered',
  lost: 'Lost',
  mastered: 'Mastered',
  equipped: 'Equipped',
}

/** Read batches per page. */
const pageSize = 15

/**
 * What changed in the sprite collections, read by read.
 *
 * Epic keeps no history of this, so the log starts the first time Penny
 * reads an account and grows each time it reads one again — by hand, by an
 * all-accounts sweep, or by the watch below.
 */
export function HistoryTab() {
  const payload = useSpriteHistoryStore((state) => state.payload)
  const setWatch = useSpriteHistoryStore((state) => state.setWatch)
  const { selected } = useGetSelectedAccount()
  const { accountList } = useGetAccounts()
  const [scope, setScope] = useState<Scope>('account')
  const [page, setPage] = useState(0)

  const effectiveScope: Scope = selected ? scope : 'all'

  const batches = useMemo(() => {
    const events = (payload?.events ?? []).filter(
      (event) =>
        effectiveScope === 'all' || event.accountId === selected?.accountId
    )
    const grouped = new Map<string, Array<SpriteEvent>>()

    events.forEach((event) => {
      const list = grouped.get(event.batchId) ?? []

      list.push(event)
      grouped.set(event.batchId, list)
    })

    return [...grouped.values()]
  }, [payload, effectiveScope, selected?.accountId])

  const shown = paginate(batches, page, pageSize)
  const watch = payload?.watch ?? null
  const interval = String(watch?.intervalMinutes ?? 30)
  const options = intervalOptions.some((option) => option.value === interval)
    ? intervalOptions
    : [...intervalOptions, { value: interval, label: `Every ${interval} minutes` }]

  const accountName = (accountId: string) => {
    const account = accountList[accountId]

    return account ? parseCustomDisplayName(account) : 'Unlinked account'
  }

  return (
    <>
      <Panel>
        <PanelHeader
          compact
          icon={Radar}
          title="Watch for changes"
        />
        <PanelBody>
          <FieldGroup>
            <FieldRow
              hint="Penny reads each linked account in the background, one after another, and sends a Windows notification when one secures, recovers, loses or masters a sprite. Off by default."
              label="Watch for changes"
            >
              <Switch
                aria-label="Watch for changes"
                checked={watch?.enabled ?? false}
                disabled={!watch}
                onCheckedChange={(enabled) =>
                  setWatch(enabled, Number(interval))
                }
              />
            </FieldRow>
            <FieldRow
              hint="Each check reads every linked account, so more often means more requests to Epic."
              label="How often"
            >
              <Picker
                disabled={!watch?.enabled}
                label="How often to check"
                onChange={(value) => setWatch(true, Number(value))}
                options={options}
                value={interval}
              />
            </FieldRow>
          </FieldGroup>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          actions={
            selected ? (
              <Segmented
                onChange={(value) => {
                  setScope(value)
                  setPage(0)
                }}
                options={scopeOptions}
                value={scope}
              />
            ) : null
          }
          compact
          icon={History}
          title="History"
        />
        {shown.items.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-8"
            description={
              payload === null
                ? 'Loading the change log…'
                : 'Penny compares each read of an account with the one before. Changes show up here from the second read onwards.'
            }
            icon={History}
            title={payload === null ? 'Loading' : 'No changes yet'}
          />
        ) : (
          <ol className="divide-y divide-border/30">
            {shown.items.map((batch) => (
              <BatchRow
                account={
                  effectiveScope === 'all' ? accountName(batch[0].accountId) : null
                }
                batch={batch}
                key={batch[0].batchId}
              />
            ))}
          </ol>
        )}
        <Pager
          onPageChange={setPage}
          page={shown.page}
          pageSize={pageSize}
          total={batches.length}
        />
      </Panel>
    </>
  )
}

/** One read's changes: when, whose, the dust change, then each event. */
function BatchRow({
  account,
  batch,
}: {
  account: string | null
  batch: Array<SpriteEvent>
}) {
  const [first] = batch
  const dust = first.dustDelta

  return (
    <li className="px-5 py-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
        {account && (
          <span className="font-semibold text-foreground">{account}</span>
        )}
        <time
          dateTime={first.at}
          title={dayjs(first.at).format('ddd D MMM YYYY, HH:mm')}
        >
          {dayjs(first.at).fromNow()}
        </time>
        {dust !== null && dust !== 0 && (
          <span className={cn('figure', dust > 0 ? 'text-success' : 'text-warning')}>
            {dust > 0 ? '+' : '−'}
            {Math.abs(dust).toLocaleString()} Sprite Dust
          </span>
        )}
      </p>
      <ul className="mt-2 space-y-1.5">
        {batch.map((event) => (
          <EventLine
            event={event}
            key={event.id}
          />
        ))}
      </ul>
    </li>
  )
}

function EventLine({ event }: { event: SpriteEvent }) {
  const relic = describeRelic(event.relicId)
  const replaced =
    event.kind === 'equipped' && event.previousRelicId
      ? describeRelic(event.previousRelicId).name
      : null

  return (
    <li className="flex items-center gap-3 text-ui">
      <SpriteArt
        iconFile={relic.iconFile}
        rarity={relic.rarity}
        size="sm"
      />
      <span className="min-w-0">
        <span
          className={cn(
            event.kind === 'lost' && 'text-warning',
            event.kind === 'recovered' && 'text-success'
          )}
        >
          {verbs[event.kind]}
        </span>{' '}
        <span className="font-semibold">{relic.name}</span>
        {replaced && (
          <span className="text-muted-foreground">{` in place of ${replaced}`}</span>
        )}
      </span>
    </li>
  )
}
