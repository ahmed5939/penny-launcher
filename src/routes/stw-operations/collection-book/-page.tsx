import type { BookSlot } from '../../../features/collection-book/match'
import type { LucideIcon } from 'lucide-react'
import type { BookItem, BookUpgradeRequest, CollectionBookData } from '../../../features/collection-book/types'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import { useMemo, useState } from 'react'
import { ArrowUp, ArrowUpCircle, BookOpen, Check, ChevronsUp, Star, CheckCircle2, Layers, Search, SearchX, Sparkles, Zap } from 'lucide-react'

import { Resources } from './-resources'
import { useItemDatabaseStore, getItemRecord } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { computeItemPower } from '../../../config/constants/fortnite/power'
import { prettifyWorkerTrait } from '../../../config/constants/fortnite/items'
import catalog from '../../../features/collection-book/catalog.json'
import { bookCosts, costRules, evolutionStep, itemCosts, levelStepCost, type Costs } from '../../../features/collection-book/costs'
import { indexBookSlots } from '../../../features/collection-book/match'

import { toast } from '../../../lib/notifications'

import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { ItemIcon, resolveItemArt } from '../../../components/items/item-icon'
import { Artboard } from '../../../components/items/artboard'
import { ItemTile } from '../../../components/items/item-tile'
import { DetailSection, PerkSlotRow } from '../../../components/items/detail-parts'
import { AccountResourceGate, Callout, EmptyState, FilterBar, KeyValue, PageHeader, PageTabPanel, PageTabs, Panel, PanelBody, PanelHeader, Picker, ProgressBar, RefreshButton, SearchField, Segmented, StatRow, StatTile, ToolBadges, useAccountResource } from '../../../components/page'

import { cn } from '../../../lib/utils'

type Detail = { slot: BookSlot; items: BookItem[]; owned: BookItem[]; location?: Location }
type Location = { category: (typeof catalog)[number]; page: (typeof catalog)[number]['pages'][number]; section: (typeof catalog)[number]['pages'][number]['sections'][number]; slot: BookSlot }

const statusOptions: Array<{ value: SlotStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'slotted', label: 'Slotted' },
  { value: 'missing', label: 'Missing' },
]
const missingOptions = [
  { value: 'all', label: 'Every missing slot' },
  { value: 'ready', label: 'Copy already owned' },
  { value: 'none', label: 'No copy owned' },
]
type SlotStatus = 'all' | 'slotted' | 'missing'
type Tab = 'book' | 'missing' | 'upgrades' | 'resources'
type UpgradeKind = 'all' | 'level' | 'evolve'
const upgradeKindOptions: Array<{ value: UpgradeKind; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'level', label: 'Level up' },
  { value: 'evolve', label: 'Evolve' },
]
const upgradeOrderOptions = [
  { value: 'book', label: 'Book order' },
  { value: 'closest', label: 'Closest to max first' },
  { value: 'furthest', label: 'Furthest from max first' },
]
/** One slotted item below its ceiling. `cap` is the current star cap; `kind` says whether levels or an evolution come next. */
type Upgrade = { item: BookItem; slot: BookSlot; location?: Location; level: number; cap: number; maxLevel: number; kind: 'level' | 'evolve'; remaining: Costs; order: number }
const rarityOptions = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']

const locations: Location[] = catalog.flatMap((category) =>
  category.pages.flatMap((page) =>
    page.sections.flatMap((section) =>
      section.slots.map((slot) => ({ category, page, section, slot })))))
const allSlots = locations.map(({ slot }) => slot)
const locationBySlot = new Map(locations.map((location) => [location.slot, location]))
const locationIndex = new Map(locations.map((location, index) => [location.slot, index]))
const totalSlots = allSlots.length
const emptyItems: BookItem[] = []

/** Tiles the size of the game's book slots: as many per row as fit. */
const slotGrid = 'grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5'

export function RouteComponent() {
  useRequestItemDatabase()
  const resource = useAccountResource((accountId) => window.electronAPI.requestCollectionBook(accountId), {
    cacheKey: 'stw.collection-book',
    fallbackError: 'Could not load the Collection Book. Refresh to retry.',
    owner: (result) => result.accountId,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        actions={<RefreshButton disabled={!resource.accountId} loading={resource.loading} onClick={resource.refresh} />}
        description="Your Collection Book laid out like the in-game book: categories and pages on the left, every slot of the page on the right. The Missing tab lists every empty slot at once."
        icon={BookOpen}
        section="Save the World"
        status={<ToolBadges beta />}
        title="Collection Book"
      />
      <AccountResourceGate
        icon={BookOpen}
        loading={{ title: 'Loading the Collection Book…', description: 'Reading the campaign profile and both book profiles from Epic.' }}
        resource={resource}
        what="the Collection Book"
      >
        {(data) => <Book current={data} key={data.accountId} onChanged={resource.refresh} />}
      </AccountResourceGate>
    </div>
  )
}

function Book({ current, onChanged }: { current: CollectionBookData; onChanged: () => void }) {
  const records = useItemDatabaseStore((s) => s.records)
  const ratings = useItemDatabaseStore((s) => s.ratings)
  const [categoryId, setCategory] = useState(catalog[0].id)
  const [pageId, setPage] = useState(catalog[0].pages[0].id)
  const [status, setStatus] = useState<SlotStatus>('all')
  const [query, setQuery] = useState('')
  const [missingFilter, setMissingFilter] = useState('all')
  const [missingCategory, setMissingCategory] = useState('all')
  const [rarity, setRarity] = useState('all')
  const [upgradeKind, setUpgradeKind] = useState<UpgradeKind>('all')
  const [upgradeCategory, setUpgradeCategory] = useState('all')
  const [upgradeOrder, setUpgradeOrder] = useState('book')
  const [tab, setTab] = useState<Tab>('book')
  const [detail, setDetail] = useState<Detail | null>(null)

  const upgradeTotals = useMemo(() => bookCosts(current.slotted, 'ore'), [current])
  const upgradeItems = useMemo(() => {
    const ids = new Set(upgradeTotals.upgradeIds)
    return current.slotted.filter((item) => ids.has(item.id))
  }, [current, upgradeTotals])
  const slotIndex = useMemo(() => ({
    slotted: indexBookSlots(allSlots, current.slotted),
    owned: indexBookSlots(allSlots, current.inventory),
  }), [current])

  const slotted = (slot: BookSlot) => slotIndex.slotted.bySlot.get(slot) ?? emptyItems
  const owned = (slot: BookSlot) => slotIndex.owned.bySlot.get(slot) ?? emptyItems
  const filled = (slots: BookSlot[]) => slots.filter((slot) => slotted(slot).length > 0).length
  const power = (i: BookItem) => computeItemPower({ templateId: i.templateId, level: i.level, tables: ratings })
  const label = (tid: string) => getItemRecord(records, tid)?.name ?? tid
  const trait = (s: string | null) => (s ? prettifyWorkerTrait(s) : null)
  const open = (slot: BookSlot) => setDetail({ slot, items: slotted(slot), owned: owned(slot), location: locationBySlot.get(slot) })

  /* Completion per category and page, for the left-hand list. */
  const progress = useMemo(() => {
    const byPage = new Map<string, { done: number; total: number }>()
    const byCategory = new Map<string, { done: number; total: number }>()
    for (const category of catalog) {
      let done = 0
      let total = 0
      for (const page of category.pages) {
        const slots = page.sections.flatMap((section) => section.slots)
        const pageDone = filled(slots)
        byPage.set(page.id, { done: pageDone, total: slots.length })
        done += pageDone
        total += slots.length
      }
      byCategory.set(category.id, { done, total })
    }
    return { byPage, byCategory }
    // `filled` reads `slotIndex`, which is the dependency that matters.
  }, [slotIndex])

  const missing = useMemo(() => locations.filter(({ slot }) => slotted(slot).length === 0), [slotIndex])
  const readyCount = useMemo(() => missing.filter(({ slot }) => owned(slot).length > 0).length, [missing])

  const category = catalog.find((c) => c.id === categoryId) ?? catalog[0]
  const page = category.pages.find((p) => p.id === pageId) ?? category.pages[0]
  const q = query.trim().toLowerCase()
  const matchesQuery = (slot: BookSlot, section: string) => !q || `${section} ${slot.name}`.toLowerCase().includes(q)

  const sections = page.sections
    .map((section) => ({
      section,
      slots: section.slots.filter((slot) => {
        const n = slotted(slot).length
        return matchesQuery(slot, section.name) && (status === 'all' || (status === 'slotted' ? n > 0 : n === 0))
      }),
    }))
    .filter((s) => s.slots.length > 0)
  const pageProgress = progress.byPage.get(page.id) ?? { done: 0, total: 0 }

  /* The Missing tab: every empty slot, grouped under its page in book order. */
  const missingGroups = useMemo(() => {
    const groups: Array<{ key: string; category: Location['category']; page: Location['page']; slots: BookSlot[] }> = []
    for (const location of missing) {
      const { slot } = location
      const copies = owned(slot).length
      if (missingCategory !== 'all' && location.category.id !== missingCategory) continue
      if (rarity !== 'all' && slot.rarity !== rarity) continue
      if (missingFilter === 'ready' ? copies === 0 : missingFilter === 'none' ? copies > 0 : false) continue
      if (!matchesQuery(slot, `${location.page.name} ${location.section.name}`)) continue
      const key = `${location.category.id}/${location.page.id}`
      const last = groups[groups.length - 1]
      if (last?.key === key) last.slots.push(slot)
      else groups.push({ key, category: location.category, page: location.page, slots: [slot] })
    }
    return groups
  }, [missing, missingCategory, rarity, missingFilter, q])
  const missingShown = missingGroups.reduce((n, g) => n + g.slots.length, 0)

  const upgrades = useMemo(() => upgradeItems.flatMap((item): Upgrade[] => {
    try {
      const costs = itemCosts(item, 'ore')
      const rule = costRules.rules[item.templateId.toLowerCase()]
      const cap = Math.min(rule.tier * 10, 50)
      const matched = slotIndex.slotted.firstSlotByItemId.get(item.id)
      const location = matched ? locationBySlot.get(matched) : undefined
      const slot: BookSlot = location?.slot ?? { id: item.id, name: label(item.templateId), rarity: '', templateId: item.templateId, allowed: [], personalities: [] }
      const level = Math.min(item.level, 50)
      return [{ item, slot, location, level, cap, maxLevel: costs.maxLevel, kind: level >= cap ? 'evolve' : 'level', remaining: costs.remaining, order: location ? locationIndex.get(location.slot) ?? Infinity : Infinity }]
    } catch {
      return []
    }
    // `label` reads `records`, which is the dependency that matters.
  }), [upgradeItems, slotIndex, records])
  const upgradeXp = useMemo(() => {
    const totals: Costs = {}
    for (const u of upgrades) for (const [id, n] of Object.entries(u.remaining)) if (id.endsWith('xp')) totals[id] = (totals[id] ?? 0) + n
    return totals
  }, [upgrades])
  const upgradeGroups = useMemo(() => {
    const shown = upgrades.filter((u) =>
      (upgradeKind === 'all' || u.kind === upgradeKind)
      && (upgradeCategory === 'all' || u.location?.category.id === upgradeCategory)
      && matchesQuery(u.slot, `${u.location?.page.name ?? ''} ${u.location?.section.name ?? ''}`))
    if (upgradeOrder !== 'book') {
      const ratio = (u: Upgrade) => u.level / u.maxLevel
      shown.sort((a, b) => (upgradeOrder === 'closest' ? ratio(b) - ratio(a) : ratio(a) - ratio(b)) || a.order - b.order)
      return shown.length ? [{ key: 'all', title: '', subtitle: '', items: shown }] : []
    }
    shown.sort((a, b) => a.order - b.order)
    const groups: Array<{ key: string; title: string; subtitle: string; items: Upgrade[] }> = []
    for (const u of shown) {
      const key = u.location ? `${u.location.category.id}/${u.location.page.id}` : 'unplaced'
      const last = groups[groups.length - 1]
      if (last?.key === key) last.items.push(u)
      else groups.push({ key, title: u.location?.page.name ?? 'Not matched to a slot', subtitle: u.location?.category.name ?? 'Unknown page', items: [u] })
    }
    return groups
  }, [upgrades, upgradeKind, upgradeCategory, upgradeOrder, q])

  const tile = (slot: BookSlot, context?: string) => (
    <SlotTile context={context} item={slotted(slot)[0]} key={slot.id} onClick={() => open(slot)} owned={owned(slot).length} power={power} records={records} slot={slot} />
  )

  return (
    <>
      <StatRow>
        <StatTile hint={`Read at ${new Date(current.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} icon={Zap} label="Book level" tone="primary" value={current.highestLevel ?? '—'} />
        <StatTile icon={Layers} label="Slotted" value={<>{current.slotted.length.toLocaleString()}<span className="text-sm font-medium text-muted-foreground"> / {totalSlots.toLocaleString()}</span></>}>
          <ProgressBar className="mt-2 w-40" total={totalSlots} value={current.slotted.length} />
        </StatTile>
        <StatTile hint={`${readyCount.toLocaleString()} with a copy you already own`} icon={SearchX} label="Missing" value={missing.length.toLocaleString()} />
        <StatTile hint="Below max level for their rarity" icon={ArrowUpCircle} label="Needs upgrading" tone={upgradeTotals.upgrades ? 'warning' : 'default'} value={upgradeTotals.upgrades.toLocaleString()} />
      </StatRow>

      <PageTabs
        label="Collection Book"
        onValueChange={(value) => { setTab(value); setQuery('') }}
        tabs={[
          { value: 'book', label: 'Book' },
          { value: 'missing', label: `Missing · ${missing.length.toLocaleString()}` },
          { value: 'upgrades', label: `Needs upgrading · ${upgradeTotals.upgrades.toLocaleString()}` },
          { value: 'resources', label: 'Resources' },
        ]}
        value={tab}
      >
        <PageTabPanel activeValue={tab} value="book">
          {/*
            The game's book is a fixed screen: the page list and the page each
            scroll on their own, so the list never drifts away from the page it
            is showing. Height is the viewport less the title bar, tab strip
            and status bar.
          */}
          <div className="flex h-[calc(100vh-9.5rem)] min-h-[30rem] gap-4">
            <Panel className="flex w-80 shrink-0 flex-col">
              <nav aria-label="Collection Book pages" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {catalog.map((c) => {
                  const active = c.id === category.id
                  const done = progress.byCategory.get(c.id) ?? { done: 0, total: 0 }
                  const complete = done.total > 0 && done.done === done.total
                  return (
                    <div className={cn('rounded-lg transition-colors', active && 'bg-surface/80 ring-1 ring-inset ring-border/60')} key={c.id}>
                      <button
                        aria-expanded={active}
                        className={cn('group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors', !active && 'hover:bg-accent/40')}
                        onClick={() => { setCategory(c.id); setPage(c.pages[0].id) }}
                        type="button"
                      >
                        <CategoryArt records={records} templateId={categoryArt(c)} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('flex items-baseline justify-between gap-2', active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
                            <span className="truncate text-sm font-semibold">{c.name}</span>
                            {complete ? <Check aria-label="Complete" className="size-4 shrink-0 text-success" /> : <span className="figure shrink-0 text-2xs">{done.done}/{done.total}</span>}
                          </span>
                          <ProgressBar className="mt-1.5 h-1" total={done.total} value={done.done} />
                        </span>
                      </button>
                      {active && (
                        <ul className="space-y-px px-2 pb-2">
                          {c.pages.map((p) => {
                            const pd = progress.byPage.get(p.id) ?? { done: 0, total: 0 }
                            const pageComplete = pd.total > 0 && pd.done === pd.total
                            const current = p.id === page.id
                            return (
                              <li key={p.id}>
                                <button
                                  aria-current={current ? 'page' : undefined}
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-md border-l-2 py-2 pl-3 pr-2 text-left text-ui transition-colors',
                                    current ? 'border-primary bg-primary/15 font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                                  )}
                                  onClick={() => setPage(p.id)}
                                  type="button"
                                >
                                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                  {pageComplete
                                    ? <Check aria-label="Complete" className="size-3.5 shrink-0 text-success" />
                                    : <span className="figure shrink-0 text-2xs text-muted-foreground">{pd.done}/{pd.total}</span>}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </nav>
            </Panel>

            <Panel className="flex min-w-0 flex-1 flex-col">
              <PanelHeader
                actions={
                  <>
                    <span className="text-xs text-muted-foreground"><span className="figure text-foreground">{pageProgress.done}</span> of <span className="figure">{pageProgress.total}</span> slotted</span>
                    <ProgressBar className="w-24" total={pageProgress.total} value={pageProgress.done} />
                  </>
                }
                description={category.name}
                title={page.name}
              />
              <FilterBar>
                <Segmented onChange={setStatus} options={statusOptions} value={status} />
                <SearchField label="Find a slot on this page" onChange={setQuery} placeholder="Slot or section name" value={query} />
              </FilterBar>
              <PanelBody className="min-h-0 flex-1 space-y-5 overflow-y-auto">
                {sections.length === 0 ? (
                  <EmptyState className="border-0 bg-transparent py-8" description="No slots on this page match the current filters." icon={Search} title="No matches" />
                ) : (
                  sections.map(({ section, slots }) => (
                    <section aria-label={section.name} key={section.id}>
                      <header className="mb-2 flex flex-wrap items-baseline gap-2">
                        <h3 className="text-ui font-semibold">{section.name}</h3>
                        <span className="figure text-xs text-muted-foreground">{filled(section.slots)}/{section.slots.length}</span>
                      </header>
                      <div className={slotGrid}>{slots.map((slot) => tile(slot))}</div>
                    </section>
                  ))
                )}
              </PanelBody>
            </Panel>
          </div>
        </PageTabPanel>

        <PageTabPanel activeValue={tab} value="missing">
          <Panel>
            <PanelHeader
              actions={<span className="text-xs text-muted-foreground"><span className="figure text-foreground">{missingShown.toLocaleString()}</span> of {missing.length.toLocaleString()} missing</span>}
              description={`Every empty slot in the book, in book order. ${readyCount.toLocaleString()} can be filled from copies already in the campaign inventory — those carry a tick.`}
              title="Missing from the book"
            />
            <FilterBar>
              <SearchField label="Find a missing slot" onChange={setQuery} placeholder="Slot, page or section" value={query} />
              <Picker label="Ownership" onChange={setMissingFilter} options={missingOptions} value={missingFilter} />
              <Picker label="Category" onChange={setMissingCategory} options={[{ value: 'all', label: 'All categories' }, ...catalog.map((c) => ({ value: c.id, label: c.name }))]} value={missingCategory} />
              <Picker label="Rarity" onChange={setRarity} options={[{ value: 'all', label: 'All rarities' }, ...rarityOptions.map((r) => ({ value: r, label: r }))]} value={rarity} />
            </FilterBar>
            <PanelBody className="space-y-5">
              {missing.length === 0 ? (
                <EmptyState className="border-0 bg-transparent py-8" description="Every slot in the book is filled." icon={CheckCircle2} title="Book complete" />
              ) : missingGroups.length === 0 ? (
                <EmptyState className="border-0 bg-transparent py-8" description="No missing slots match the current filters." icon={Search} title="No matches" />
              ) : (
                missingGroups.map((group) => (
                  <section aria-label={`${group.category.name} · ${group.page.name}`} key={group.key}>
                    <header className="mb-2 flex flex-wrap items-baseline gap-2">
                      <h3 className="text-ui font-semibold">{group.page.name}</h3>
                      <span className="text-xs text-muted-foreground">{group.category.name} · <span className="figure">{group.slots.length}</span> missing</span>
                    </header>
                    <div className={slotGrid}>{group.slots.map((slot) => tile(slot, locationBySlot.get(slot)?.section.name))}</div>
                  </section>
                ))
              )}
            </PanelBody>
          </Panel>
        </PageTabPanel>

        <PageTabPanel activeValue={tab} value="upgrades">
          <Panel>
            <PanelHeader
              actions={
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {Object.entries(upgradeXp).map(([id, amount]) => (
                    <span className="inline-flex items-center gap-1.5" key={id}>
                      <ItemIcon className="size-5" records={records} templateId={id} />
                      <span className="figure text-foreground">{amount.toLocaleString()}</span> {label(id)}
                    </span>
                  ))}
                </span>
              }
              description="Slotted items below the highest level their rarity allows. The bar under each shows how far along it is; evolve means the item is at its star cap and needs evolving before it can level again. Superchargers are not counted."
              title="Needs upgrading"
            />
            <FilterBar>
              <Segmented onChange={setUpgradeKind} options={upgradeKindOptions.map((o) => ({ ...o, label: `${o.label} · ${upgrades.filter((u) => o.value === 'all' || u.kind === o.value).length}` }))} value={upgradeKind} />
              <SearchField label="Find an item to upgrade" onChange={setQuery} placeholder="Item, page or section" value={query} />
              <Picker label="Category" onChange={setUpgradeCategory} options={[{ value: 'all', label: 'All categories' }, ...catalog.map((c) => ({ value: c.id, label: c.name }))]} value={upgradeCategory} />
              <Picker label="Order" onChange={setUpgradeOrder} options={upgradeOrderOptions} value={upgradeOrder} />
            </FilterBar>
            <PanelBody className="space-y-5">
              {upgradeTotals.unknown.length > 0 && (
                <Callout tone="warning">
                  Upgrade status is unavailable for {upgradeTotals.unknown.length} slotted item{upgradeTotals.unknown.length === 1 ? '' : 's'}; they are not listed.
                </Callout>
              )}
              {upgrades.length === 0 ? (
                <EmptyState className="border-0 bg-transparent py-8" description="Every slotted item with a known cost is already at its maximum." icon={CheckCircle2} title="Nothing to upgrade" />
              ) : upgradeGroups.length === 0 ? (
                <EmptyState className="border-0 bg-transparent py-8" description="No items match the current filters." icon={Search} title="No matches" />
              ) : (
                upgradeGroups.map((group) => (
                  <section aria-label={group.title} key={group.key}>
                    {group.title && (
                      <header className="mb-2 flex flex-wrap items-baseline gap-2">
                        <h3 className="text-ui font-semibold">{group.title}</h3>
                        <span className="text-xs text-muted-foreground">{group.subtitle} · <span className="figure">{group.items.length}</span> to upgrade</span>
                      </header>
                    )}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                      {group.items.map((u) => (
                        <UpgradeTile key={u.item.id} onClick={() => setDetail({ slot: u.slot, items: [u.item], owned: owned(u.slot), location: u.location })} power={power} records={records} upgrade={u} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </PanelBody>
          </Panel>
        </PageTabPanel>

        <PageTabPanel activeValue={tab} value="resources">
          <Resources data={current} label={label} />
        </PageTabPanel>
      </PageTabs>

      <Dialog onOpenChange={(open) => { if (!open) setDetail(null) }} open={detail !== null}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          {/* Read the slot live, so the dialog follows the copy through an upgrade and the refresh after it. */}
          {detail && <SlotDetail accountId={current.accountId} detail={detail.location ? { ...detail, items: slotted(detail.slot), owned: owned(detail.slot) } : detail} key={detail.slot.id} label={label} onUpgraded={onChanged} power={power} records={records} resources={current.resources} trait={trait} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** The art a category shows in the page list: its first slot, the way the game fronts each tab with a character or weapon. */
function categoryArt(category: (typeof catalog)[number]) {
  return category.pages[0]?.sections[0]?.slots[0]?.templateId ?? ''
}

function CategoryArt({ records, templateId }: { records: ItemRecordMap; templateId: string }) {
  const art = resolveItemArt(templateId, records)
  return (
    <Artboard className="relative size-11 shrink-0 overflow-hidden rounded-md" rarity={art.rarity}>
      {art.imgUrl && <img alt="" className="absolute inset-0 size-full object-contain p-0.5" decoding="async" loading="lazy" src={art.imgUrl} />}
    </Artboard>
  )
}

/** A slotted item on the upgrade list: the slot tile, then its level against the ceiling. */
function UpgradeTile({ onClick, power, records, upgrade }: { onClick: () => void; power: (item: BookItem) => number | null; records: ItemRecordMap; upgrade: Upgrade }) {
  const { item, kind, level, maxLevel, slot } = upgrade
  const where = upgrade.location ? `${upgrade.location.page.name} · ${upgrade.location.section.name}` : null
  return (
    <div className="flex flex-col gap-1">
      <ItemTile
        className="w-full"
        name={slot.name}
        onClick={onClick}
        portrait={item.portrait}
        power={power(item)}
        records={records}
        size="small"
        templateId={item.templateId}
        title={[slot.name, where, `Level ${level} of ${maxLevel}`, kind === 'evolve' && 'needs evolving'].filter(Boolean).join(' · ')}
      />
      <div className="px-0.5">
        <div className="flex items-baseline justify-between gap-1 text-2xs leading-none">
          <span className="text-muted-foreground">Lv <span className="figure font-semibold text-foreground">{level}</span><span className="figure">/{maxLevel}</span></span>
          {kind === 'evolve' && <span className="font-semibold text-warning">Evolve</span>}
        </div>
        <ProgressBar className="mt-1 h-1" label={`Level ${level} of ${maxLevel}`} total={maxLevel} value={level} />
      </div>
    </div>
  )
}

/**
 * One book slot, as the game draws it: filled slots in full colour with the
 * item's power, empty ones as a dimmed, desaturated silhouette of what goes
 * there. A tick on an empty slot means a copy is already in the inventory.
 */
function SlotTile({ context, item, onClick, owned, power, records, slot }: {
  context?: string
  item: BookItem | undefined
  onClick: () => void
  owned: number
  power: (item: BookItem) => number | null
  records: ItemRecordMap
  slot: BookSlot
}) {
  const title = [slot.name, context, item ? `Level ${item.level}` : owned ? `Empty — ${owned} cop${owned === 1 ? 'y' : 'ies'} owned` : 'Empty slot'].filter(Boolean).join(' · ')
  return (
    <div className="relative">
      <ItemTile
        className={cn('w-full', !item && 'opacity-50 grayscale transition-[filter,opacity] hover:opacity-90 hover:grayscale-0')}
        name={slot.name}
        onClick={onClick}
        portrait={item?.portrait}
        power={item ? power(item) : undefined}
        records={records}
        size="small"
        templateId={item?.templateId ?? slot.templateId}
        title={title}
      />
      {!item && owned > 0 && (
        <span aria-label="Copy owned" className="pointer-events-none absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-success text-background shadow" title={title}>
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </div>
  )
}

type UpgradeOption = { key: string; icon: LucideIcon; title: string; hint: string; cost: Costs | null; request: BookUpgradeRequest }

/** Electron wraps a main-process throw in its own sentence; the user only needs ours. */
function ipcMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : ''
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || 'The upgrade failed. Refresh and try again.'
}

function evolveLabel(to: string, tier: number) {
  return /_ore_t04$/i.test(to) ? 'Evolve with Obsidian'
    : /_crystal_t04$/i.test(to) ? 'Evolve with Shadowshard'
      : /_ore_t05$/i.test(to) ? 'Evolve with Brightcore'
        : /_crystal_t05$/i.test(to) ? 'Evolve with Sunbeam'
          : `Evolve to ${tier + 1} stars`
}

/** What can be done to this copy next, priced from the cost rules, in the order the game offers it. */
function upgradeOptions(item: BookItem, record: ReturnType<typeof getItemRecord>): { options: UpgradeOption[]; step: ReturnType<typeof evolutionStep> } {
  const step = evolutionStep(item.templateId)
  if (!step) return { options: [], step }
  const book = item.templateId.toLowerCase().startsWith('schematic:') ? 'schematics' : 'people'
  const level = Math.min(item.level, 50)
  const options: UpgradeOption[] = []
  if (level < step.cap) {
    options.push({ key: 'level-1', icon: ArrowUp, title: 'Level +1', hint: `Level ${level} → ${level + 1}`, cost: levelStepCost(item.templateId, level, level + 1), request: { itemId: item.id, book, action: 'level', desiredLevel: level + 1 } })
    if (step.cap - level >= 2) {
      options.push({ key: 'level-cap', icon: ChevronsUp, title: `Level to ${step.cap}`, hint: `Level ${level} → ${step.cap}, the ${step.tier}-star cap`, cost: levelStepCost(item.templateId, level, step.cap), request: { itemId: item.id, book, action: 'level', desiredLevel: step.cap } })
    }
  } else if (level < 50) {
    /* The backend's conversion index is the recipe order on the item record, not the order the rules list them. */
    const recipes = [record?.tierUpResult, record?.alternateTierUpResult].map((r) => r?.split(':').pop()?.toLowerCase())
    step.next.forEach((edge, index) => {
      const found = recipes.indexOf(edge.to.split(':').pop())
      const conversionIndex = found === -1 ? index : found
      options.push({ key: `evolve-${conversionIndex}`, icon: Star, title: evolveLabel(edge.to, step.tier), hint: `${step.tier} → ${step.tier + 1} stars, then levels up to ${Math.min((step.tier + 1) * 10, 50)}`, cost: edge.cost, request: { itemId: item.id, book, action: 'evolve', conversionIndex } })
    })
  }
  return { options, step }
}

function Stars({ tier }: { tier: number }) {
  return (
    <span aria-label={`${tier} of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => <Star className={cn('size-4', n <= tier ? 'fill-current text-warning' : 'text-muted-foreground/40')} key={n} />)}
    </span>
  )
}

function CostList({ cost, label, records, resources }: { cost: Costs; label: (id: string) => string; records: ItemRecordMap; resources: Record<string, number> }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {Object.entries(cost).filter(([, n]) => n > 0).map(([id, n]) => {
        const have = resources[id] ?? 0
        const short = have < n
        return (
          <li className="inline-flex items-center gap-1.5 text-xs" key={id} title={`${label(id)} — you have ${have.toLocaleString()}`}>
            <ItemIcon className="size-5" records={records} templateId={id} />
            <span className={cn('figure font-semibold', short ? 'text-warning' : 'text-foreground')}>{n.toLocaleString()}</span>
          </li>
        )
      })}
    </ul>
  )
}

function SlotDetail({ accountId, detail, label, onUpgraded, power, records, resources, trait }: {
  accountId: string
  detail: Detail
  label: (id: string) => string
  onUpgraded: () => void
  power: (item: BookItem) => number | null
  records: ItemRecordMap
  resources: Record<string, number>
  trait: (s: string | null) => string | null
}) {
  const { slot, items, owned } = detail
  const item = items[0]
  const record = item ? getItemRecord(records, item.templateId) : null
  const art = resolveItemArt(item?.templateId ?? slot.templateId, records, item?.portrait)
  const pl = item ? power(item) : null
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const costs = useMemo(() => {
    if (!item) return null
    try { return itemCosts(item, 'ore') } catch { return null }
  }, [item])
  const { options, step } = useMemo(() => (item ? upgradeOptions(item, record) : { options: [], step: null }), [item, record])
  const where = detail.location ? [detail.location.category.name, detail.location.page.name, detail.location.section.name !== slot.name && detail.location.section.name].filter(Boolean).join(' · ') : null
  const level = item ? Math.min(item.level, 50) : 0

  const run = async (option: UpgradeOption) => {
    if (confirming !== option.key) {
      setConfirming(option.key)
      return
    }
    setConfirming(null)
    setBusy(option.key)
    try {
      await window.electronAPI.upgradeCollectionBookItem(accountId, option.request)
      toast.success(`${slot.name}: ${option.title.toLowerCase()} done.`)
      onUpgraded()
    } catch (cause) {
      toast.error(ipcMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[13rem_1fr]">
      {/* The game's inspect card: the art large on its rarity, stars and power under it. */}
      <div className="space-y-3">
        <Artboard className="relative aspect-[3/4] w-full overflow-hidden rounded-xl" rarity={art.rarity}>
          {art.imgUrl && <img alt="" className={cn('absolute inset-0 size-full object-contain p-2 drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)]', !item && 'opacity-40 grayscale')} decoding="async" src={art.largeImgUrl ?? art.imgUrl} />}
        </Artboard>
        {item && (
          <div className="flex items-center justify-between gap-2">
            <Stars tier={step?.tier ?? record?.tier ?? 0} />
            {pl !== null && <span className="inline-flex items-center gap-1 text-sm"><Zap className="size-4 text-primary" /><span className="figure font-semibold">{pl}</span></span>}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-5">
        <div>
          <DialogTitle className="text-display-sm leading-tight">{slot.name}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {[slot.rarity || null, record?.subType, record?.displayTier].filter(Boolean).join(' · ')}
            {where && <><br />{where}</>}
          </DialogDescription>
          {item && (item.personality || item.teamBonus) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {item.personality && <>{slot.rarity === 'Mythic' ? 'Fixed personality' : 'Personality'}: <span className="text-foreground">{trait(item.personality)}</span></>}
              {item.personality && item.teamBonus && ' · '}
              {item.teamBonus && <>Team bonus: <span className="text-foreground">{trait(item.teamBonus)}</span></>}
            </p>
          )}
        </div>

        {item ? (
          <>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm">Level <span className="figure text-display-sm font-semibold">{level}</span>{step && <span className="figure text-muted-foreground"> / {step.cap}</span>}</span>
                {step && <span className="text-xs text-muted-foreground">{level >= 50 ? 'Maximum level' : step.cap < 50 ? `Star cap ${step.cap} · max 50 after evolving` : 'Max 50'}</span>}
              </div>
              <ProgressBar className="mt-2" label={`Level ${level} of ${step?.cap ?? 50}`} total={step?.cap ?? 50} value={level} />
            </div>

            <DetailSection icon={ArrowUpCircle} title="Upgrade">
              {!step ? (
                <Callout tone="info">Upgrade costs are unavailable for this item, so upgrading is not offered here.</Callout>
              ) : options.length === 0 ? (
                <Callout tone="success">At maximum level for its rarity.</Callout>
              ) : (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-lg bg-surface/60">
                  {options.map((option) => {
                    const short = option.cost ? Object.entries(option.cost).some(([id, n]) => n > (resources[id] ?? 0)) : false
                    const Icon = option.icon
                    return (
                      <li className="flex flex-wrap items-center gap-3 px-3 py-2.5" key={option.key}>
                        <Icon className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-ui font-semibold">{option.title}</p>
                          <p className="text-2xs text-muted-foreground">{option.hint}</p>
                          {option.cost && <div className="mt-1.5"><CostList cost={option.cost} label={label} records={records} resources={resources} /></div>}
                        </div>
                        <Button
                          disabled={busy !== null || short}
                          onClick={() => run(option)}
                          size="sm"
                          title={short ? 'Not enough materials in the campaign inventory' : undefined}
                          variant={confirming === option.key ? 'destructive' : 'secondary'}
                        >
                          {busy === option.key ? 'Upgrading…' : confirming === option.key ? 'Confirm — spends materials' : short ? 'Not enough' : 'Upgrade'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </DetailSection>

            {costs?.needsUpgrade && (
              <DetailSection icon={Layers} title={`Everything to reach level ${costs.maxLevel}`}>
                <CostList cost={costs.remaining} label={label} records={records} resources={resources} />
                {costs.choices && <p className="mt-2 text-xs text-muted-foreground">Where evolution can go either way, the ore path is priced.</p>}
              </DetailSection>
            )}

            {item.alterations.length > 0 && (
              <DetailSection icon={Sparkles} title="Perks on this copy">
                <ul className="space-y-1.5">
                  {item.alterations.map((a, n) => (
                    <PerkSlotRow id={a} index={n} key={n} title={getItemRecord(records, a)?.description?.replace(/<[^>]+>/g, '') || label(a)} />
                  ))}
                </ul>
              </DetailSection>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <KeyValue copyable label="Template" value={item.templateId} />
              <KeyValue copyable label="Copy id" value={item.id} />
            </div>
          </>
        ) : (
          <>
            <Callout tone={owned.length ? 'success' : 'info'}>
              {owned.length
                ? `Empty slot. You own ${owned.length} matching cop${owned.length === 1 ? 'y' : 'ies'} that could fill it — slot one in game.`
                : 'Empty slot. No matching copy in the campaign inventory.'}
            </Callout>
            {owned.length > 0 && (
              <DetailSection icon={Layers} title="Copies you own">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5">
                  {owned.map((copy) => (
                    <ItemTile className="w-full" key={copy.id} name={`Lv ${copy.level}`} portrait={copy.portrait} power={power(copy)} records={records} size="small" templateId={copy.templateId} title={`${label(copy.templateId)} · Level ${copy.level}`} />
                  ))}
                </div>
              </DetailSection>
            )}
          </>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Upgrades happen in the book, as in game, and spend XP and materials from the campaign inventory. They cannot be undone. Slotting and rarity upgrades are still done in game.
        </p>
      </div>
    </div>
  )
}
