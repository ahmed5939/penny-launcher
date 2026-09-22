import { useEffect, useState } from 'react'
import { recycleLevels, rewardTotals, type RecycleLevel, type RewardsStatus, type RewardEvent } from './model'
import type { Reward } from '../expeditions/model'
import resources from '../../data/resources.json'
import ingredients from '../../data/ingredients.json'

export function LlamaRecycleSetting({ accountId }: { accountId: string }) {
  const [level, setLevel] = useState<RecycleLevel>('off')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  useEffect(() => {
    let live = true
    window.electronAPI.getAutomationRewards().then((s) => { if (live) setLevel(s.llamaRecycling[accountId] ?? 'off') }).catch(() => { if (live) setError('Could not load recycling settings') }).finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [accountId])
  const update = async (next: RecycleLevel) => {
    setBusy(true); setError('')
    try { const s = await window.electronAPI.updateLlamaRecycling(accountId, next); setLevel(s.llamaRecycling[accountId] ?? 'off') }
    catch { setError('Could not save recycling settings') }
    finally { setBusy(false) }
  }
  return <div className="space-y-2 border-t border-border/60 py-3 text-xs">
    <label className="flex flex-wrap items-center gap-3">Recycle new llama rewards at or below
      <select aria-label="Llama recycling rarity" className="rounded border border-border bg-background p-2" value={level} disabled={busy} onChange={(e) => void update(e.target.value as RecycleLevel)}>
        {recycleLevels.map((r) => <option value={r} key={r}>{r === 'off' ? 'Off' : r}</option>)}
      </select>
    </label>
    <p className="text-muted-foreground">Applies to free and survivor llamas. Favorites, assigned items, Legendary and Mythic rewards are kept. Received and recycled quantities appear under Automate → Recycled Rewards.</p>
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
  </div>
}
const periods = { '24 hours': 1, Week: 7, Month: 30, Year: 365, 'All time': Infinity }
function name(id: string) {
  const key = id.split(':').pop() ?? id
  const known = ({ ...resources, ...ingredients } as Record<string, { name: string }>)[key]
  return known?.name ?? key.replaceAll('_', ' ')
}
function Totals({ title, items }: { title: string; items: Reward[] }) {
  return <section className="rounded border border-border/60 p-3"><h3 className="mb-2 font-semibold">{title}</h3>
    {items.length ? <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Item / resource</th><th className="text-right">Quantity</th></tr></thead><tbody>{items.map((r) => <tr key={r.templateId} className="border-t border-border/40"><td className="py-2 break-all" title={r.templateId}>{name(r.templateId)}</td><td className="text-right tabular-nums">{r.quantity.toLocaleString()}</td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">None recorded for these filters.</p>}
  </section>
}
export function RewardsView() {
  const [data, setData] = useState<RewardsStatus>({ accounts: [], llamaRecycling: {}, events: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState('all')
  const [source, setSource] = useState('all')
  const [period, setPeriod] = useState<keyof typeof periods>('Week')
  const [page, setPage] = useState(0)
  useEffect(() => {
    let live = true
    const refresh = () => window.electronAPI.getAutomationRewards().then((s) => { if (live) { setData(s); setError('') } }).catch(() => { if (live) setError('Could not load reward history. Try reopening this page.') }).finally(() => { if (live) setLoading(false) })
    void refresh(); const timer = setInterval(refresh, 10000)
    return () => { live = false; clearInterval(timer) }
  }, [])
  const events = data.events.filter((e) => (account === 'all' || e.accountId === account) && (source === 'all' || e.source === source) && Date.parse(e.timestamp) >= Date.now() - periods[period] * 86400000)
  const accountName = (id: string) => data.accounts.find((a) => a.accountId === id)?.name ?? id
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ events, received: rewardTotals(events, 'received'), recycled: rewardTotals(events, 'recycled'), resources: rewardTotals(events, 'resources') }, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'automation-rewards.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const quantities = (e: RewardEvent, field: 'received' | 'recycled' | 'resources') => e[field].map((r) => `${r.quantity.toLocaleString()} × ${name(r.templateId)}`).join(', ') || 'None'
  return <div className="space-y-4 p-4">
    <div><p className="text-sm text-muted-foreground">Automate</p><h1 className="text-2xl font-semibold">Recycled Rewards</h1><p className="text-sm text-muted-foreground">Everything recorded by Auto Llamas and Auto Expeditions on this Launcher, across your accounts.</p></div>
    <div className="flex flex-wrap gap-3">
      <select aria-label="Account" className="rounded border border-border bg-background p-2" value={account} onChange={(e) => { setAccount(e.target.value); setPage(0) }}><option value="all">All accounts</option>{data.accounts.map((a) => <option value={a.accountId} key={a.accountId}>{a.name}</option>)}</select>
      <select aria-label="Automation" className="rounded border border-border bg-background p-2" value={source} onChange={(e) => { setSource(e.target.value); setPage(0) }}><option value="all">All automations</option><option value="llamas">Auto Llamas</option><option value="expeditions">Auto Expeditions</option></select>
      <select aria-label="Period" className="rounded border border-border bg-background p-2" value={period} onChange={(e) => { setPeriod(e.target.value as keyof typeof periods); setPage(0) }}>{Object.keys(periods).map((p) => <option key={p}>{p}</option>)}</select>
      <button className="rounded border border-border px-3 py-2" onClick={exportData}>Export filtered history</button>
    </div>
    {loading ? <p>Loading reward history…</p> : null}{error ? <p role="alert" className="text-destructive">{error}</p> : null}
    <div className="grid gap-3 lg:grid-cols-3"><Totals title="Rewards received" items={rewardTotals(events, 'received')} /><Totals title="Rewards recycled" items={rewardTotals(events, 'recycled')} /><Totals title="Resources gained from recycling" items={rewardTotals(events, 'resources')} /></div>
    <p className="text-xs text-muted-foreground">Received totals include items later recycled. Recycling gains are shown separately. History starts when tracking is enabled in this build; existing expedition history is included where quantities were recorded. Discord and manual actions are not imported.</p>
    <h2 className="font-semibold">Account breakdown</h2>
    <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>Account</th><th>Received</th><th>Recycled</th><th>Resources gained</th></tr></thead><tbody>{data.accounts.filter((a) => events.some((e) => e.accountId === a.accountId)).map((a) => {
      const own = events.filter((e) => e.accountId === a.accountId)
      const total = (field: 'received' | 'recycled' | 'resources') => rewardTotals(own, field).reduce((n, r) => n + r.quantity, 0).toLocaleString()
      return <tr className="border-t border-border/50" key={a.accountId}><td className="py-2">{a.name}</td><td>{total('received')}</td><td>{total('recycled')}</td><td>{total('resources')}</td></tr>
    })}</tbody></table></div>
    <h2 className="font-semibold">Collection history · {events.length} events</h2>
    {!loading && !events.length ? <p className="text-sm text-muted-foreground">No rewards recorded for these filters yet.</p> : null}
    {events.slice(page * 20, page * 20 + 20).map((e) => <details className="rounded border border-border/60 p-3 text-sm" key={e.id}><summary>{accountName(e.accountId)} · {e.source === 'llamas' ? 'Auto Llamas' : 'Auto Expeditions'} · {new Date(e.timestamp).toLocaleString()} · {e.status}</summary><div className="mt-2 space-y-1"><p>{name(e.description)}</p><p>Received: {quantities(e, 'received')}</p><p>Recycled: {quantities(e, 'recycled')}</p><p>Resources gained: {quantities(e, 'resources')}</p>{e.error ? <p className="text-destructive">{e.error}</p> : null}{e.status === 'recycling' ? <p>Recycling was submitted but confirmation was interrupted. Counts are unverified; it will not be automatically retried.</p> : null}</div></details>)}
    <div className="flex gap-3 text-sm"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={(page + 1) * 20 >= events.length} onClick={() => setPage(page + 1)}>Next</button></div>
  </div>
}
