import type { ItemRecord, ItemRecordMap } from '../../kernel/core/item-database'
import type { WorldInventory, WorldInventoryLocation, WorldItem } from './model'

import { useMemo, useState } from 'react'
import { Backpack, Boxes, Layers, Sparkles, Star, Warehouse } from 'lucide-react'

import { useItemDatabaseStore } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { worldItemDisplay, worldPerkDisplay, rollColors } from './display'
import resources from '../../data/resources.json'
import ingredients from '../../data/ingredients.json'

import { Dialog, DialogContent } from '../../components/ui/dialog'
import { ItemCard, ItemCardGrid } from '../../components/items/item-card'
import { DetailHeader, DetailSection, PerkSlotRow } from '../../components/items/detail-parts'
import { AccountResourceGate, Chip, EmptyState, FilterBar, KeyValue, PageHeader, Pager, Panel, PanelBody, PanelHeader, Picker, RefreshButton, SearchField, Segmented, StatRow, StatTile, ToolBadges, paginate, useAccountResource } from '../../components/page'

const PAGE_SIZE = 60

const copy: Record<WorldInventoryLocation, { title: string; icon: typeof Backpack; description: string; empty: string }> = {
  backpack: {
    title: 'Backpack',
    icon: Backpack,
    description: 'What the account is carrying: crafted weapons and traps with their actual rolls, ammunition and materials.',
    empty: 'The backpack is empty.',
  },
  storage: {
    title: 'Storage',
    icon: Warehouse,
    description: 'Everything parked in Storm Shield storage, copy by copy.',
    empty: 'Storage is empty.',
  },
}

const fallbackNames = { ...resources, ...ingredients } as Record<string, { name: string }>

/**
 * Crafted `Weapon:` ids are often absent from the live database, so the
 * bundled display snapshot supplies their name and art. Fold it under the
 * live records so the cards can draw them.
 */
function useTileRecords(records: ItemRecordMap, inventory: WorldInventory | null) {
  return useMemo(() => {
    const merged: ItemRecordMap = { ...records }
    for (const item of inventory?.items ?? []) {
      const key = item.templateId.toLowerCase()
      if (merged[key]) continue
      const display = worldItemDisplay(item.templateId, records)
      if (!display) continue
      merged[key] = { name: display.name, description: display.description, rarity: display.rarity, tier: display.tier, image: display.image, largeImage: display.largeImage, displayTier: display.displayTier } as unknown as ItemRecord
    }
    return merged
  }, [records, inventory])
}

/**
 * Backpack and Storage are one page with a switch: the same kind of items in
 * two places, read the same way. Both routes land here; they only differ in
 * which side opens first.
 */
export function BackpackPage() {
  return <WorldInventoryPage initial="backpack" />
}

export function StoragePage() {
  return <WorldInventoryPage initial="storage" />
}

const locationOptions: Array<{ value: WorldInventoryLocation; label: string }> = [
  { value: 'backpack', label: 'Backpack' },
  { value: 'storage', label: 'Storage' },
]

function WorldInventoryPage({ initial }: { initial: WorldInventoryLocation }) {
  useRequestItemDatabase()
  const [location, setLocation] = useState<WorldInventoryLocation>(initial)
  const resource = useAccountResource((accountId) => window.electronAPI.requestWorldInventory(accountId, location), {
    deps: [location],
    owner: (result) => result.accountId,
  })
  const { title, icon } = copy[location]

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Segmented onChange={setLocation} options={locationOptions} value={location} />
            <RefreshButton disabled={!resource.accountId} loading={resource.loading} onClick={resource.refresh} />
          </>
        }
        description="Crafted weapons and traps with their actual rolls, ammunition and materials — what the account carries, and what is parked in Storm Shield storage."
        icon={Backpack}
        section="Save the World"
        status={<ToolBadges beta readOnly />}
        title="Backpack & Storage"
      />
      <AccountResourceGate icon={icon} resource={resource} what={`the ${title.toLowerCase()}`}>
        {(data) => <Contents data={data} key={`${data.accountId}:${location}`} location={location} />}
      </AccountResourceGate>
    </div>
  )
}

function Contents({ data, location }: { data: WorldInventory; location: WorldInventoryLocation }) {
  const records = useTileRecords(useItemDatabaseStore((s) => s.records), data)
  const { icon: Icon, empty, title, description } = copy[location]
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<WorldItem | null>(null)

  const name = (id: string) =>
    worldItemDisplay(id, records)?.name ?? fallbackNames[id.split(':')[1]]?.name ?? (id.split(':')[1] ?? id).replaceAll('_', ' ')

  const categories = useMemo(() => [...new Set(data.items.map((i) => i.category))].sort(), [data])
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.items
      .filter((i) => (category === 'all' || i.category === category) && (!q || `${name(i.templateId)} ${i.templateId}`.toLowerCase().includes(q)))
      .sort((a, b) => name(a.templateId).localeCompare(name(b.templateId)) || a.id.localeCompare(b.id))
    // `name` reads `records`, which is the dependency that matters.
  }, [data, category, query, records])
  const shown = paginate(items, page, PAGE_SIZE)
  const totalUnits = data.items.reduce((n, i) => n + i.quantity, 0)
  const favourites = data.items.filter((i) => i.favorite).length

  return (
    <>
      <StatRow>
        <StatTile icon={Boxes} label="Stacks" value={data.items.length.toLocaleString()} />
        <StatTile icon={Layers} label="Items in total" value={totalUnits.toLocaleString()} />
        <StatTile icon={Star} label="Favourited" value={favourites.toLocaleString()} />
        <StatTile hint={`Updated ${new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} label="Item types" value={categories.length.toLocaleString()} />
      </StatRow>

      <Panel>
        <PanelHeader
          actions={<span className="micro-label">{items.length.toLocaleString()} of {data.items.length.toLocaleString()} stacks</span>}
          description={`${description} Perk rolls are read from each copy, never from a schematic.`}
          icon={Icon}
          title={title}
        />
        <FilterBar>
          <SearchField label="Search items" onChange={(v) => { setQuery(v); setPage(0) }} placeholder="Item name or template id" value={query} />
          <Picker label="Item type" onChange={(v) => { setCategory(v); setPage(0) }} options={[{ value: 'all', label: 'All item types' }, ...categories.map((c) => ({ value: c, label: c }))]} value={category} />
        </FilterBar>

        <PanelBody>
          {shown.items.length > 0 ? (
            <ItemCardGrid>
              {shown.items.map((item) => {
                const rolls = (item.alterationSlots ?? item.alterations).filter(Boolean).length
                return (
                  <ItemCard
                    favorite={item.favorite}
                    footer={
                      item.durability !== null
                        ? <span>Durability <span className="figure text-foreground">{item.durability.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>{rolls ? ` · ${rolls} perk${rolls === 1 ? '' : 's'}` : ''}</span>
                        : undefined
                    }
                    key={item.id}
                    level={item.level}
                    name={name(item.templateId)}
                    onClick={() => setDetail(item)}
                    quantity={item.quantity}
                    records={records}
                    subtitle={item.category}
                    templateId={item.templateId}
                    tier={worldItemDisplay(item.templateId, records)?.tier}
                  />
                )
              })}
            </ItemCardGrid>
          ) : (
            <EmptyState className="border-0 bg-transparent py-8" description={data.items.length ? 'Nothing matches the current search or type filter.' : empty} icon={Icon} title={data.items.length ? 'No matches' : 'Nothing here'} />
          )}
        </PanelBody>
        <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={items.length} />
      </Panel>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Names and artwork come from the launcher item database where it has them and from a bundled snapshot otherwise; unknown items keep their template id. Refresh after changing anything in game.
      </p>

      <Dialog onOpenChange={(open) => { if (!open) setDetail(null) }} open={detail !== null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {detail && <Detail item={detail} name={name(detail.templateId)} records={records} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Detail({ item, name, records }: { item: WorldItem; name: string; records: ItemRecordMap }) {
  const display = worldItemDisplay(item.templateId, records)
  const slots = item.alterationSlots ?? item.alterations

  return (
    <>
      <DetailHeader
        description={display?.description}
        facts={
          <>
            <span>Quantity <span className="figure">{item.quantity.toLocaleString()}</span></span>
            {item.level !== null && <span>Level <span className="figure">{item.level}</span></span>}
            {item.durability !== null && <span>Durability <span className="figure">{item.durability.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>}
            {item.favorite && <span className="inline-flex items-center gap-1"><Star className="size-3" /> Favourited</span>}
          </>
        }
        meta={[item.category, display?.displayTier, (display?.tier ?? 0) > 0 && `Tier ${display?.tier}`]}
        name={name}
        rarity={display?.rarity}
        records={records}
        templateId={item.templateId}
      />

      {slots.length > 0 && (
        <DetailSection icon={Sparkles} title="Perks on this copy">
          <ul className="space-y-1.5">
            {slots.map((id, index) => {
              const perk = worldPerkDisplay(id, records)
              const color = perk.rarity ? rollColors[perk.rarity] : null
              return (
                <PerkSlotRow accent={color} empty={!id} id={id} index={index} key={index} title={perk.description}>
                  {id && (perk.rarity ? <Chip><span style={{ color: color ?? undefined }}>{perk.rarity}</span></Chip> : <Chip tone="warning">Rarity unavailable</Chip>)}
                  {perk.system === 'legacy' && <Chip tone="accent">Legacy</Chip>}
                </PerkSlotRow>
              )
            })}
          </ul>
        </DetailSection>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <KeyValue copyable label="Template" value={item.templateId} />
        <KeyValue copyable label="Stack id" value={item.id} />
      </div>
    </>
  )
}
