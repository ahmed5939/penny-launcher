import { useState } from 'react'
import type { AutoExpeditionHistoryEntry } from '../../kernel/startup/auto-expeditions'
import type { Reward } from './model'

const periods = { '24 hours': 1, Week: 7, Month: 30, Year: 365, 'All time': Infinity }
const label = (id: string) => id.split(':').pop()?.replaceAll('_', ' ') ?? id
export function summarize(entries: AutoExpeditionHistoryEntry[], field: 'rewardItems' | 'recycledItems' | 'recyclingGains') {
  const totals: Record<string, number> = {}
  entries.forEach((entry) => (entry[field] ?? []).forEach((reward) => {
    totals[reward.templateId] = (totals[reward.templateId] ?? 0) + reward.quantity
  }))
  return Object.entries(totals).map(([templateId, quantity]) => ({ templateId, quantity }))
}
function Rewards({ title, items }: { title: string; items: Reward[] }) {
  return <div><p className="font-medium">{title}</p>{items.length ? items.map((r) =>
    <p key={r.templateId} title={r.templateId}>{r.quantity.toLocaleString()} × {label(r.templateId)}</p>) : <p className="text-muted-foreground">None recorded</p>}</div>
}
export function ExpeditionHistory({ history }: { history: AutoExpeditionHistoryEntry[] }) {
  const [period, setPeriod] = useState<keyof typeof periods>('Week')
  const [page, setPage] = useState(0)
  const entries = history.filter((e) => Date.parse(e.timestamp) >= Date.now() - periods[period] * 86400000)
  const collected = entries.filter((e) => e.action === 'collected')
  const exportHistory = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'expedition-history.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="space-y-3 rounded-md border border-border/60 p-3 text-xs">
    <div className="flex flex-wrap items-center gap-3">
      <strong>Expedition rewards and history</strong>
      <select className="rounded border border-border bg-background p-1" aria-label="History period" value={period} onChange={(e) => { setPeriod(e.target.value as keyof typeof periods); setPage(0) }}>
        {Object.keys(periods).map((p) => <option key={p}>{p}</option>)}
      </select>
      <button className="underline" onClick={exportHistory}>Export history</button>
    </div>
    <p>Sent {entries.filter((e) => e.action === 'started').length} · Successful {collected.filter((e) => e.success === true).length} · Unsuccessful {collected.filter((e) => e.success === false).length} · Errors {entries.filter((e) => e.action.endsWith('error') || e.recyclingError).length}</p>
    <div className="grid gap-3 md:grid-cols-3">
      <Rewards title="Received" items={summarize(collected, 'rewardItems')} />
      <Rewards title="Recycled" items={summarize(collected, 'recycledItems')} />
      <Rewards title="Gained from recycling" items={summarize(collected, 'recyclingGains')} />
    </div>
    <p className="text-muted-foreground">Tracks automatic collections on this Launcher. Older entries without quantities remain in history but are excluded from reward totals. Discord history is separate.</p>
    <div className="max-h-64 overflow-auto">
      {entries.slice().reverse().slice(page * 20, (page + 1) * 20).map((e, index) => <div className="border-t border-border/40 py-2" key={`${e.timestamp}-${index}`}>
        <p>{new Date(e.timestamp).toLocaleString()} · {e.action} · {label(e.expedition)}{e.action === 'collected' ? e.success ? ' · Successful' : ' · Unsuccessful' : ''}</p>
        {e.rewards?.length ? <p>{e.rewards.join(', ')}</p> : null}
        {e.recycledItems?.length ? <p>Recycled: {e.recycledItems.map((r) => `${r.quantity} × ${label(r.templateId)}`).join(', ')}</p> : null}
        {e.recyclingGains?.length ? <p>Recycling gains: {e.recyclingGains.map((r) => `${r.quantity} × ${label(r.templateId)}`).join(', ')}</p> : null}
        {e.error || e.recyclingError ? <p className="text-destructive">{e.error ?? e.recyclingError}</p> : null}
      </div>)}
    </div>
    <div className="flex gap-3"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={(page + 1) * 20 >= entries.length} onClick={() => setPage(page + 1)}>Next</button></div>
  </div>
}
