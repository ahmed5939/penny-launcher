import type { BookSlot } from '../../../features/collection-book/match'
import type { BookItem, CollectionBookData } from '../../../features/collection-book/types'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpCircle, BookOpen, CheckCircle2, Layers, RefreshCw, Search, Sparkles, Zap } from 'lucide-react'

import { Resources } from './-resources'
import { useGetSelectedAccount } from '../../../hooks/accounts'
import { useItemDatabaseStore, getItemRecord } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { computeItemPower } from '../../../config/constants/fortnite/power'
import { prettifyWorkerTrait } from '../../../config/constants/fortnite/items'
import catalog from '../../../features/collection-book/catalog.json'
import { bookCosts } from '../../../features/collection-book/costs'
import { matchesSlot } from '../../../features/collection-book/match'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { ItemCard, ItemCardGrid } from '../../../components/items/item-card'
import { resolveItemArt } from '../../../components/items/item-icon'
import { Callout, Chip, EmptyState, KeyValue, PageHeader, PageTabPanel, PageTabs, Panel, PanelBody, PanelHeader, StatRow, StatTile, rarityStyle, rarityTypeFromName } from '../../../components/page'

import { raritiesColor } from '../../../config/constants/resources'
import { cn } from '../../../lib/utils'

type Detail = { slot: BookSlot; items: BookItem[]; owned: BookItem[]; location?: Location }
type Location = { category: (typeof catalog)[number]; page: (typeof catalog)[number]['pages'][number]; section: (typeof catalog)[number]['pages'][number]['sections'][number]; slot: BookSlot }

const statusOptions = [
  { value: 'all', label: 'All slots' },
  { value: 'slotted', label: 'Slotted' },
  { value: 'missing', label: 'Missing' },
  { value: 'ready', label: 'Missing · copy owned' },
]
const rarityOptions = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']

function locate(item: BookItem): Location | undefined {
  for (const category of catalog)
    for (const page of category.pages)
      for (const section of page.sections)
        for (const slot of section.slots) if (matchesSlot(item, slot)) return { category, page, section, slot }
  return undefined
}

export function RouteComponent() {
  useRequestItemDatabase()
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null
  const records = useItemDatabaseStore((s) => s.records)
  const ratings = useItemDatabaseStore((s) => s.ratings)

  const [data, setData] = useState<CollectionBookData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempt, refresh] = useState(0)
  const [categoryId, setCategory] = useState(catalog[0].id)
  const [pageId, setPage] = useState(catalog[0].pages[0].id)
  const [status, setStatus] = useState('all')
  const [rarity, setRarity] = useState('all')
  const [needsUpgrading, setNeedsUpgrading] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'collection' | 'resources'>('collection')
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    setDetail(null)
    if (!selected) {
      setLoading(false)
      return
    }
    setLoading(true)
    window.electronAPI
      .requestCollectionBook(selected.accountId)
      .then((result) => {
        if (active && result.accountId === accountId) setData(result)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load the Collection Book. Refresh to retry.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accountId, attempt])

  const current = data?.accountId === accountId ? data : null
  const upgradeTotals = useMemo(() => bookCosts(current?.slotted ?? [], 'ore'), [current])
  const upgradeItems = useMemo(() => {
    const ids = new Set(upgradeTotals.upgradeIds)
    return current?.slotted.filter((item) => ids.has(item.id)) ?? []
  }, [current, upgradeTotals])
  const totalSlots = useMemo(() => catalog.reduce((n, c) => n + c.pages.reduce((m, p) => m + p.sections.reduce((k, s) => k + s.slots.length, 0), 0), 0), [])

  const category = catalog.find((c) => c.id === categoryId) ?? catalog[0]
  const page = category.pages.find((p) => p.id === pageId) ?? category.pages[0]
  const slotted = (slot: BookSlot) => current?.slotted.filter((i) => matchesSlot(i, slot)) ?? []
  const owned = (slot: BookSlot) => current?.inventory.filter((i) => matchesSlot(i, slot)) ?? []
  const power = (i: BookItem) => computeItemPower({ templateId: i.templateId, level: i.level, tables: ratings })
  const label = (tid: string) => getItemRecord(records, tid)?.name ?? tid
  const trait = (s: string | null) => (s ? prettifyWorkerTrait(s) : null)

  const q = query.trim().toLowerCase()
  const sections = page.sections
    .map((section) => ({
      section,
      slots: section.slots.filter((s) => {
        const n = slotted(s).length
        return (rarity === 'all' || s.rarity === rarity)
          && (!q || `${section.name} ${s.name}`.toLowerCase().includes(q))
          && (status === 'all' || (status === 'slotted' ? n > 0 : status === 'missing' ? n === 0 : n === 0 && owned(s).length > 0))
      }),
    }))
    .filter((s) => s.slots.length > 0)

  const pageSlots = page.sections.reduce((n, s) => n + s.slots.length, 0)
  const pageFilled = page.sections.reduce((n, s) => n + s.slots.filter((slot) => slotted(slot).length > 0).length, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button disabled={!accountId || loading} onClick={() => refresh((n) => n + 1)} variant="outline">
            <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
        description="The live Epic Collection Book for the selected account. Browse slotted items, find empty slots you already own a copy for, and see what it would cost to finish the book."
        icon={BookOpen}
        section="Save the World"
        status={
          <>
            <Chip tone="accent">Beta</Chip>
            <Chip>Read-only</Chip>
          </>
        }
        title="Collection Book"
      />

      {!accountId ? (
        <EmptyState description="Select an account in the title bar to load its Collection Book." icon={BookOpen} title="Choose an account" />
      ) : error ? (
        <div role="alert">
          <Callout title="Could not load the Collection Book" tone="danger">{error}</Callout>
        </div>
      ) : !current ? (
        <div role="status">
          <EmptyState description="Reading the campaign profile and both book profiles from Epic." icon={BookOpen} title="Loading the Collection Book…" />
        </div>
      ) : (
        <>
          <StatRow>
            <StatTile hint={`of ${totalSlots.toLocaleString()} slots`} icon={Layers} label="Slotted" tone="primary" value={current.slotted.length.toLocaleString()} />
            <StatTile hint="known cost · max level at current rarity" icon={ArrowUpCircle} label="Needs upgrading" tone={upgradeTotals.upgrades ? 'warning' : 'default'} value={upgradeTotals.upgrades.toLocaleString()} />
            <StatTile icon={CheckCircle2} label="At maximum" value={(upgradeTotals.count - upgradeTotals.upgrades - upgradeTotals.unknown.length).toLocaleString()} />
            <StatTile hint={`Updated ${new Date(current.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} icon={Zap} label="Book level" value={current.highestLevel ?? '—'} />
          </StatRow>

          <PageTabs label="Collection Book" onValueChange={setTab} tabs={[{ value: 'collection', label: 'Collection' }, { value: 'resources', label: 'Resources' }]} value={tab}>
            <PageTabPanel activeValue={tab} value="resources">
              <Resources data={current} label={label} />
            </PageTabPanel>

            <PageTabPanel activeValue={tab} value="collection">
              <Panel>
                {needsUpgrading ? (
                  <>
                    <PanelHeader
                      actions={<Button onClick={() => setNeedsUpgrading(false)} size="sm" variant="outline">Show all slots</Button>}
                      description="Every slotted item, across all categories and pages, that is below its maximum level at its current rarity. Superchargers are not counted."
                      title={`Needs upgrading · ${upgradeTotals.upgrades}`}
                    />
                    <PanelBody className="space-y-4">
                      {upgradeTotals.unknown.length > 0 && (
                        <Callout tone="warning">
                          Upgrade status is unavailable for {upgradeTotals.unknown.length} slotted item{upgradeTotals.unknown.length === 1 ? '' : 's'}; they are not listed below.
                        </Callout>
                      )}
                      {upgradeItems.length === 0 ? (
                        <EmptyState className="border-0 bg-transparent py-8" description="Every slotted item with a known cost is already at its maximum." icon={CheckCircle2} title="Nothing to upgrade" />
                      ) : (
                        <ItemCardGrid>
                          {upgradeItems.map((item) => {
                            const location = locate(item)
                            const slot: BookSlot = location?.slot ?? { id: item.id, name: label(item.templateId), rarity: '', templateId: item.templateId, allowed: [], personalities: [] }
                            return (
                              <ItemCard
                                footer={location ? <span className="truncate">{location.page.name} · {location.section.name}</span> : undefined}
                                key={item.id}
                                level={item.level}
                                name={slot.name}
                                onClick={() => setDetail({ slot, items: [item], owned: owned(slot), location })}
                                portrait={item.portrait}
                                power={power(item)}
                                records={records}
                                subtitle={item.personality ? trait(item.personality) : undefined}
                                templateId={item.templateId}
                              />
                            )
                          })}
                        </ItemCardGrid>
                      )}
                    </PanelBody>
                  </>
                ) : (
                  <>
                    <PanelHeader
                      actions={
                        <Button disabled={!upgradeTotals.upgrades} onClick={() => setNeedsUpgrading(true)} size="sm" variant="outline">
                          <ArrowUpCircle className="mr-1.5 size-3.5" />
                          Needs upgrading · {upgradeTotals.upgrades}
                        </Button>
                      }
                      description={<><span className="figure">{pageFilled}</span> of <span className="figure">{pageSlots}</span> slots filled on this page.</>}
                      title={page.name}
                    />
                    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
                      <Picker label="Category" onChange={(v) => { setCategory(v); setPage(catalog.find((c) => c.id === v)!.pages[0].id) }} options={catalog.map((c) => ({ value: c.id, label: c.name }))} value={category.id} />
                      <Picker label="Page" onChange={setPage} options={category.pages.map((p) => ({ value: p.id, label: p.name }))} value={page.id} />
                      <span className="relative min-w-48 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input aria-label="Find a slot" className="pl-9" onChange={(e) => setQuery(e.target.value)} placeholder="Slot or section name" value={query} />
                      </span>
                      <Picker label="Slot status" onChange={setStatus} options={statusOptions} value={status} />
                      <Picker label="Rarity" onChange={setRarity} options={[{ value: 'all', label: 'All rarities' }, ...rarityOptions.map((r) => ({ value: r, label: r }))]} value={rarity} />
                    </div>
                    <PanelBody className="space-y-6">
                      {sections.length === 0 ? (
                        <EmptyState className="border-0 bg-transparent py-8" description="No slots on this page match the current filters." icon={Search} title="No matches" />
                      ) : (
                        sections.map(({ section, slots }) => (
                          <section aria-label={section.name} key={section.id}>
                            <header className="mb-3 flex flex-wrap items-baseline gap-2">
                              <h3 className="text-sm font-semibold">{section.name}</h3>
                              <span className="micro-label">{slots.filter((s) => slotted(s).length > 0).length} of {slots.length} filled</span>
                            </header>
                            <ItemCardGrid>
                              {slots.map((slot) => {
                                const items = slotted(slot)
                                const item = items[0]
                                const copies = owned(slot)
                                const open = () => setDetail({ slot, items, owned: copies })
                                return item ? (
                                  <ItemCard
                                    badges={item.teamBonus ? <Chip>{trait(item.teamBonus)}</Chip> : undefined}
                                    key={slot.id}
                                    level={item.level}
                                    name={slot.name}
                                    onClick={open}
                                    portrait={item.portrait}
                                    power={power(item)}
                                    records={records}
                                    subtitle={item.personality ? trait(item.personality) : undefined}
                                    templateId={item.templateId}
                                  />
                                ) : (
                                  <ItemCard
                                    badges={copies.length > 0 ? <Chip tone="success">{copies.length} owned</Chip> : <Chip>Missing</Chip>}
                                    className="opacity-80 hover:opacity-100"
                                    key={slot.id}
                                    name={slot.name}
                                    onClick={open}
                                    overlay={<span aria-hidden className="absolute inset-0 bg-background/45" />}
                                    records={records}
                                    subtitle="Empty slot"
                                    templateId={slot.templateId}
                                  />
                                )
                              })}
                            </ItemCardGrid>
                          </section>
                        ))
                      )}
                    </PanelBody>
                  </>
                )}
              </Panel>
            </PageTabPanel>
          </PageTabs>
        </>
      )}

      <Dialog onOpenChange={(open) => { if (!open) setDetail(null) }} open={detail !== null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {detail && <SlotDetail detail={detail} label={label} power={power} records={records} trait={trait} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Picker({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; value: string }) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={label} className="w-auto min-w-36 gap-2"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function SlotDetail({ detail, label, power, records, trait }: {
  detail: Detail
  label: (id: string) => string
  power: (item: BookItem) => number | null
  records: ReturnType<typeof useItemDatabaseStore.getState>['records']
  trait: (s: string | null) => string | null
}) {
  const { slot, items, owned } = detail
  const item = items[0]
  const art = resolveItemArt(item?.templateId ?? slot.templateId, records, item?.portrait)
  const rarityType = rarityTypeFromName(slot.rarity)
  const accent = rarityType ? raritiesColor[rarityType] : null
  const record = item ? getItemRecord(records, item.templateId) : null
  const pl = item ? power(item) : null

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-4">
          <span className={cn('relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border-2', accent ? 'border-[color:var(--rarity)]' : 'border-border/60')} style={rarityStyle(accent)}>
            {art.frame && <img alt="" aria-hidden className="absolute inset-0 size-full object-cover" decoding="async" src={art.frame} />}
            {art.imgUrl && <img alt="" className={cn('relative size-full object-contain', !item && 'opacity-50 grayscale')} decoding="async" src={art.largeImgUrl ?? art.imgUrl} />}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <DialogTitle className="text-left text-lg leading-tight">{slot.name}</DialogTitle>
            <p className={cn('micro-label mt-1.5', accent && 'text-[color:var(--rarity)]')} style={rarityStyle(accent)}>
              {[slot.rarity, record?.subType, record?.displayTier].filter(Boolean).join(' · ')}
            </p>
            {pl !== null && (
              <p className="mt-2 flex items-center gap-1.5 leading-none">
                <Zap className="size-4 text-muted-foreground" />
                <span className="figure text-base font-bold">{pl}</span>
                <span className="micro-label">Power</span>
              </p>
            )}
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {item ? <span>Level <span className="figure">{item.level}</span></span> : <span>Empty slot</span>}
              {item?.personality && <span>{slot.rarity === 'Mythic' ? 'Fixed personality' : 'Personality'}: {trait(item.personality)}</span>}
              {item?.teamBonus && <span>Team bonus: {trait(item.teamBonus)}</span>}
            </p>
            {detail.location && <p className="mt-1 text-xs text-muted-foreground">{detail.location.category.name} · {detail.location.page.name} · {detail.location.section.name}</p>}
          </div>
        </div>
      </DialogHeader>

      {item ? (
        <>
          {item.alterations.length > 0 && (
            <section className="space-y-2">
              <p className="section-label flex items-center gap-1.5"><Sparkles className="size-3 text-muted-foreground" />Perks on this copy</p>
              <ul className="space-y-1.5">
                {item.alterations.map((a, n) => (
                  <li className="panel px-3 py-2" key={n}>
                    <div className="flex items-start gap-2">
                      <span className="micro-label mt-0.5 w-10 shrink-0">Slot {n + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{getItemRecord(records, a)?.description?.replace(/<[^>]+>/g, '') || label(a)}</p>
                        <p className="mt-1 break-all text-[0.6875rem] text-muted-foreground">{a}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <KeyValue copyable label="Template" value={item.templateId} />
            <KeyValue copyable label="Copy id" value={item.id} />
          </div>
        </>
      ) : (
        <Callout tone={owned.length ? 'success' : 'info'}>
          {owned.length
            ? `You own ${owned.length} matching cop${owned.length === 1 ? 'y' : 'ies'} in the campaign inventory that could fill this slot.`
            : 'No matching copy in the campaign inventory.'}
        </Callout>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">Slotting, upgrades and reward collection are not available in this beta. Nothing here spends resources.</p>
    </>
  )
}
