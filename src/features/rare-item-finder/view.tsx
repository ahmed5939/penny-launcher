import type { ItemRecord, ItemRecordMap } from '../../kernel/core/item-database'
import type { FinderItem, FinderSourceId, RareItemScan, ScannedProfile } from './types'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Radar, RefreshCw, Search, ShieldQuestion, Sparkles, Star, Zap } from 'lucide-react'

import { useGetSelectedAccount } from '../../hooks/accounts'
import { useItemDatabaseStore } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { SOURCES } from './sources'

import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { ItemCard, ItemCardGrid } from '../../components/items/item-card'
import { resolveItemArt } from '../../components/items/item-icon'
import { Callout, Chip, EmptyState, KeyValue, PageHeader, PageTabs, Panel, PanelBody, PanelFooter, PanelHeader, StatRow, StatTile, rarityStyle, vaultRarityColors } from '../../components/page'
import type { ChipTone } from '../../components/page'

import { cn } from '../../lib/utils'

const PAGE_SIZE = 48

type ViewId = 'aoe' | 'historical' | 'modded' | FinderSourceId
type StatusFilter = 'highlighted' | 'hybrid' | 'modded' | 'legacy' | 'review' | 'all'
type SortKey = 'power' | 'rarity' | 'name'

/**
 * The three account-wide views come first: they are what the tool is for.
 * The four per-inventory views follow for anyone who wants to read a whole
 * profile rather than the highlights.
 */
const views: Array<{ id: ViewId; label: string; title: string; description: string }> = [
  { id: 'aoe', label: 'AOE weapons', title: 'AOE weapons', description: 'Legacy Knockback AOE weapons and schematics across the whole account, grouped by where each copy lives.' },
  { id: 'historical', label: 'Historical', title: 'Historical weapons & traps', description: 'Perks that were legitimately obtainable once and are outside today’s rules — Discharger reload speed, Vindertech five-headshots, and the others the user evidenced. Unverified slot positions are noted.' },
  { id: 'modded', label: 'Modded', title: 'Modded weapons & traps', description: 'Confirmed modded rolls, plus candidates whose perks fall outside the extracted rules and have no other explanation. The two are labelled separately.' },
  { id: 'campaign', label: 'Inventory', title: 'Inventory schematics', description: 'Weapon and trap schematics in the campaign inventory, with their original perks.' },
  { id: 'collection_book_schematics0', label: 'Collection Book', title: 'Collection Book schematics', description: 'Weapon and trap schematics slotted into the Collection Book.' },
  { id: 'theater0', label: 'Backpack', title: 'Backpack weapons & traps', description: 'Crafted copies in the backpack, checked one by one.' },
  { id: 'outpost0', label: 'Storage', title: 'Storage weapons & traps', description: 'Crafted copies in Storm Shield storage, checked one by one.' },
]

const locationLabel: Record<FinderSourceId, string> = {
  campaign: 'Inventory',
  collection_book_schematics0: 'Collection Book',
  theater0: 'Backpack',
  outpost0: 'Storage',
}

const rarityRank: Record<string, number> = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 }

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'highlighted', label: 'Legacy, historical & modded' },
  { value: 'hybrid', label: 'Legacy hybrids' },
  { value: 'modded', label: 'Modded candidates' },
  { value: 'legacy', label: 'Legacy only' },
  { value: 'review', label: 'Needs review' },
  { value: 'all', label: 'Everything checked' },
]

/** The one word that matters about a copy, in the tone the vault uses for it. */
function headline(item: FinderItem): { label: string; tone: ChipTone } {
  if (item.modded) return { label: item.defenderPerk ? 'Modded · defender perk' : item.moddedConfirmed ? 'Modded' : 'Modded candidate', tone: 'danger' }
  if (item.aoe) return { label: 'AOE weapon', tone: 'accent' }
  if (item.hybrid) return { label: 'Legacy hybrid', tone: 'accent' }
  if (item.historical) return { label: 'Historical perk', tone: 'success' }
  if (item.status === 'legacy') return { label: 'Legacy', tone: 'accent' }
  if (item.status === 'review') return { label: 'Needs review', tone: 'warning' }
  return { label: 'Current perks', tone: 'neutral' }
}

/**
 * Scan results carry their own artwork (crafted `Weapon:` ids are often
 * missing from the live database — the Dragon's Roar case). Fold those in
 * under the live records so `ItemTile` draws the right plate and art.
 */
function useTileRecords(records: ItemRecordMap, scan: RareItemScan | null) {
  return useMemo(() => {
    const merged: ItemRecordMap = { ...records }
    for (const profile of scan?.profiles ?? []) {
      for (const item of profile.items) {
        const key = item.templateId.toLowerCase()
        if (merged[key] || !item.image) continue
        merged[key] = {
          name: item.name,
          description: item.description || null,
          rarity: item.rarity === 'unknown' ? null : item.rarity[0].toUpperCase() + item.rarity.slice(1),
          tier: item.tier,
          image: item.image,
          largeImage: null,
        } as unknown as ItemRecord
      }
    }
    return merged
  }, [records, scan])
}

export function RareItemFinderPage() {
  useRequestItemDatabase()
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null
  const liveRecords = useItemDatabaseStore((s) => s.records)

  const [scan, setScan] = useState<RareItemScan | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempt, refresh] = useState(0)
  const [view, setView] = useState<ViewId>('aoe')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'weapon' | 'trap'>('all')
  const [status, setStatus] = useState<StatusFilter>('highlighted')
  const [sort, setSort] = useState<SortKey>('power')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<FinderItem | null>(null)

  /*
   * Keyed on the account id only. Token refreshes and display-name updates
   * re-render without restarting the scan; a real switch discards whatever
   * the previous account's scan returns late.
   */
  useEffect(() => {
    let active = true
    setScan(null)
    setError('')
    setDetail(null)
    setView('aoe')
    setPage(0)
    setQuery('')
    if (!selected) {
      setLoading(false)
      return
    }
    setLoading(true)
    window.electronAPI
      .requestRareItemScan(selected.accountId)
      .then((result) => {
        if (active && result.accountId === accountId) setScan(result)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'The scan could not be completed. Refresh to retry.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accountId, attempt])

  const current = scan && scan.accountId === accountId ? scan : null
  const records = useTileRecords(liveRecords, current)
  const aggregate = view === 'aoe' || view === 'historical' || view === 'modded'
  const succeeded = current?.profiles.filter((p) => p.status === 'success') ?? []
  const failed = current?.profiles.filter((p) => p.status === 'error') ?? []

  const profile: Pick<ScannedProfile, 'status' | 'items' | 'scannedCount' | 'malformedItems' | 'error'> | null = !current
    ? null
    : aggregate
      ? {
          status: succeeded.length ? 'success' : 'error',
          items: succeeded.flatMap((p) => p.items).filter((i) => (view === 'aoe' ? i.aoe : view === 'historical' ? i.historical && !i.modded : i.modded)),
          scannedCount: succeeded.reduce((n, p) => n + (p.scannedCount ?? 0), 0),
          malformedItems: succeeded.reduce((n, p) => n + (p.malformedItems ?? 0), 0),
          error: { message: 'No inventories could be checked.', code: '' },
        }
      : (current.profiles.find((p) => p.sourceId === view) ?? null)

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchesStatus = (item: FinderItem) =>
      status === 'all' ? true
        : status === 'highlighted' ? item.status === 'legacy' || item.modded || item.historical
        : status === 'hybrid' ? item.hybrid
        : status === 'modded' ? item.modded
        : item.status === status
    const items = (profile?.status === 'success' ? profile.items : []).filter(
      (item) =>
        (aggregate || kind === 'all' || item.kind === kind) &&
        (aggregate || matchesStatus(item)) &&
        (!q || [item.name, item.templateId, ...item.perks.map((p) => `${p.name} ${p.id}`)].join(' ').toLowerCase().includes(q))
    )
    const byKey = sort === 'power'
      ? (a: FinderItem, b: FinderItem) => (b.power ?? -1) - (a.power ?? -1)
      : sort === 'rarity'
        ? (a: FinderItem, b: FinderItem) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0)
        : () => 0
    return items.sort((a, b) => byKey(a, b) || a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId))
  }, [profile, aggregate, kind, status, query, sort])

  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const visible = displayed.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const activeView = views.find((v) => v.id === view)!
  const complete = current?.counts.complete ?? false

  const countFor = (id: ViewId) => {
    if (!current) return null
    if (id === 'aoe' || id === 'historical' || id === 'modded') return succeeded.length ? current.counts[id] : null
    const p = current.profiles.find((x) => x.sourceId === id)
    return p?.status === 'success' ? p.items.filter((i) => i.status === 'legacy' || i.modded || i.historical).length : null
  }
  const tabs = views.map((v) => {
    const n = countFor(v.id)
    return { value: v.id, label: n === null ? v.label : `${v.label} · ${n}` }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button disabled={!selected || loading} onClick={() => refresh((n) => n + 1)} variant="outline">
            <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} />
            {loading ? 'Scanning…' : 'Rescan'}
          </Button>
        }
        description="Legacy, hybrid, historical, Knockback AOE and modded weapons and traps, across inventory schematics, the Collection Book, the backpack and storage. Nothing here changes an item."
        icon={Radar}
        section="Save the World"
        status={
          <>
            <Chip tone="accent">Beta</Chip>
            <Chip>Read-only</Chip>
          </>
        }
        title="Rare Item Finder"
      />

      {!selected ? (
        <EmptyState description="Select an account in the title bar to scan its four weapon and trap inventories." icon={Radar} title="Choose an account" />
      ) : error ? (
        <div role="alert">
          <Callout title="The scan could not run" tone="danger">{error}</Callout>
        </div>
      ) : loading && !current ? (
        <div role="status">
          <EmptyState description="Reading inventory schematics, the Collection Book, the backpack and storage, then checking every perk against the 42.10 rules." icon={Radar} title="Scanning four inventories…" />
        </div>
      ) : current ? (
        <>
          <StatRow>
            <StatTile icon={Sparkles} label="Legacy items" tone={current.counts.legacy ? 'primary' : 'default'} value={current.counts.legacy.toLocaleString()} />
            <StatTile icon={AlertTriangle} label="Needs review" tone={current.counts.review ? 'warning' : 'default'} value={current.counts.review.toLocaleString()} />
            <StatTile icon={ShieldQuestion} label="Modded candidates" tone={current.counts.modded ? 'danger' : 'default'} value={current.counts.modded.toLocaleString()} />
            <StatTile
              hint={complete ? `All four inventories · ${new Date(current.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `${failed.length} of 4 inventories could not be read`}
              label="Items checked"
              tone={complete ? 'default' : 'warning'}
              value={current.counts.scanned.toLocaleString()}
            />
          </StatRow>

          {failed.length > 0 && (
            <Callout title="Scan incomplete" tone="warning">
              {failed.map((p) => `${locationLabel[p.sourceId]}: ${p.error?.message ?? 'could not be read'}`).join(' · ')} Counts above only cover the inventories that were read.
            </Callout>
          )}

          <PageTabs label="Views" onValueChange={(next) => { setView(next); setPage(0) }} tabs={tabs} value={view}>
            <Panel>
              <PanelHeader
                actions={<span className="micro-label">{profile?.status === 'success' ? `${displayed.length.toLocaleString()} shown · ${(profile.scannedCount ?? 0).toLocaleString()} checked` : null}</span>}
                description={activeView.description}
                title={activeView.title}
              />

              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
                <span className="relative min-w-52 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input aria-label="Search items or perks" className="pl-9" onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder="Item name, perk or template id" value={query} />
                </span>
                {!aggregate && (
                  <>
                    <Picker label="Item type" onChange={(v) => { setKind(v as typeof kind); setPage(0) }} options={[{ value: 'all', label: 'Weapons & traps' }, { value: 'weapon', label: 'Weapons' }, { value: 'trap', label: 'Traps' }]} value={kind} />
                    <Picker label="Status" onChange={(v) => { setStatus(v as StatusFilter); setPage(0) }} options={statusFilters} value={status} />
                  </>
                )}
                <Picker label="Sort" onChange={(v) => setSort(v as SortKey)} options={[{ value: 'power', label: 'Power, high to low' }, { value: 'rarity', label: 'Rarity, high to low' }, { value: 'name', label: 'Name, A to Z' }]} value={sort} />
              </div>

              {aggregate ? (
                <PanelBody className="space-y-6">
                  {SOURCES.map((location) => {
                    const original = current.profiles.find((p) => p.sourceId === location.id)
                    const inLocation = displayed.filter((i) => i.sourceId === location.id)
                    const shown = visible.filter((i) => i.sourceId === location.id)
                    return (
                      <section aria-label={locationLabel[location.id]} key={location.id}>
                        <header className="mb-3 flex flex-wrap items-baseline gap-2">
                          <h3 className="text-sm font-semibold">{locationLabel[location.id]}</h3>
                          <span className="micro-label">
                            {original?.status === 'success' ? `${inLocation.length} ${inLocation.length === 1 ? 'copy' : 'copies'}` : original?.status === 'error' ? 'not read' : 'not scanned'}
                          </span>
                          {original?.malformedItems ? <span className="micro-label text-warning">{original.malformedItems} unreadable</span> : null}
                        </header>
                        {shown.length > 0 ? (
                          <TileGrid items={shown} onInspect={setDetail} records={records} />
                        ) : (
                          <p className="text-[0.8125rem] text-muted-foreground">
                            {original?.status === 'error'
                              ? (original.error?.message ?? 'Rescan to check this inventory.')
                              : original?.status !== 'success'
                                ? 'Waiting for this inventory.'
                                : inLocation.length
                                  ? 'Matches are on another page.'
                                  : query
                                    ? 'No matches for this search.'
                                    : 'Nothing here.'}
                          </p>
                        )}
                      </section>
                    )
                  })}
                </PanelBody>
              ) : displayed.length > 0 ? (
                <PanelBody>
                  <TileGrid items={visible} onInspect={setDetail} records={records} />
                </PanelBody>
              ) : (
                <PanelBody>
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    description={
                      profile?.status === 'error'
                        ? (profile.error?.message ?? 'Rescan to check this inventory.')
                        : query || kind !== 'all'
                          ? 'Nothing matches the current search or type filter.'
                          : status === 'all'
                            ? 'This inventory holds no weapons or traps.'
                            : `Nothing in this inventory is ${statusFilters.find((f) => f.value === status)?.label.toLowerCase()}. ${status === 'legacy' ? 'Try “Needs review” for unfamiliar perks and Epic flags.' : 'It was checked successfully.'}`
                    }
                    icon={Radar}
                    title={profile?.status === 'error' ? 'This inventory could not be read' : 'No matches'}
                  />
                </PanelBody>
              )}

              {totalPages > 1 && (
                <PanelFooter>
                  <Button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} size="sm" variant="outline">Previous</Button>
                  <span className="text-xs text-muted-foreground">Page <span className="figure">{safePage + 1}</span> of <span className="figure">{totalPages}</span></span>
                  <Button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} size="sm" variant="outline">Next</Button>
                </PanelFooter>
              )}
            </Panel>
          </PageTabs>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {current.rulesVersion}. Slot checks use the extracted 42.10 rules read with 42.00 mappings; historical slot tables and server hotfixes are not included, so a mismatch is a reason to look, not proof of modification. Copies are listed per location and never merged.
          </p>
        </>
      ) : null}

      <Dialog onOpenChange={(open) => { if (!open) setDetail(null) }} open={detail !== null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {detail && <Detail item={detail} records={records} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Picker({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; value: string }) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={label} className="w-auto min-w-40 gap-2"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function TileGrid({ items, onInspect, records }: { items: Array<FinderItem>; onInspect: (item: FinderItem) => void; records: ItemRecordMap }) {
  return (
    <ItemCardGrid>
      {items.map((item) => {
        const { label, tone } = headline(item)
        return (
          <ItemCard
            badges={<Chip tone={tone}>{label}</Chip>}
            favorite={item.favorite}
            footer={<span className="truncate">{locationLabel[item.sourceId]} · {item.perks.length} perk{item.perks.length === 1 ? '' : 's'}</span>}
            key={item.key}
            level={item.level}
            name={item.name}
            onClick={() => onInspect(item)}
            power={item.power}
            quantity={item.quantity}
            records={records}
            subtitle={item.kind === 'trap' ? 'Trap' : 'Weapon'}
            templateId={item.templateId}
            tier={item.tier}
            title={`${item.name} · ${label} · ${locationLabel[item.sourceId]}`}
          />
        )
      })}
    </ItemCardGrid>
  )
}

function Detail({ item, records }: { item: FinderItem; records: ItemRecordMap }) {
  const art = resolveItemArt(item.templateId, records)
  const accent = item.rarity in vaultRarityColors ? vaultRarityColors[item.rarity as keyof typeof vaultRarityColors] : null
  const { label, tone } = headline(item)
  const finding = (codes: Array<string>, perk: FinderItem['perks'][number]) =>
    item.slotAudit.findings.find((f) => codes.includes(f.code) && f.slot === perk.slot && f.perkId === perk.id.toLowerCase())

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-4">
          <span
            className={cn('relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border-2', accent ? 'border-[color:var(--rarity)]' : 'border-border/60')}
            style={rarityStyle(accent)}
          >
            {art.frame && <img alt="" aria-hidden className="absolute inset-0 size-full object-cover" decoding="async" src={art.frame} />}
            {art.imgUrl && <img alt="" className="relative size-full object-contain" decoding="async" src={art.largeImgUrl ?? art.imgUrl} />}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <DialogTitle className="text-left text-lg leading-tight">{item.name}</DialogTitle>
            <p className={cn('micro-label mt-1.5', accent && 'text-[color:var(--rarity)]')} style={rarityStyle(accent)}>
              {[item.rarity, item.kind, item.tier > 0 && `Tier ${item.tier}`].filter(Boolean).join(' · ')}
            </p>
            {item.power !== null && (
              <p className="mt-2 flex items-center gap-1.5 leading-none">
                <Zap className="size-4 text-muted-foreground" />
                <span className="figure text-base font-bold">{item.power}</span>
                <span className="micro-label">Power</span>
              </p>
            )}
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>Level <span className="figure">{item.level}</span></span>
              {item.quantity > 1 && <span>×<span className="figure">{item.quantity}</span></span>}
              <span>{locationLabel[item.sourceId]} · {SOURCES.find((s) => s.id === item.sourceId)?.schematic ? 'schematic' : 'crafted copy'}</span>
              {item.favorite && <span className="inline-flex items-center gap-1"><Star className="size-3" /> Favourited</span>}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Chip tone={tone}>{label}</Chip>
              {item.modded && item.aoe && <Chip tone="accent">AOE weapon</Chip>}
              {item.modded && item.hybrid && <Chip tone="accent">Legacy hybrid</Chip>}
              {item.aoe && item.hybrid && !item.modded && <Chip tone="accent">Legacy hybrid</Chip>}
            </div>
          </div>
        </div>
        {item.description && <DialogDescription className="mt-3 whitespace-pre-line text-left leading-relaxed">{item.description}</DialogDescription>}
      </DialogHeader>

      <section className="space-y-2">
        <p className="section-label flex items-center gap-1.5"><Sparkles className="size-3 text-muted-foreground" />Perks on this copy</p>
        {item.perks.length ? (
          <ul className="space-y-1.5">
            {item.perks.map((perk, index) => {
              const historical = finding(['historical_perk', 'historical_slot_unverified'], perk)
              const mismatch = finding(['disallowed_slot', 'defender_on_schematic'], perk)
              const tags: Array<{ text: string; tone: ChipTone }> = []
              if (mismatch) tags.push({ text: perk.defender ? 'Defender perk on a schematic' : 'Outside current rules', tone: 'danger' })
              if (historical) tags.push({ text: historical.code === 'historical_slot_unverified' ? 'Historical · slot unverified' : 'Historical · no longer selectable', tone: 'success' })
              if (perk.aoe) tags.push({ text: 'AOE', tone: 'accent' })
              else if (perk.legacy) tags.push({ text: 'Legacy', tone: 'accent' })
              if (item.hybrid && perk.modern) tags.push({ text: 'Modern', tone: 'neutral' })
              if (!perk.known) tags.push({ text: 'Unknown perk', tone: 'warning' })
              return (
                <li className="panel px-3 py-2" key={index}>
                  <div className="flex items-start gap-2">
                    <span className="micro-label mt-0.5 w-10 shrink-0">Slot {perk.slot + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{perk.name}</p>
                      {tags.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{tags.map((tag) => <Chip key={tag.text} tone={tag.tone}>{tag.text}</Chip>)}</p>}
                      <p className="mt-1 break-all text-[0.6875rem] text-muted-foreground">{perk.id}{perk.fields.length > 1 ? ' · both perk arrays' : perk.fields[0] === 'alterationDefinitions' ? ' · crafted copy' : ''}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">This copy has no perk entries.</p>
        )}
      </section>

      <section className="space-y-2">
        <p className="section-label flex items-center gap-1.5"><ShieldQuestion className="size-3 text-muted-foreground" />Slot rule check · {item.slotAudit.build}</p>
        {item.slotAudit.findings.length ? (
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {item.slotAudit.findings.map((f, i) => (
              <li key={i}>{f.message}{f.perkId && <span className="ml-1 break-all text-xs text-muted-foreground">{f.perkId}</span>}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Every perk fits the extracted slot rules. That is consistent with a normal roll; it does not prove one.</p>
        )}
        {item.reviewReasons.length > 0 && <p className="text-xs text-muted-foreground">{item.reviewReasons.join(' · ')}</p>}
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <KeyValue copyable label="Template" value={item.templateId} />
        <KeyValue copyable label="Copy id" value={item.itemId} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {item.status === 'legacy'
          ? `Matched ${item.reasons.length} perk${item.reasons.length === 1 ? '' : 's'} in the combined API and game legacy dictionary.`
          : 'Unfamiliar perks and Epic flags are shown for review; they are not labelled legacy.'}{' '}
        42.10 assets read with 42.00 mappings; historical slot tables and hotfixes are not included. Read-only — nothing here changes the item.
      </p>
    </>
  )
}
