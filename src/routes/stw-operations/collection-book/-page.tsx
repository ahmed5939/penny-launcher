import type { BookSlot } from '../../../features/collection-book/match'
import type { BookItem, CollectionBookData } from '../../../features/collection-book/types'

import { useMemo, useState } from 'react'
import { ArrowUpCircle, BookOpen, CheckCircle2, Layers, Search, Sparkles, Zap } from 'lucide-react'

import { Resources } from './-resources'
import { useItemDatabaseStore, getItemRecord } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { computeItemPower } from '../../../config/constants/fortnite/power'
import { prettifyWorkerTrait } from '../../../config/constants/fortnite/items'
import catalog from '../../../features/collection-book/catalog.json'
import { bookCosts } from '../../../features/collection-book/costs'
import { indexBookSlots } from '../../../features/collection-book/match'

import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent } from '../../../components/ui/dialog'
import { ItemCard, ItemCardGrid } from '../../../components/items/item-card'
import { DetailHeader, DetailSection, PerkSlotRow } from '../../../components/items/detail-parts'
import { AccountResourceGate, Callout, Chip, EmptyState, FilterBar, KeyValue, PageHeader, PageTabPanel, PageTabs, Pager, Panel, PanelBody, PanelHeader, Picker, RefreshButton, SearchField, StatRow, StatTile, ToolBadges, paginate, useAccountResource } from '../../../components/page'

type Detail = { slot: BookSlot; items: BookItem[]; owned: BookItem[]; location?: Location }
type Location = { category: (typeof catalog)[number]; page: (typeof catalog)[number]['pages'][number]; section: (typeof catalog)[number]['pages'][number]['sections'][number]; slot: BookSlot }

const statusOptions = [
  { value: 'all', label: 'All slots' },
  { value: 'slotted', label: 'Slotted' },
  { value: 'missing', label: 'Missing' },
  { value: 'ready', label: 'Missing · copy owned' },
]
const rarityOptions = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']
const upgradePageSize = 60

const locations: Location[] = catalog.flatMap((category) =>
  category.pages.flatMap((page) =>
    page.sections.flatMap((section) =>
      section.slots.map((slot) => ({ category, page, section, slot })))))
const allSlots = locations.map(({ slot }) => slot)
const locationBySlot = new Map(locations.map((location) => [location.slot, location]))
const totalSlots = allSlots.length
const emptyItems: BookItem[] = []

export function RouteComponent() {
  useRequestItemDatabase()
  const resource = useAccountResource((accountId) => window.electronAPI.requestCollectionBook(accountId), {
    fallbackError: 'Could not load the Collection Book. Refresh to retry.',
    owner: (result) => result.accountId,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        actions={<RefreshButton disabled={!resource.accountId} loading={resource.loading} onClick={resource.refresh} />}
        description="The live Epic Collection Book for the selected account. Browse slotted items, find empty slots you already own a copy for, and see what it would cost to finish the book."
        icon={BookOpen}
        section="Save the World"
        status={<ToolBadges beta readOnly />}
        title="Collection Book"
      />
      <AccountResourceGate
        icon={BookOpen}
        loading={{ title: 'Loading the Collection Book…', description: 'Reading the campaign profile and both book profiles from Epic.' }}
        resource={resource}
        what="the Collection Book"
      >
        {(data) => <Book current={data} key={data.accountId} />}
      </AccountResourceGate>
    </div>
  )
}

function Book({ current }: { current: CollectionBookData }) {
  const records = useItemDatabaseStore((s) => s.records)
  const ratings = useItemDatabaseStore((s) => s.ratings)
  const [categoryId, setCategory] = useState(catalog[0].id)
  const [pageId, setPage] = useState(catalog[0].pages[0].id)
  const [status, setStatus] = useState('all')
  const [rarity, setRarity] = useState('all')
  const [needsUpgrading, setNeedsUpgrading] = useState(false)
  const [upgradePage, setUpgradePage] = useState(0)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'collection' | 'resources'>('collection')
  const [detail, setDetail] = useState<Detail | null>(null)

  const upgradeTotals = useMemo(() => bookCosts(current.slotted, 'ore'), [current])
  const upgradeItems = useMemo(() => {
    const ids = new Set(upgradeTotals.upgradeIds)
    return current.slotted.filter((item) => ids.has(item.id))
  }, [current, upgradeTotals])
  const shownUpgrades = paginate(upgradeItems, upgradePage, upgradePageSize)
  const slotIndex = useMemo(() => ({
    slotted: indexBookSlots(allSlots, current.slotted),
    owned: indexBookSlots(allSlots, current.inventory),
  }), [current])

  const category = catalog.find((c) => c.id === categoryId) ?? catalog[0]
  const page = category.pages.find((p) => p.id === pageId) ?? category.pages[0]
  const slotted = (slot: BookSlot) => slotIndex.slotted.bySlot.get(slot) ?? emptyItems
  const owned = (slot: BookSlot) => slotIndex.owned.bySlot.get(slot) ?? emptyItems
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
                          {shownUpgrades.items.map((item) => {
                            const matchedSlot = slotIndex.slotted.firstSlotByItemId.get(item.id)
                            const location = matchedSlot ? locationBySlot.get(matchedSlot) : undefined
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
                    <Pager onPageChange={setUpgradePage} page={shownUpgrades.page} pageSize={upgradePageSize} total={upgradeItems.length} />
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
                    <FilterBar>
                      <Picker label="Category" onChange={(v) => { setCategory(v); setPage(catalog.find((c) => c.id === v)!.pages[0].id) }} options={catalog.map((c) => ({ value: c.id, label: c.name }))} value={category.id} />
                      <Picker label="Page" onChange={setPage} options={category.pages.map((p) => ({ value: p.id, label: p.name }))} value={page.id} />
                      <SearchField label="Find a slot" onChange={setQuery} placeholder="Slot or section name" value={query} />
                      <Picker label="Slot status" onChange={setStatus} options={statusOptions} value={status} />
                      <Picker label="Rarity" onChange={setRarity} options={[{ value: 'all', label: 'All rarities' }, ...rarityOptions.map((r) => ({ value: r, label: r }))]} value={rarity} />
                    </FilterBar>
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

      <Dialog onOpenChange={(open) => { if (!open) setDetail(null) }} open={detail !== null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {detail && <SlotDetail detail={detail} label={label} power={power} records={records} trait={trait} />}
        </DialogContent>
      </Dialog>
    </>
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
  const record = item ? getItemRecord(records, item.templateId) : null
  const pl = item ? power(item) : null

  return (
    <>
      <DetailHeader
        dimmed={!item}
        facts={
          <>
            {item ? <span>Level <span className="figure">{item.level}</span></span> : <span>Empty slot</span>}
            {item?.personality && <span>{slot.rarity === 'Mythic' ? 'Fixed personality' : 'Personality'}: {trait(item.personality)}</span>}
            {item?.teamBonus && <span>Team bonus: {trait(item.teamBonus)}</span>}
            {detail.location && <span>{detail.location.category.name} · {detail.location.page.name} · {detail.location.section.name}</span>}
          </>
        }
        meta={[record?.subType, record?.displayTier]}
        name={slot.name}
        portrait={item?.portrait}
        power={pl}
        rarity={slot.rarity || null}
        records={records}
        templateId={item?.templateId ?? slot.templateId}
      />

      {item ? (
        <>
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
