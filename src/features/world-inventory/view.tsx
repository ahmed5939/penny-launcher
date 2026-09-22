import type { ItemRecord, ItemRecordMap } from '../../kernel/core/item-database'
import type { WorldInventory, WorldInventoryLocation, WorldItem } from './model'

import { useEffect, useMemo, useState } from 'react'
import { Backpack, Boxes, Layers, RefreshCw, Search, Sparkles, Star, Warehouse } from 'lucide-react'

import { useGetSelectedAccount } from '../../hooks/accounts'
import { useItemDatabaseStore } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { worldItemDisplay, worldPerkDisplay, rollColors } from './display'
import resources from '../../data/resources.json'
import ingredients from '../../data/ingredients.json'

import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { ItemCard, ItemCardGrid } from '../../components/items/item-card'
import { resolveItemArt } from '../../components/items/item-icon'
import { Callout, Chip, EmptyState, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, StatRow, StatTile, rarityStyle, rarityTypeFromName } from '../../components/page'

import { raritiesColor } from '../../config/constants/resources'
import { cn } from '../../lib/utils'

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
 * live records so the tiles can draw them.
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

export function BackpackPage() {
  return <WorldInventoryPage location="backpack" />
}

export function StoragePage() {
  return <WorldInventoryPage location="storage" />
}

function WorldInventoryPage({ location }: { location: WorldInventoryLocation }) {
  useRequestItemDatabase()
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId
  const liveRecords = useItemDatabaseStore((s) => s.records)

  const [data, setData] = useState<WorldInventory | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempt, refresh] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<WorldItem | null>(null)

  useEffect(() => {
    let active = true
    setData(null)
    setDetail(null)
    setError('')
    setPage(0)
    setCategory('all')
    setQuery('')
    if (!accountId) {
      setLoading(false)
      return
    }
    setLoading(true)
    window.electronAPI
      .requestWorldInventory(accountId, location)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load this inventory. Refresh to retry.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [accountId, location, attempt])

  const current = data && data.accountId === accountId && data.location === location ? data : null
  const records = useTileRecords(liveRecords, current)
  const { title, icon: Icon, description, empty } = copy[location]

  const name = (id: string) =>
    worldItemDisplay(id, records)?.name ?? fallbackNames[id.split(':')[1]]?.name ?? (id.split(':')[1] ?? id).replaceAll('_', ' ')

  const categories = useMemo(() => [...new Set((current?.items ?? []).map((i) => i.category))].sort(), [current])
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (current?.items ?? [])
      .filter((i) => (category === 'all' || i.category === category) && (!q || `${name(i.templateId)} ${i.templateId}`.toLowerCase().includes(q)))
      .sort((a, b) => name(a.templateId).localeCompare(name(b.templateId)) || a.id.localeCompare(b.id))
  }, [current, category, query, records])
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const visible = items.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const totalUnits = current?.items.reduce((n, i) => n + i.quantity, 0) ?? 0
  const favourites = current?.items.filter((i) => i.favorite).length ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button disabled={!accountId || loading} onClick={() => refresh((n) => n + 1)} variant="outline">
            <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
        description={description}
        icon={Icon}
        section="Save the World"
        status={
          <>
            <Chip tone="accent">Beta</Chip>
            <Chip>Read-only</Chip>
          </>
        }
        title={title}
      />

      {!accountId ? (
        <EmptyState description={`Select an account in the title bar to view its ${title.toLowerCase()}.`} icon={Icon} title="Choose an account" />
      ) : error ? (
        <div role="alert">
          <Callout title={`Could not load the ${title.toLowerCase()}`} tone="danger">{error}</Callout>
        </div>
      ) : loading && !current ? (
        <div role="status">
          <EmptyState description="Reading the profile from Epic." icon={Icon} title={`Loading the ${title.toLowerCase()}…`} />
        </div>
      ) : current ? (
        <>
          <StatRow>
            <StatTile icon={Boxes} label="Stacks" value={current.items.length.toLocaleString()} />
            <StatTile icon={Layers} label="Items in total" value={totalUnits.toLocaleString()} />
            <StatTile icon={Star} label="Favourited" value={favourites.toLocaleString()} />
            <StatTile hint={`Updated ${new Date(current.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} label="Item types" value={categories.length.toLocaleString()} />
          </StatRow>

          <Panel>
            <PanelHeader
              actions={<span className="micro-label">{items.length.toLocaleString()} of {current.items.length.toLocaleString()} stacks</span>}
              description="Each stack is its own entry. Perk rolls are read from the copy itself, never from a schematic."
              title="Contents"
            />
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
              <span className="relative min-w-52 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search items" className="pl-9" onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder="Item name or template id" value={query} />
              </span>
              <Select onValueChange={(v) => { setCategory(v); setPage(0) }} value={category}>
                <SelectTrigger aria-label="Item type" className="w-auto min-w-40 gap-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All item types</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {visible.length > 0 ? (
              <PanelBody>
                <ItemCardGrid>
                  {visible.map((item) => {
                    const display = worldItemDisplay(item.templateId, records)
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
                        tier={display?.tier}
                        title={`${name(item.templateId)} · ${item.quantity.toLocaleString()}`}
                      />
                    )
                  })}
                </ItemCardGrid>
              </PanelBody>
            ) : (
              <PanelBody>
                <EmptyState className="border-0 bg-transparent py-8" description={current.items.length ? 'Nothing matches the current search or type filter.' : empty} icon={Icon} title={current.items.length ? 'No matches' : 'Nothing here'} />
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

          <p className="text-xs leading-relaxed text-muted-foreground">
            Names and artwork come from the launcher item database where it has them and from a bundled snapshot otherwise; unknown items keep their template id. Refresh after changing anything in game.
          </p>
        </>
      ) : null}

      <Dialog onOpenChange={(open) => { if (!open) setDetail(null) }} open={detail !== null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {detail && <Detail item={detail} name={name(detail.templateId)} records={records} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Detail({ item, name, records }: { item: WorldItem; name: string; records: ItemRecordMap }) {
  const display = worldItemDisplay(item.templateId, records)
  const art = resolveItemArt(item.templateId, records)
  const rarity = rarityTypeFromName(display?.rarity ?? null)
  const accent = rarity ? raritiesColor[rarity] : null
  const slots = item.alterationSlots ?? item.alterations

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
            <DialogTitle className="text-left text-lg leading-tight">{name}</DialogTitle>
            <p className={cn('micro-label mt-1.5', accent && 'text-[color:var(--rarity)]')} style={rarityStyle(accent)}>
              {[display?.rarity, item.category, display?.displayTier, (display?.tier ?? 0) > 0 && `Tier ${display?.tier}`].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>Quantity <span className="figure">{item.quantity.toLocaleString()}</span></span>
              {item.level !== null && <span>Level <span className="figure">{item.level}</span></span>}
              {item.durability !== null && <span>Durability <span className="figure">{item.durability.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>}
              {item.favorite && <span className="inline-flex items-center gap-1"><Star className="size-3" /> Favourited</span>}
            </p>
          </div>
        </div>
        {display?.description && <DialogDescription className="mt-3 whitespace-pre-line text-left leading-relaxed">{display.description}</DialogDescription>}
      </DialogHeader>

      {slots.length > 0 && (
        <section className="space-y-2">
          <p className="section-label flex items-center gap-1.5"><Sparkles className="size-3 text-muted-foreground" />Perks on this copy</p>
          <ul className="space-y-1.5">
            {slots.map((id, index) => {
              const perk = worldPerkDisplay(id, records)
              const color = perk.rarity ? rollColors[perk.rarity] : null
              return (
                <li className="panel px-3 py-2" key={index} style={color ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined}>
                  <div className="flex items-start gap-2">
                    <span className="micro-label mt-0.5 w-10 shrink-0">Slot {index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-xs font-semibold', !id && 'text-muted-foreground')}>{perk.description}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1">
                        {id && (perk.rarity ? <Chip><span style={{ color: color ?? undefined }}>{perk.rarity}</span></Chip> : <Chip tone="warning">Rarity unavailable</Chip>)}
                        {perk.system === 'legacy' && <Chip tone="accent">Legacy</Chip>}
                      </p>
                      {id && <p className="mt-1 break-all text-[0.6875rem] text-muted-foreground">{id}</p>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <KeyValue copyable label="Template" value={item.templateId} />
        <KeyValue copyable label="Stack id" value={item.id} />
      </div>
    </>
  )
}
