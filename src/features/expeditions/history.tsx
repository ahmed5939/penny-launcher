import type { AutoExpeditionHistoryEntry } from '../../kernel/startup/auto-expeditions'
import type { Period } from '../automation-rewards/view'

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Download } from 'lucide-react'

import { periodOptions, rewardName, withinPeriod } from '../automation-rewards/view'

import { Button } from '../../components/ui/button'
import { Chip, FilterBar, Pager, Panel, PanelHeader, Picker, downloadJson, paginate } from '../../components/page'

const PAGE_SIZE = 20

const actionLabel: Record<AutoExpeditionHistoryEntry['action'], string> = {
  started: 'Sent',
  collected: 'Collected',
  'start-error': 'Could not send',
  'collect-error': 'Could not collect',
}

export function ExpeditionHistory({ history }: { history: AutoExpeditionHistoryEntry[] }) {
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
        title="Expedition history"
      />
      <FilterBar>
        <Picker label="History period" onChange={(v) => { setPeriod(v); setPage(0) }} options={periodOptions} value={period} />
        <span className="text-xs text-muted-foreground">
          Sent <span className="figure text-foreground">{entries.filter((e) => e.action === 'started').length}</span>
          {' · '}Successful <span className="figure text-foreground">{collected.filter((e) => e.success === true).length}</span>
          {' · '}Unsuccessful <span className="figure text-foreground">{collected.filter((e) => e.success === false).length}</span>
          {' · '}Errors <span className={errors ? 'figure text-destructive' : 'figure text-foreground'}>{errors}</span>
        </span>
      </FilterBar>

      <p className="px-4 py-2.5 text-xs text-muted-foreground">
        Received, recycled and gained totals for every automation are on{' '}
        <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/stw-operations/recycled-rewards">
          Recycled Rewards
        </Link>
        .
      </p>

      {newestFirst.length > 0 && (
        <ul className="max-h-80 divide-y divide-border/50 overflow-y-auto border-t border-border/60">
          {shown.items.map((e, index) => (
            <li className="px-4 py-2.5 text-xs" key={`${e.timestamp}-${index}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Chip tone={e.action.endsWith('error') ? 'danger' : e.action === 'collected' ? (e.success ? 'success' : 'warning') : 'neutral'}>
                  {e.action === 'collected' ? (e.success ? 'Successful' : 'Unsuccessful') : actionLabel[e.action]}
                </Chip>
                <span className="font-medium">{rewardName(e.expedition)}</span>
                <span className="ml-auto text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
              </div>
              {e.rewardItems?.length ? <p className="mt-1 text-muted-foreground">{e.rewardItems.map((r) => `${r.quantity.toLocaleString()} × ${rewardName(r.templateId)}`).join(', ')}</p> : e.rewards?.length ? <p className="mt-1 text-muted-foreground">{e.rewards.join(', ')}</p> : null}
              {e.recycledItems?.length ? <p className="mt-1 text-muted-foreground">Recycled: {e.recycledItems.map((r) => `${r.quantity} × ${rewardName(r.templateId)}`).join(', ')}</p> : null}
              {e.recyclingGains?.length ? <p className="mt-1 text-muted-foreground">Gained: {e.recyclingGains.map((r) => `${r.quantity} × ${rewardName(r.templateId)}`).join(', ')}</p> : null}
              {e.error || e.recyclingError ? <p className="mt-1 text-destructive">{e.error ?? e.recyclingError}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={newestFirst.length} />

      <p className="border-t border-border/60 px-4 py-2.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
        Automatic sends and collections on this launcher only. Discord history is separate.
      </p>
    </Panel>
  )
}
