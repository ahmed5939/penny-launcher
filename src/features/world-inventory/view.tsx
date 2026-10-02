import type { ItemRecord, ItemRecordMap } from '../../kernel/core/item-database'
import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import type { WorldInventory, WorldInventoryLocation, WorldItem, WorldTransfer } from './model'

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Backpack, BrickWall, Compass, Crosshair, Gem, Info, Package, Sword, Warehouse, X, Zap } from 'lucide-react'

import { useItemDatabaseStore } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { worldItemDisplay, worldPerkDisplay, rollColors } from './display'
import resources from '../../data/resources.json'
import ingredients from '../../data/ingredients.json'

import { toast } from '../../lib/notifications'

import { Button } from '../../components/ui/button'
import { ContextMenuItem, ContextMenuLabel, ContextMenuSeparator } from '../../components/ui/context-menu'
import { Input } from '../../components/ui/input'
import { ItemDetailDialog } from '../../components/items/item-detail'
import { ItemTile } from '../../components/items/item-tile'
import { DetailSection } from '../../components/items/detail-parts'
import { AccountResourceGate, Chip, EmptyState, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, RefreshButton, SearchField, Segmented, ToolBadges, useAccountResource } from '../../components/page'

/** The two sides stacks move between. The Ventures backpack is view-only. */
type Side = Exclude<WorldInventoryLocation, 'ventures'>

const copy: Record<Side, { title: string; icon: LucideIcon; empty: string; moveTo: string }> = {
  backpack: { title: 'Backpack', icon: Backpack, empty: 'Nothing of this kind in the backpack.', moveTo: 'storage' },
  storage: { title: 'Storage', icon: Warehouse, empty: 'Nothing of this kind in storage.', moveTo: 'backpack' },
}

const fallbackNames = { ...resources, ...ingredients } as Record<string, { name: string }>

/**
 * The template prefix is Epic's word for a category, not the game's.
 * These are the names the in-game backpack tabs use.
 */
const categoryLabels: Record<string, string> = {
  AccountResource: 'Account resources',
  Ammo: 'Ammunition',
  Gadget: 'Gadgets',
  Ingredient: 'Crafting materials',
  Trap: 'Traps',
  Weapon: 'Weapons',
  WorldItem: 'Building materials',
}

function categoryLabel(category: string) {
  return categoryLabels[category] ?? category.replace(/([a-z])([A-Z])/g, '$1 $2')
}

/** The in-game storage screen's tabs, in its order. Anything else lands on the last one. */
const tabs = [
  { value: 'Weapon', label: 'Weapons', icon: Sword },
  { value: 'Trap', label: 'Traps', icon: Zap },
  { value: 'Ammo', label: 'Ammunition', icon: Crosshair },
  { value: 'Ingredient', label: 'Crafting materials', icon: Gem },
  { value: 'WorldItem', label: 'Building materials', icon: BrickWall },
  { value: 'other', label: 'Everything else', icon: Package },
]

function tabOf(category: string) {
  return tabs.some((t) => t.value === category) ? category : 'other'
}

/** The game sorts each tab best-first. */
const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']

function rarityRank(rarity: string | null | undefined) {
  const index = rarityOrder.indexOf((rarity ?? '').toLowerCase())
  return index === -1 ? rarityOrder.length : index
}

function itemName(id: string, records: ItemRecordMap) {
  return worldItemDisplay(id, records)?.name ?? fallbackNames[id.split(':')[1]]?.name ?? (id.split(':')[1] ?? id).replaceAll('_', ' ')
}

/** One tab's stacks matching the search, best first. */
function stacksFor(items: WorldItem[], tab: string, query: string, records: ItemRecordMap) {
  const q = query.trim().toLowerCase()
  return items
    .filter((i) => tabOf(i.category) === tab && (!q || `${itemName(i.templateId, records)} ${i.templateId}`.toLowerCase().includes(q)))
    .sort((a, b) => {
      const da = worldItemDisplay(a.templateId, records)
      const db = worldItemDisplay(b.templateId, records)
      return rarityRank(da?.rarity) - rarityRank(db?.rarity) || (db?.tier ?? 0) - (da?.tier ?? 0) || itemName(a.templateId, records).localeCompare(itemName(b.templateId, records)) || a.id.localeCompare(b.id)
    })
}

/** The category tabs, each with how many stacks it holds. */
function tabOptionsFor(items: WorldItem[]) {
  return tabs.map((t) => ({ ...t, label: `${t.label} (${items.filter((i) => tabOf(i.category) === t.value).length.toLocaleString()})` }))
}

/** Electron wraps a main-process throw in its own sentence; the user only needs ours. */
function ipcMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : ''
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || 'The transfer failed. Refresh and try again.'
}

/**
 * Crafted `Weapon:` ids are often absent from the live database, so the
 * bundled display snapshot supplies their name and art. Fold it under the
 * live records so the cards can draw them.
 */
function useTileRecords(records: ItemRecordMap, inventories: WorldInventory[]) {
  return useMemo(() => {
    const merged: ItemRecordMap = { ...records }
    for (const item of inventories.flatMap((i) => i.items)) {
      const key = item.templateId.toLowerCase()
      if (merged[key]) continue
      const display = worldItemDisplay(item.templateId, records)
      if (!display) continue
      merged[key] = { name: display.name, description: display.description, rarity: display.rarity, tier: display.tier, image: display.image, largeImage: display.largeImage, displayTier: display.displayTier } as unknown as ItemRecord
    }
    return merged
  }, [records, ...inventories])
}

type View = 'world' | 'ventures'

const viewOptions: Array<{ value: View; label: string }> = [
  { value: 'world', label: 'Backpack & storage' },
  { value: 'ventures', label: 'Ventures' },
]

/**
 * Backpack and Storage side by side, the way the game's Storm Shield storage
 * screen lays them out: the same category tabs over both, six items to a
 * row, and a transfer strip under each side. Both routes land here. The
 * Ventures backpack is a third profile, switched to from the header.
 */
export function BackpackPage() {
  return <WorldInventoryPage />
}

export function StoragePage() {
  return <WorldInventoryPage />
}

function WorldInventoryPage() {
  useRequestItemDatabase()
  const [view, setView] = useState<View>('world')
  const switcher = <Segmented onChange={setView} options={viewOptions} value={view} />

  return view === 'ventures' ? <VenturesBackpack switcher={switcher} /> : <BackpackAndStorage switcher={switcher} />
}

type BothSides = { accountId: string; backpack: WorldInventory; storage: WorldInventory }

function BackpackAndStorage({ switcher }: { switcher: ReactNode }) {
  const resource = useAccountResource(
    async (accountId): Promise<BothSides> => {
      const [backpack, storage] = await Promise.all([
        window.electronAPI.requestWorldInventory(accountId, 'backpack'),
        window.electronAPI.requestWorldInventory(accountId, 'storage'),
      ])
      return { accountId, backpack, storage }
    },
    { cacheKey: 'stw.world-inventory.both', owner: (result) => result.accountId }
  )

  return (
    <div className="space-y-5">
      <PageHeader
        actions={<>{switcher}<RefreshButton disabled={!resource.accountId} loading={resource.loading} onClick={resource.refresh} /></>}
        description="Your backpack and Storm Shield storage side by side, as in game. Select items and move them across; perks are read from each copy."
        icon={Backpack}
        section="Save the World"
        status={<ToolBadges beta />}
        title="Backpack & Storage"
      />
      <AccountResourceGate icon={Backpack} resource={resource} what="the backpack and storage">
        {(data) => <Contents data={data} key={data.accountId} onChanged={resource.refresh} refreshing={resource.loading} />}
      </AccountResourceGate>
    </div>
  )
}

function VenturesBackpack({ switcher }: { switcher: ReactNode }) {
  const resource = useAccountResource(
    (accountId) => window.electronAPI.requestWorldInventory(accountId, 'ventures'),
    { cacheKey: 'stw.world-inventory.ventures', owner: (result) => result.accountId }
  )

  return (
    <div className="space-y-5">
      <PageHeader
        actions={<>{switcher}<RefreshButton disabled={!resource.accountId} loading={resource.loading} onClick={resource.refresh} /></>}
        description="What you carry in Ventures this season. The game keeps it apart from storage."
        icon={Compass}
        section="Save the World"
        status={<ToolBadges beta readOnly />}
        title="Ventures Backpack"
      />
      <AccountResourceGate icon={Compass} loading={{ title: 'Loading the Ventures backpack…', description: 'Reading the account profile from Epic.' }} resource={resource} what="the Ventures backpack">
        {(inventory) => <VenturesContents inventory={inventory} key={inventory.accountId} />}
      </AccountResourceGate>
    </div>
  )
}

function VenturesContents({ inventory }: { inventory: WorldInventory }) {
  const records = useTileRecords(useItemDatabaseStore((s) => s.records), [inventory])
  const ratings = useItemDatabaseStore((s) => s.ratings)
  const [tab, setTab] = useState('Weapon')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<WorldItem | null>(null)
  const shown = useMemo(() => stacksFor(inventory.items, tab, query, records), [inventory, tab, query, records])

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented onChange={setTab} options={tabOptionsFor(inventory.items)} value={tab} />
        <SearchField className="w-64" label="Search the Ventures backpack" onChange={setQuery} placeholder="Item name" value={query} />
      </div>

      <Panel>
        <PanelHeader
          actions={<span className="text-xs text-muted-foreground"><span className="figure text-foreground">{shown.length.toLocaleString()}</span> here · <span className="figure">{inventory.items.length.toLocaleString()}</span> stacks in all</span>}
          as="div"
          compact
          icon={Compass}
          title="Ventures backpack"
        />
        <PanelBody className="min-h-72 px-3 py-3">
          {shown.length > 0 ? (
            <StackGrid
              className="grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))]"
              items={shown}
              onClick={(item) => setDetail(item)}
              records={records}
            />
          ) : (
            <EmptyState
              className="border-0 bg-transparent py-8"
              description={query ? 'Nothing matches the search.' : inventory.items.length ? 'Nothing of this kind in the Ventures backpack.' : 'Play a Ventures mission this season to fill it.'}
              icon={Compass}
              title="Nothing here"
            />
          )}
        </PanelBody>
      </Panel>

      <WorldItemDialog item={detail} onClose={() => setDetail(null)} ratings={ratings} records={records} />
    </>
  )
}

/** A tab's stacks as item tiles. Shared by both screens, so a stack looks the same in either. */
function StackGrid({ busy, className, items, menu, onClick, onDoubleClick, records, selectedIds }: {
  busy?: boolean
  className: string
  items: WorldItem[]
  /** Right-click items for one stack. */
  menu?: (item: WorldItem) => ReactNode
  onClick: (item: WorldItem, event: MouseEvent) => void
  onDoubleClick?: (item: WorldItem) => void
  records: ItemRecordMap
  selectedIds?: string[]
}) {
  return (
    <div className={`grid content-start gap-1.5 ${className}`}>
      {items.map((item) => {
        const display = worldItemDisplay(item.templateId, records)
        const name = itemName(item.templateId, records)
        const facts = [item.level !== null && `Level ${item.level}`, item.durability !== null && `Durability ${Math.round(item.durability)}`, item.quantity > 1 && `×${item.quantity.toLocaleString()}`].filter(Boolean)
        return (
          <ItemTile
            className="w-full"
            disabled={busy}
            key={item.id}
            locked={item.favorite}
            menu={menu?.(item)}
            name={name}
            onClick={(event) => onClick(item, event)}
            onDoubleClick={onDoubleClick && (() => onDoubleClick(item))}
            quantity={item.quantity}
            records={records}
            selected={selectedIds?.includes(item.id) ?? false}
            size="small"
            templateId={item.templateId}
            tier={display?.tier}
            title={[name, ...facts].join(' · ')}
          />
        )
      })}
    </div>
  )
}

type Selection = { side: Side; ids: string[]; amount: number }

function Contents({ data, onChanged, refreshing }: { data: BothSides; onChanged: () => void; refreshing: boolean }) {
  const records = useTileRecords(useItemDatabaseStore((s) => s.records), [data.backpack, data.storage])
  const ratings = useItemDatabaseStore((s) => s.ratings)
  const [tab, setTab] = useState('Weapon')
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [moving, setMoving] = useState(false)
  const [detail, setDetail] = useState<WorldItem | null>(null)
  const busy = moving || refreshing

  const name = (id: string) => itemName(id, records)

  const sides = useMemo(
    () => ({ backpack: stacksFor(data.backpack.items, tab, query, records), storage: stacksFor(data.storage.items, tab, query, records) }),
    [data, tab, query, records]
  )

  const tabOptions = tabOptionsFor([...data.backpack.items, ...data.storage.items])

  const pick = (side: Side, item: WorldItem, event: MouseEvent) => {
    setSelection((current) => {
      const additive = event.ctrlKey || event.metaKey
      if (additive && current?.side === side) {
        const ids = current.ids.includes(item.id) ? current.ids.filter((id) => id !== item.id) : [...current.ids, item.id]
        return ids.length ? { side, ids, amount: ids.length === 1 ? find(side, ids[0])?.quantity ?? 1 : 0 } : null
      }
      if (current?.side === side && current.ids.length === 1 && current.ids[0] === item.id) return null
      return { side, ids: [item.id], amount: item.quantity }
    })
  }

  const find = (side: Side, id: string) => data[side].items.find((i) => i.id === id)

  const move = async (side: Side, transfers: WorldTransfer[]) => {
    setMoving(true)
    try {
      await window.electronAPI.transferWorldItems(data.accountId, transfers)
      toast.success(`Moved ${transfers.length === 1 ? name(find(side, transfers[0].itemId)?.templateId ?? '') : `${transfers.length} stacks`} to ${copy[side].moveTo}.`)
      setSelection(null)
      onChanged()
    } catch (cause) {
      toast.error(ipcMessage(cause))
    } finally {
      setMoving(false)
    }
  }

  const moveSelection = (side: Side) => {
    if (!selection || selection.side !== side) return
    const single = selection.ids.length === 1
    move(side, selection.ids.flatMap((id) => {
      const item = find(side, id)
      if (!item) return []
      const quantity = single ? Math.min(Math.max(1, Math.floor(selection.amount) || 1), item.quantity) : item.quantity
      return [{ itemId: id, quantity, toStorage: side === 'backpack' }]
    }))
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented onChange={(value) => { setTab(value); setSelection(null) }} options={tabOptions} value={tab} />
        <SearchField className="w-64" label="Search both sides" onChange={setQuery} placeholder="Item name" value={query} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(['backpack', 'storage'] as const).map((side) => {
          const selected = selection?.side === side ? selection : null
          const single = selected?.ids.length === 1 ? find(side, selected.ids[0]) : undefined
          const { title, icon, empty, moveTo } = copy[side]
          const Arrow = side === 'backpack' ? ArrowRight : ArrowLeft
          return (
            <Panel className="flex flex-col" key={side}>
              <PanelHeader
                actions={<span className="text-xs text-muted-foreground"><span className="figure text-foreground">{sides[side].length.toLocaleString()}</span> here · <span className="figure">{data[side].items.length.toLocaleString()}</span> stacks in all</span>}
                as="div"
                compact
                icon={icon}
                title={title}
              />
              <PanelBody className="h-[58vh] min-h-72 overflow-y-auto px-3 py-3">
                {sides[side].length > 0 ? (
                  <StackGrid
                    busy={busy}
                    className="grid-cols-6"
                    items={sides[side]}
                    menu={(item) => {
                      const inSelection = selected !== null && selected.ids.length > 1 && selected.ids.includes(item.id)
                      return (
                        <>
                          <ContextMenuLabel className="truncate">{name(item.templateId)}</ContextMenuLabel>
                          <ContextMenuSeparator />
                          <ContextMenuItem onSelect={() => setDetail(item)}>
                            <Info className="mr-2 size-3.5" />
                            Details and perks
                          </ContextMenuItem>
                          <ContextMenuItem disabled={busy} onSelect={() => move(side, [{ itemId: item.id, quantity: item.quantity, toStorage: side === 'backpack' }])}>
                            <Arrow className="mr-2 size-3.5" />
                            {item.quantity > 1 ? `Move all ${item.quantity.toLocaleString()} to ${moveTo}` : `Move to ${moveTo}`}
                          </ContextMenuItem>
                          {inSelection && (
                            <ContextMenuItem disabled={busy} onSelect={() => moveSelection(side)}>
                              <Arrow className="mr-2 size-3.5" />
                              Move {selected?.ids.length} selected to {moveTo}
                            </ContextMenuItem>
                          )}
                        </>
                      )
                    }}
                    onClick={(item, event) => pick(side, item, event)}
                    onDoubleClick={(item) => move(side, [{ itemId: item.id, quantity: item.quantity, toStorage: side === 'backpack' }])}
                    records={records}
                    selectedIds={selected?.ids}
                  />
                ) : (
                  <EmptyState className="border-0 bg-transparent py-8" description={query ? 'Nothing matches the search.' : empty} icon={icon} title="Nothing here" />
                )}
              </PanelBody>
              <PanelFooter className="min-h-14 px-3 py-2.5">
                {selected ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-ui">
                      {single ? name(single.templateId) : <><span className="figure">{selected.ids.length}</span> stacks selected</>}
                    </span>
                    {single && single.quantity > 1 && (
                      <span className="flex items-center gap-1">
                        <Input
                          aria-label="Amount to move"
                          className="figure h-8 w-20"
                          max={single.quantity}
                          min={1}
                          onChange={(event) => setSelection({ ...selected, amount: Number(event.target.value) })}
                          type="number"
                          value={selected.amount || ''}
                        />
                        <Button onClick={() => setSelection({ ...selected, amount: single.quantity })} size="sm" variant="ghost">All</Button>
                      </span>
                    )}
                    {single && (
                      <Button onClick={() => setDetail(single)} size="sm" variant="ghost"><Info className="size-4" />Details</Button>
                    )}
                    <Button aria-label="Clear selection" onClick={() => setSelection(null)} size="icon" variant="ghost"><X className="size-4" /></Button>
                    <Button disabled={busy} onClick={() => moveSelection(side)} size="sm">
                      {side === 'storage' && <Arrow className="size-4" />}
                      Move to {moveTo}
                      {side === 'backpack' && <Arrow className="size-4" />}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Click to select (Ctrl for several), double-click to move a stack, right-click for details and perks.</span>
                )}
              </PanelFooter>
            </Panel>
          )
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Transfers use the same Storm Shield storage call as the game; Epic refuses them when the other side is full or the item cannot be stored. Names and art come from the item database, or a bundled snapshot for crafted weapons it lacks. Read at {new Date(data.backpack.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — refresh after changing anything in game.
      </p>

      <WorldItemDialog item={detail} onClose={() => setDetail(null)} ratings={ratings} records={records} />
    </>
  )
}

/**
 * The item dialog every other screen opens, read-only. A backpack copy's
 * perks come from the bundled perk table — crafted weapons roll ids the
 * database often lacks — so each row carries that name and its rarity.
 */
function WorldItemDialog({ item, onClose, ratings, records }: {
  item: WorldItem | null
  onClose: () => void
  ratings: ComponentProps<typeof ItemDetailDialog>['ratings']
  records: ItemRecordMap
}) {
  const perks = (item?.alterationSlots ?? item?.alterations ?? []).filter((id): id is string => Boolean(id))
  const graded = item !== null && (item.level !== null || perks.length > 0)

  return (
    <ItemDetailDialog
      onOpenChange={(open) => { if (!open) onClose() }}
      perkDetails={perks.map((id) => {
        const perk = worldPerkDisplay(id, records)
        const color = perk.rarity ? rollColors[perk.rarity] : null
        return {
          name: perk.description,
          tags: (
            <>
              {perk.rarity ? <Chip><span style={{ color: color ?? undefined }}>{perk.rarity}</span></Chip> : <Chip tone="warning">Rarity unavailable</Chip>}
              {perk.system === 'legacy' && <Chip tone="accent">Legacy</Chip>}
            </>
          ),
        }
      })}
      ratings={ratings}
      records={records}
      subject={item && {
        alterations: graded ? perks : undefined,
        level: item.level ?? undefined,
        lockedReason: item.favorite ? 'favorite' : null,
        templateId: item.templateId,
      }}
    >
      {item && (
        <DetailSection icon={Package} title="This stack">
          <div className="grid gap-2 sm:grid-cols-2">
            <KeyValue label="Category" value={categoryLabel(item.category)} />
            <KeyValue label="Quantity" value={item.quantity.toLocaleString()} />
            {item.durability !== null && (
              <KeyValue label="Durability" value={item.durability.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
            )}
            <KeyValue copyable label="Stack id" value={item.id} />
          </div>
        </DetailSection>
      )}
    </ItemDetailDialog>
  )
}
