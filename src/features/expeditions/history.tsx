import type { AutoExpeditionHistoryEntry } from '../../kernel/startup/auto-expeditions'
import type { Period } from '../automation-rewards/view'
import type { Reward } from './model'
import type { ItemRecordMap } from '../../state/items/database'

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Download, Plane, Sailboat, Truck } from 'lucide-react'

import { periodOptions, rewardName, withinPeriod } from '../automation-rewards/view'
import { expeditionKind } from './model'

import { Button } from '../../components/ui/button'
import { ItemIcon, itemBadge } from '../../components/items/item-icon'
import { Chip, EmptyState, FilterBar, Pager, Panel, PanelHeader, Picker, downloadJson, paginate } from '../../components/page'
import { useItemDatabaseStore } from '../../state/items/database'
import { assets } from '../../lib/repository'
import { cn } from '../../lib/utils'

const PAGE_SIZE = 20

/*
 * Expeditions have no art of their own in the item database, so each kind
 * borrows the game's art for what it brings back: a survivor voucher for
 * survivor runs, the trap voucher for trap runs, a material for supply runs.
 */
const kindArt: Record<string, string> = {
  'Survivor Scouting': 'voucher_generic_worker',
  'Lead Survivors': 'voucher_generic_manager',
  'People Run': 'voucher_generic_worker',
  Heroes: 'voucher_generic_hero',
  'Trap Run': 'voucher_generic_trap',
  Traps: 'voucher_generic_trap',
  Weapons: 'voucher_generic_ranged',
  'Supply Run': 'reagent_c_t01',
  'Crafting Run': 'mechanical_parts_t02',
  'Building Resources': 'metalitemdata',
  'Ore Mining': 'ore_copper',
  'Wood Gathering': 'wooditemdata',
}

/** The art for an auto-expeditions reward category (Survivors, Heroes…). */
export const categoryArt: Record<string, string> = {
  Survivors: 'voucher_generic_worker',
  Heroes: 'voucher_generic_hero',
  Traps: 'voucher_generic_trap',
  Weapons: 'voucher_generic_ranged',
  Materials: 'mechanical_parts_t02',
}

const vehicleIcon = { Air: Plane, Land: Truck, Sea: Sailboat } as const

function vehicleOf(templateId: string) {
  const body = templateId.toLowerCase()
  return body.includes('_sea_') ? 'Sea' : body.includes('_air_') ? 'Air' : 'Land'
}

/** "Supply Run · Sea · tier 4" from `Expedition:expedition_sea_supplyrun_long_t04`, never the id in words. */
export function expeditionLabel(templateId: string) {
  const tier = /_t(\d+)/i.exec(templateId)?.[1]
  return {
    name: expeditionKind(templateId).name,
    detail: [vehicleOf(templateId), tier && `tier ${Number(tier)}`].filter(Boolean).join(' · '),
  }
}

/**
 * An expedition drawn the way the game draws one: the reward's art on a
 * tile, with the vehicle stamped in the corner.
 */
export function ExpeditionArt({ className, size = 'default', templateId }: { className?: string; size?: 'small' | 'default' | 'large'; templateId: string }) {
  const kind = expeditionKind(templateId)
  const src = assets(kindArt[kind.name] ?? categoryArt[kind.category] ?? 'quest')
  const Vehicle = vehicleIcon[vehicleOf(templateId)]
  const box = { small: 'size-7', default: 'size-9', large: 'size-12' }[size]

  return (
    <span className={cn('relative grid shrink-0 place-items-center rounded-lg bg-muted/50 ring-1 ring-inset ring-border/60', box, className)} title={kind.name}>
      {src && <img alt="" className="size-[82%] object-contain" draggable={false} src={src} />}
      {size !== 'small' && (
        <span className={cn(itemBadge, '-bottom-1 -right-1 px-0.5 py-0.5')}>
          <Vehicle aria-hidden className="size-2.5" />
        </span>
      )}
    </span>
  )
}

/** Rewards as art chips — the game's icon and a count — rather than a comma list. */
export function RewardChips({ className, items, records }: { className?: string; items: Reward[]; records: ItemRecordMap }) {
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {items.map((reward) => (
        <li className="figure flex items-center gap-1 rounded-md bg-muted/50 py-0.5 pl-0.5 pr-2 text-xs" key={reward.templateId} title={rewardName(reward.templateId)}>
          <ItemIcon records={records} size="small" templateId={reward.templateId} />
          {reward.quantity.toLocaleString()}
        </li>
      ))}
    </ul>
  )
}

const actionLabel: Record<AutoExpeditionHistoryEntry['action'], string> = {
  started: 'Sent',
  collected: 'Collected',
  'start-error': 'Could not send',
  'collect-error': 'Could not collect',
}

export function ExpeditionHistory({ history, title = 'Expedition history' }: { history: AutoExpeditionHistoryEntry[]; title?: string }) {
  const records = useItemDatabaseStore((state) => state.records)
  const [period, setPeriod] = useState<Period>('Week')
  const [page, setPage] = useState(0)
  const entries = history.filter((e) => withinPeriod(e.timestamp, period))
  const collected = entries.filter((e) => e.action === 'collected')
  const newestFirst = entries.slice().reverse()
  const shown = paginate(newestFirst, page, PAGE_SIZE)
  const errors = entries.filter((e) => e.action.endsWith('error') || e.recyclingError).length

  return (
    <Panel>
      <PanelHeader
        actions={
          <Button disabled={!entries.length} onClick={() => downloadJson('expedition-history.json', entries)} size="sm" variant="ghost">
            <Download className="mr-1.5 size-3.5" />
            Export
          </Button>
        }
        compact
        title={title}
      />
      <FilterBar>
        <Picker label="History period" onChange={(v) => { setPeriod(v); setPage(0) }} options={periodOptions} value={period} />
        <span className="text-xs text-muted-foreground">
          Sent <span className="figure text-foreground">{entries.filter((e) => e.action === 'started').length}</span>
          {' · '}Successful <span className="figure text-success">{collected.filter((e) => e.success === true).length}</span>
          {' · '}Unsuccessful <span className="figure text-foreground">{collected.filter((e) => e.success === false).length}</span>
          {' · '}Errors <span className={errors ? 'figure text-destructive' : 'figure text-foreground'}>{errors}</span>
        </span>
      </FilterBar>

      {newestFirst.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-8"
          description={history.length ? 'No automatic sends or collections in this period.' : 'Automatic sends and collections will be listed here.'}
          title="No expedition history"
        />
      ) : (
        <ul className="max-h-96 divide-y divide-border/50 overflow-y-auto">
          {shown.items.map((e, index) => {
            const label = expeditionLabel(e.expedition)
            const failed = e.action.endsWith('error')

            return (
              <li className="flex items-start gap-3 px-4 py-2.5" key={`${e.timestamp}-${index}`}>
                <ExpeditionArt templateId={e.expedition} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-ui font-medium">{label.name}</span>
                    <span className="text-xs text-muted-foreground">{label.detail}</span>
                    <Chip tone={failed ? 'danger' : e.action === 'collected' ? (e.success ? 'success' : 'warning') : 'neutral'}>
                      {e.action === 'collected' ? (e.success ? 'Successful' : 'Unsuccessful') : actionLabel[e.action]}
                    </Chip>
                    {e.recyclingError && !failed ? <Chip tone="danger">Recycling failed</Chip> : null}
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                  {e.rewardItems?.length ? (
                    <RewardChips className="mt-1.5" items={e.rewardItems} records={records} />
                  ) : e.rewards?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">{e.rewards.join(', ')}</p>
                  ) : null}
                  {e.recycledItems?.length ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      Recycled <RewardChips items={e.recycledItems} records={records} />
                    </div>
                  ) : null}
                  {e.recyclingGains?.length ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      Gained <RewardChips items={e.recyclingGains} records={records} />
                    </div>
                  ) : null}
                  {e.error || e.recyclingError ? <p className="mt-1 text-xs text-muted-foreground">{e.error ?? e.recyclingError}</p> : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={newestFirst.length} />

      <p className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
        This launcher&apos;s automatic runs only. Totals across automations are on{' '}
        <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/stw-operations/recycled-rewards">
          Recycled Rewards
        </Link>
        .
      </p>
    </Panel>
  )
}
