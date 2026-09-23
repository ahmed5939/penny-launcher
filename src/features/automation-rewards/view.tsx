import type { RecycleLevel, RewardsStatus, RewardEvent } from './model'
import type { Reward } from '../expeditions/model'

import { useEffect, useMemo, useState } from 'react'
import { Download, Gift, Recycle, Sparkles, Trash2 } from 'lucide-react'

import { recycleLevels, rewardTotals } from './model'
import resources from '../../data/resources.json'
import ingredients from '../../data/ingredients.json'

import { Button } from '../../components/ui/button'
import { Callout, Chip, EmptyState, FieldRow, FilterBar, PageHeader, Pager, Panel, PanelBody, PanelHeader, Picker, StatRow, StatTile, downloadJson, paginate } from '../../components/page'
import type { PickerOption } from '../../components/page'

const PAGE_SIZE = 20

/**
 * The recycling ceiling, worded so the destructive direction is unmissable:
 * each option names everything it will recycle, not just a rarity.
 */
export const recycleCeilingOptions: ReadonlyArray<PickerOption<RecycleLevel>> = recycleLevels.map((level) => ({
  value: level,
  label: level === 'off' ? 'Off — keep everything' : level === 'Common' ? 'Common only' : `${level} and below`,
}))

/** One control for "recycle new rewards at or below", used by Auto Llamas and Auto Expeditions alike. */
export function RecycleCeilingPicker({ disabled, onChange, value }: { disabled?: boolean; onChange: (level: RecycleLevel) => void; value: RecycleLevel }) {
  return <Picker className="min-w-48" disabled={disabled} label="Recycle new rewards at or below" onChange={onChange} options={recycleCeilingOptions} value={value} />
}

export function LlamaRecycleSetting({ accountId }: { accountId: string }) {
  const [level, setLevel] = useState<RecycleLevel>('off')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  useEffect(() => {
    let live = true
    window.electronAPI.getAutomationRewards()
      .then((s) => { if (live) setLevel(s.llamaRecycling[accountId] ?? 'off') })
      .catch(() => { if (live) setError('Could not load recycling settings.') })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [accountId])
  const update = async (next: RecycleLevel) => {
    setBusy(true)
    setError('')
    try {
      const s = await window.electronAPI.updateLlamaRecycling(accountId, next)
      setLevel(s.llamaRecycling[accountId] ?? 'off')
    } catch {
      setError('Could not save recycling settings.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <FieldRow
      className="py-2.5"
      hint={
        <>
          Free and survivor llamas. Favourites, assigned items, Legendary and Mythic rewards are always kept. Totals appear under Automate → Recycled Rewards.
          {error && <span className="mt-1 block text-destructive" role="alert">{error}</span>}
        </>
      }
      label="Recycle new llama rewards"
    >
      <RecycleCeilingPicker disabled={busy} onChange={(next) => void update(next)} value={level} />
    </FieldRow>
  )
}

export const periods = { '24 hours': 1, Week: 7, Month: 30, Year: 365, 'All time': Infinity } as const
export type Period = keyof typeof periods
export const periodOptions: ReadonlyArray<PickerOption<Period>> = (Object.keys(periods) as Array<Period>).map((p) => ({ value: p, label: p === '24 hours' ? 'Last 24 hours' : p === 'All time' ? 'All time' : `Last ${p.toLowerCase()}` }))
export const withinPeriod = (timestamp: string, period: Period) => Date.parse(timestamp) >= Date.now() - periods[period] * 86_400_000

export function rewardName(id: string) {
  const key = id.split(':').pop() ?? id
  const known = ({ ...resources, ...ingredients } as Record<string, { name: string }>)[key]
  return known?.name ?? key.replaceAll('_', ' ')
}

/** A titled list of item → quantity. Used for received, recycled and gained totals everywhere. */
export function RewardTotals({ empty = 'None recorded for these filters.', icon, items, title }: { empty?: string; icon: typeof Gift; items: Reward[]; title: string }) {
  return (
    <Panel>
      <PanelHeader compact icon={icon} title={title} actions={<span className="micro-label">{items.reduce((n, r) => n + r.quantity, 0).toLocaleString()}</span>} />
      {items.length ? (
        <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto">
          {items.map((r) => (
            <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm" key={r.templateId} title={r.templateId}>
              <span className="min-w-0 truncate">{rewardName(r.templateId)}</span>
              <span className="figure shrink-0">{r.quantity.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </Panel>
  )
}

const statusTone = { received: 'neutral', complete: 'success', recycling: 'warning', error: 'danger' } as const
const statusLabel = { received: 'Received', complete: 'Complete', recycling: 'Unconfirmed', error: 'Error' } as const

export function RewardsView() {
  const [data, setData] = useState<RewardsStatus>({ accounts: [], llamaRecycling: {}, events: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState('all')
  const [source, setSource] = useState<'all' | 'llamas' | 'expeditions'>('all')
  const [period, setPeriod] = useState<Period>('Week')
  const [page, setPage] = useState(0)

  /* Local history across every account, so this is not an account resource; it polls because automations write to it in the background. */
  useEffect(() => {
    let live = true
    const refresh = () => window.electronAPI.getAutomationRewards()
      .then((s) => { if (live) { setData(s); setError('') } })
      .catch(() => { if (live) setError('Could not load reward history. Try reopening this page.') })
      .finally(() => { if (live) setLoading(false) })
    void refresh()
    const timer = setInterval(refresh, 10_000)
    return () => { live = false; clearInterval(timer) }
  }, [])

  const events = useMemo(
    () => data.events.filter((e) => (account === 'all' || e.accountId === account) && (source === 'all' || e.source === source) && withinPeriod(e.timestamp, period)),
    [data, account, source, period]
  )
  const received = rewardTotals(events, 'received')
  const recycled = rewardTotals(events, 'recycled')
  const gained = rewardTotals(events, 'resources')
  const sum = (items: Reward[]) => items.reduce((n, r) => n + r.quantity, 0)
  const accountName = (id: string) => data.accounts.find((a) => a.accountId === id)?.name ?? id
  const shown = paginate(events, page, PAGE_SIZE)
  const quantities = (e: RewardEvent, field: 'received' | 'recycled' | 'resources') => e[field].map((r) => `${r.quantity.toLocaleString()} × ${rewardName(r.templateId)}`).join(', ') || 'None'
  const breakdown = data.accounts.filter((a) => events.some((e) => e.accountId === a.accountId))

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button disabled={!events.length} onClick={() => downloadJson('automation-rewards.json', { events, received, recycled, resources: gained })} variant="outline">
            <Download className="mr-2 size-4" />
            Export
          </Button>
        }
        description="Everything Auto Llamas and Auto Expeditions recorded on this launcher, across your accounts. Received and recycling gains are counted separately."
        icon={Trash2}
        section="Automate"
        title="Recycled Rewards"
      />

      {error && <div role="alert"><Callout title="Could not load reward history" tone="danger">{error}</Callout></div>}

      {loading ? (
        <div role="status"><EmptyState description="Reading local automation history." icon={Trash2} title="Loading reward history…" /></div>
      ) : (
        <>
          <StatRow>
            <StatTile icon={Sparkles} label="Events" value={events.length.toLocaleString()} />
            <StatTile icon={Gift} label="Items received" value={sum(received).toLocaleString()} />
            <StatTile icon={Recycle} label="Items recycled" value={sum(recycled).toLocaleString()} />
            <StatTile icon={Sparkles} label="Resources gained" tone="primary" value={sum(gained).toLocaleString()} />
          </StatRow>

          <Panel>
            <FilterBar className="border-b-0">
              <Picker label="Account" onChange={(v) => { setAccount(v); setPage(0) }} options={[{ value: 'all', label: 'All accounts' }, ...data.accounts.map((a) => ({ value: a.accountId, label: a.name }))]} value={account} />
              <Picker label="Automation" onChange={(v) => { setSource(v); setPage(0) }} options={[{ value: 'all', label: 'All automations' }, { value: 'llamas', label: 'Auto Llamas' }, { value: 'expeditions', label: 'Auto Expeditions' }]} value={source} />
              <Picker label="Period" onChange={(v) => { setPeriod(v); setPage(0) }} options={periodOptions} value={period} />
            </FilterBar>
          </Panel>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <RewardTotals icon={Gift} items={received} title="Received" />
            <RewardTotals icon={Recycle} items={recycled} title="Recycled" />
            <RewardTotals icon={Sparkles} items={gained} title="Gained from recycling" />
          </div>

          {breakdown.length > 1 && (
            <Panel>
              <PanelHeader compact title="By account" />
              <PanelBody className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left">
                      <th className="micro-label px-5 py-2.5 font-semibold">Account</th>
                      <th className="micro-label px-4 py-2.5 text-right font-semibold">Received</th>
                      <th className="micro-label px-4 py-2.5 text-right font-semibold">Recycled</th>
                      <th className="micro-label px-5 py-2.5 text-right font-semibold">Resources gained</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {breakdown.map((a) => {
                      const own = events.filter((e) => e.accountId === a.accountId)
                      return (
                        <tr className="hover:bg-muted/30" key={a.accountId}>
                          <td className="px-5 py-2.5 font-medium">{a.name}</td>
                          <td className="figure px-4 py-2.5 text-right">{sum(rewardTotals(own, 'received')).toLocaleString()}</td>
                          <td className="figure px-4 py-2.5 text-right">{sum(rewardTotals(own, 'recycled')).toLocaleString()}</td>
                          <td className="figure px-5 py-2.5 text-right">{sum(rewardTotals(own, 'resources')).toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader actions={<span className="micro-label">{events.length.toLocaleString()} events</span>} description="Newest first. Open an entry for its item list." title="History" />
            {events.length === 0 ? (
              <PanelBody>
                <EmptyState className="border-0 bg-transparent py-8" description="Nothing has been recorded for these filters yet." icon={Trash2} title="No rewards recorded" />
              </PanelBody>
            ) : (
              <ul className="divide-y divide-border/50">
                {shown.items.map((e) => (
                  <li key={e.id}>
                    <details className="group px-5 py-3">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-medium">{accountName(e.accountId)}</span>
                        <Chip>{e.source === 'llamas' ? 'Auto Llamas' : 'Auto Expeditions'}</Chip>
                        <Chip tone={statusTone[e.status]}>{statusLabel[e.status]}</Chip>
                        <span className="ml-auto text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
                      </summary>
                      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[8rem_1fr]">
                        <dt className="text-muted-foreground">What</dt><dd>{rewardName(e.description)}</dd>
                        <dt className="text-muted-foreground">Received</dt><dd>{quantities(e, 'received')}</dd>
                        <dt className="text-muted-foreground">Recycled</dt><dd>{quantities(e, 'recycled')}</dd>
                        <dt className="text-muted-foreground">Gained</dt><dd>{quantities(e, 'resources')}</dd>
                      </dl>
                      {e.error && <p className="mt-2 text-xs text-destructive">{e.error}</p>}
                      {e.status === 'recycling' && <p className="mt-2 text-xs text-warning">Recycling was submitted but confirmation was interrupted. Counts are unverified, and it will not be retried automatically.</p>}
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={events.length} />
          </Panel>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Received totals include items later recycled. History starts when tracking was enabled in this build; older expedition history is included where quantities were recorded. Discord and manual actions are not imported.
          </p>
        </>
      )}
    </div>
  )
}
