import type { InventoryRow } from './-hooks'
import type { ItemActionRequest } from '../../../kernel/core/item-actions'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { ItemKind, Rarity } from '../../../config/constants/fortnite/items'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { LucideIcon } from 'lucide-react'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  ArrowUp,
  Boxes,
  CheckCheck,
  Hammer,
  Info,
  Lock,
  Recycle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldHalf,
  Sparkles,
  Star,
  Swords,
  Trash2,
  Users,
  UserX,
} from 'lucide-react'
import { memo, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { VirtualList } from '../../../components/virtual-list'
import { Input } from '../../../components/ui/input'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemIcon } from '../../../components/items/item-icon'
import { ItemTile } from '../../../components/items/item-tile'
import {
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '../../../components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  StatRow,
  StatTile,
  vaultRarityColors,
} from '../../../components/page'

import { itemKinds, useInventoryData } from './-hooks'

import { useColumnCount } from '../../../hooks/ui/virtual'
import { useStableCallback } from '../../../hooks/ui/stable-callback'

import {
  itemKindLabels,
  rarityLabels,
  rarityOrder,
} from '../../../config/constants/fortnite/items'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

/**
 * Kind is a tab, not a filter.
 *
 * It used to be four independent toggles sitting above two more rows of
 * "up to rarity" and "up to tier" segmented controls — three quarters of a
 * screen of chrome before the first item, and a set of switches you could
 * turn all the way off until the vault looked broken. Kinds are mutually
 * exclusive in every way that matters: nobody compares a survivor against a
 * sniper rifle. So they are tabs, they carry their own counts, and the
 * narrowing controls that remain are two dropdowns on one line.
 */
const kindIcons: Record<ItemKind, LucideIcon> = {
  defender: ShieldHalf,
  hero: Swords,
  schematic: Hammer,
  survivor: Users,
}

/** `itemKindLabels` is plural — a shelf of one still has to read right. */
const kindNouns: Record<ItemKind, [string, string]> = {
  defender: ['defender', 'defenders'],
  hero: ['hero', 'heroes'],
  schematic: ['schematic', 'schematics'],
  survivor: ['survivor', 'survivors'],
}

const tabs = itemKinds.map((kind) => ({
  icon: kindIcons[kind],
  label: itemKindLabels[kind],
  value: kind,
}))

/** Strongest first — the order a vault is worth reading in. */
const raritySections = [...rarityOrder].reverse()

/**
 * Both narrowing dropdowns are ceilings — a rarity or a tier and everything
 * under it — and they used to say so, in a "Up to Legendary" that read as
 * noise repeated six times down an open menu. The label is the rarity now,
 * and the tier is the game's own T1–T4.
 */
const rarityFilterOptions = raritySections.map((rarity) => ({
  label: rarityLabels[rarity],
  value: rarity,
}))

const tierFilterOptions = [
  { label: 'Any tier', value: '0' },
  { label: 'T1', value: '1' },
  { label: 'T2', value: '2' },
  { label: 'T3', value: '3' },
  { label: 'T4', value: '4' },
]

type SortMode = 'power' | 'level' | 'name'

const sortOptions: Array<{ label: string; value: SortMode }> = [
  { label: 'Power', value: 'power' },
  { label: 'Level', value: 'level' },
  { label: 'Name', value: 'name' },
]

/** Lowercase roman numerals — what `UpgradeItemBulk` wants for a tier. */
const romanTiers = ['i', 'ii', 'iii', 'iv', 'v']

/**
 * Everything you can do to one item, one right-click away.
 *
 * These used to live inside the detail dialog, which meant three clicks and
 * a modal to level something up. The dialog is still there for reading — it
 * is no longer the only route to acting.
 */
function ItemMenu({
  isActing,
  item,
  onAction,
  onInspect,
  onRecycle,
}: {
  isActing: boolean
  item: InventoryRow
  onAction: (request: ItemActionRequest) => void
  onInspect: () => void
  onRecycle: () => void
}) {
  const locked = item.lockedReason !== null

  return (
    <>
      <ContextMenuLabel className="truncate">
        {item.displayName}
      </ContextMenuLabel>
      <ContextMenuSeparator />

      <ContextMenuItem onSelect={onInspect}>
        <Info className="mr-2 size-3.5" />
        Inspect
      </ContextMenuItem>

      <ContextMenuItem
        disabled={isActing}
        onSelect={() =>
          onAction({ kind: 'level', itemId: item.itemId })
        }
      >
        <ArrowUp className="mr-2 size-3.5" />
        Level up
        <ContextMenuShortcut>+1</ContextMenuShortcut>
      </ContextMenuItem>

      {item.tier > 0 && item.tier < 5 && (
        <ContextMenuItem
          disabled={isActing}
          onSelect={() =>
            onAction({
              kind: 'evolve',
              itemId: item.itemId,
              desiredLevel: item.level,
              desiredTier: romanTiers[item.tier] ?? 'no_tier',
              conversionIndex: 0,
            })
          }
        >
          <Star className="mr-2 size-3.5" />
          Evolve to tier {item.tier + 1}
        </ContextMenuItem>
      )}

      <ContextMenuItem
        disabled={isActing}
        onSelect={() => onAction({ kind: 'rarity', itemId: item.itemId })}
      >
        <Sparkles className="mr-2 size-3.5" />
        Upgrade rarity
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        className="text-destructive focus:text-destructive"
        disabled={locked}
        onSelect={onRecycle}
      >
        <Trash2 className="mr-2 size-3.5" />
        {locked ? 'Protected' : 'Recycle…'}
      </ContextMenuItem>
    </>
  )
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Boxes}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.inventory')}
        description="Every hero, schematic, defender and survivor the account owns. Click to select, right-click for actions."
      />
      <Content />
    </>
  )
}

function Content() {
  const [detail, setDetail] = useState<ItemDetailSubject | null>(null)
  const [sort, setSort] = useState<SortMode>('power')

  const {
    account,
    activeKind,
    alterationPools,
    clearSelection,
    confirmOpen,
    countsByKind,
    errorMessage,
    filters,
    handleItemAction,
    handleLoad,
    handleRecycle,
    handleSelectKind,
    handleToggleAll,
    handleToggleItem,
    handleToggleMany,
    handleUpgradeSelected,
    hasLoaded,
    isActing,
    isDisabledRecycle,
    isLoading,
    isRecycling,
    lockedCount,
    queuedUpgrades,
    ratings,
    recyclableCount,
    records,
    recycleRewards,
    rows,
    selectedIds,
    selectedSet,
    setConfirmOpen,
    totalSelected,
    updateFilters,
  } = useInventoryData()

  /**
   * One section per rarity, strongest first. A vault is read top-down for the
   * things worth keeping and bottom-up for the things worth recycling, and a
   * single flat wrap of two hundred tiles serves neither.
   */
  const sections = useMemo(() => {
    const byRarity = new Map<Rarity, Array<InventoryRow>>()

    rows.forEach((item) => {
      const current = byRarity.get(item.rarity) ?? []

      current.push(item)
      byRarity.set(item.rarity, current)
    })

    const compare = (itemA: InventoryRow, itemB: InventoryRow) => {
      if (sort === 'name') {
        return itemA.displayName.localeCompare(itemB.displayName)
      }

      if (sort === 'level') {
        return itemB.level - itemA.level
      }

      return (itemB.power ?? 0) - (itemA.power ?? 0)
    }

    return raritySections
      .filter((rarity) => byRarity.has(rarity))
      .map((rarity) => ({
        rarity,
        items: [...(byRarity.get(rarity) ?? [])].sort(compare),
      }))
  }, [rows, sort])

  /*
   * Every handler a tile is given has to keep its identity between renders,
   * or `memo` on the tile buys nothing and one click re-renders the shelf.
   */
  const handleInspect = useStableCallback((item: InventoryRow) => {
    setDetail(item)
  })
  const handleRecycleOne = useStableCallback((itemId: string) => {
    handleToggleItem(itemId)
    setConfirmOpen(true)
  })
  const handleToggleOne = useStableCallback(handleToggleItem)
  const handleAction = useStableCallback(handleItemAction)
  const handleToggleSection = useStableCallback(handleToggleMany)

  if (!account) {
    return (
      <EmptyState
        description="Pick one in the title bar and its vault loads here."
        icon={UserX}
        title="No account selected"
      />
    )
  }

  const allSelected =
    recyclableCount > 0 && selectedIds.length >= recyclableCount

  return (
    <>
      <Panel id="vault-card">
        <PanelHeader
          actions={
            <Button
              disabled={isLoading}
              onClick={handleLoad}
              size="sm"
              variant="ghost"
            >
              {isLoading ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  Refresh
                </>
              )}
            </Button>
          }
          as="div"
          compact
          icon={Boxes}
          title={parseCustomDisplayName(account)}
        />

        <PanelBody className="space-y-3 px-3 py-3">
          {/*
            A hand-rolled strip rather than the Radix `Tabs`, for the same
            reason `Segmented` is: there are no tab *panels* here. The tab
            picks what the page below is about, and Radix triggers would
            point `aria-controls` at content that does not exist.
          */}
          <div
            className="flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-surface/60 p-1"
            role="tablist"
          >
            {tabs.map((tab) => {
              const active = activeKind === tab.value
              const count = countsByKind[tab.value]

              return (
                <button
                  aria-selected={active}
                  className={cn(
                    'flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/25'
                      : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                  )}
                  key={tab.value}
                  onClick={() => handleSelectKind(tab.value)}
                  role="tab"
                  type="button"
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                  <span
                    className={cn(
                      'figure rounded-md px-1.5 py-px text-[0.625rem]',
                      active
                        ? 'bg-primary/20 text-primary'
                        : 'bg-background/50 text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8"
                onChange={(event) =>
                  updateFilters({ search: event.target.value })
                }
                placeholder="Name, type or template id"
                value={filters.search}
              />
            </span>

            <Select
              onValueChange={(maxRarity: Rarity) => {
                updateFilters({ maxRarity })
                clearSelection()
              }}
              value={filters.maxRarity}
            >
              <SelectTrigger
                className="w-40"
                title="Shows this rarity and everything below it"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rarityFilterOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                  >
                    <span className="flex items-center gap-2">
                      <RarityDot rarity={option.value} />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value) => {
                updateFilters({ maxTier: Number(value) })
                clearSelection()
              }}
              value={String(filters.maxTier)}
            >
              <SelectTrigger
                className="w-32"
                title="Shows this tier and everything below it"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tierFilterOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value: SortMode) => setSort(value)}
              value={sort}
            >
              <SelectTrigger className="w-32 gap-2">
                <span className="micro-label shrink-0">Sort</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PanelBody>
      </Panel>

      {errorMessage && (
        <Callout
          title="Could not read this account's vault"
          tone="danger"
        >
          {errorMessage}
        </Callout>
      )}

      {hasLoaded && !errorMessage && (
        <>
          <StatRow>
            <StatTile
              icon={Boxes}
              label="Shown"
              value={rows.length}
            />
            <StatTile
              hint="Favourited or equipped"
              icon={Lock}
              label="Protected"
              value={lockedCount}
            />
            <StatTile
              icon={CheckCheck}
              label="Selected"
              tone={totalSelected > 0 ? 'primary' : 'default'}
              value={totalSelected}
            />
            <StatTile
              hint={
                recycleRewards.length > 0 ? undefined : 'Select some items'
              }
              icon={Recycle}
              label="Recycle value"
              tone={recycleRewards.length > 0 ? 'success' : 'default'}
              value={
                recycleRewards.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {recycleRewards.slice(0, 2).map((reward) => (
                      <span
                        className="inline-flex items-center gap-1"
                        key={reward.templateId}
                      >
                        <ItemIcon
                          records={records}
                          size="small"
                          templateId={reward.templateId}
                        />
                        <span className="text-base">
                          {reward.amount.toLocaleString()}
                        </span>
                      </span>
                    ))}
                  </span>
                ) : (
                  '—'
                )
              }
            />
          </StatRow>

          {totalSelected > 0 && (
            <Callout
              title="Recycling cannot be undone"
              tone="warning"
            >
              Favourited and equipped items carry a padlock and cannot be
              selected — the main process re-checks that against a fresh
              profile before anything is destroyed.
            </Callout>
          )}

          <Panel>
            <PanelHeader
              actions={
                recyclableCount > 0 ? (
                  <Button
                    onClick={handleToggleAll}
                    size="sm"
                    variant="ghost"
                  >
                    {allSelected
                      ? 'Deselect all'
                      : `Select all ${recyclableCount} selectable`}
                  </Button>
                ) : undefined
              }
              as="div"
              compact
              title={
                <span className="flex items-baseline gap-2">
                  <span className="figure">{rows.length}</span>
                  <span className="text-muted-foreground">
                    {kindNouns[activeKind][rows.length === 1 ? 0 : 1]}
                  </span>
                </span>
              }
            />

            {sections.length > 0 ? (
              <VaultShelves
                isActing={isActing}
                onAction={handleAction}
                onInspect={handleInspect}
                onRecycleOne={handleRecycleOne}
                onToggleItem={handleToggleOne}
                onToggleSection={handleToggleSection}
                records={records}
                sections={sections}
                selectedSet={selectedSet}
              />
            ) : (
              <PanelBody>
                <EmptyState
                  className="border-0 bg-transparent py-8"
                  description={
                    isLoading
                      ? 'Reading the account profile…'
                      : 'Nothing on this tab matches the current search.'
                  }
                  icon={Boxes}
                  title={isLoading ? 'Loading' : 'No matches'}
                />
              </PanelBody>
            )}
          </Panel>
        </>
      )}

      {totalSelected > 0 && (
        <div className="sticky bottom-3 z-10">
          <Panel className="flex flex-wrap items-center gap-3 border-destructive/30 px-4 py-3 shadow-lg">
            <ShieldAlert className="size-4 shrink-0 text-destructive" />
            <p className="text-[0.8125rem]">
              <span className="font-semibold tabular-nums">
                {totalSelected}
              </span>{' '}
              item{totalSelected === 1 ? '' : 's'} selected
            </p>
            {recycleRewards.length > 0 && (
              <span className="flex flex-wrap items-center gap-2">
                {recycleRewards.map((reward) => (
                  <span
                    className="inline-flex items-center gap-1 text-xs tabular-nums"
                    key={reward.templateId}
                  >
                    <ItemIcon
                      records={records}
                      size="small"
                      templateId={reward.templateId}
                    />
                    {reward.amount.toLocaleString()}
                  </span>
                ))}
              </span>
            )}
            <Button
              className="ml-auto"
              disabled={isActing}
              onClick={handleUpgradeSelected}
              size="sm"
              variant="secondary"
            >
              {isActing ? (
                <>
                  <UpdateIcon className="animate-spin" />
                  {queuedUpgrades > 0 && `${queuedUpgrades} left`}
                </>
              ) : (
                <>
                  <ArrowUp className="size-4" />
                  Level up all
                </>
              )}
            </Button>
            <Button
              onClick={clearSelection}
              size="sm"
              variant="ghost"
            >
              Clear
            </Button>
            <Button
              disabled={isDisabledRecycle}
              onClick={() => setConfirmOpen(true)}
              size="sm"
              variant="destructive"
            >
              {isRecycling ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Recycle selected
                </>
              )}
            </Button>
          </Panel>
        </div>
      )}

      <ItemDetailDialog
        alterationPools={alterationPools}
        isBusy={isActing}
        onAction={handleItemAction}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null)
          }
        }}
        ratings={ratings}
        records={records}
        subject={detail}
      />

      <Dialog
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Recycle {totalSelected} item{totalSelected === 1 ? '' : 's'}?
            </DialogTitle>
            <DialogDescription>
              This is permanent. The items are destroyed on Epic's servers in
              exchange for their crafting materials, and there is no way to
              get them back from here or from the game.
            </DialogDescription>
          </DialogHeader>
          {recycleRewards.length > 0 && (
            <ul className="flex flex-wrap gap-3 rounded-xl border border-border/60 bg-surface/50 px-4 py-3">
              {recycleRewards.map((reward) => (
                <li
                  className="flex items-center gap-2 text-sm tabular-nums"
                  key={reward.templateId}
                >
                  <ItemIcon
                    records={records}
                    templateId={reward.templateId}
                  />
                  {reward.amount.toLocaleString()}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button
              onClick={() => setConfirmOpen(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecycle}
              variant="destructive"
            >
              <Trash2 className="size-4" />
              Recycle permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GoToTop containerId="vault-card" />
    </>
  )
}

function RarityDot({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: vaultRarityColors[rarity] }}
    />
  )
}

/** The tile grid's own metrics, shared by the CSS and the virtualiser. */
const tileMinWidth = 104
const tileGap = 8
const headerHeight = 37
/** Name bar plus footer — the part of a tile that is not the square plate. */
const estimatedNameBar = 46

type VaultSection = { items: Array<InventoryRow>; rarity: Rarity }

type VaultLine =
  | { kind: 'header'; rarity: Rarity; section: VaultSection }
  | { key: string; kind: 'row'; items: Array<InventoryRow> }

type ShelfProps = {
  isActing: boolean
  onAction: (request: ItemActionRequest) => void
  onInspect: (item: InventoryRow) => void
  onRecycleOne: (itemId: string) => void
  onToggleItem: (itemId: string) => void
  onToggleSection: (itemIds: Array<string>) => void
  records: ItemRecordMap
  selectedSet: Set<string>
}

/**
 * The shelves, virtualised.
 *
 * A vault runs to several hundred items, each of them a bordered plate with
 * two images on it, and the page kept every one of them in the document —
 * `content-visibility` spared the paint but not the eight thousand nodes, and
 * every click walked the lot. So the sections are flattened into one list of
 * lines — a rarity heading, then a row of tiles per grid row — and only the
 * lines near the viewport exist.
 *
 * It virtualises against the app's single scroll pane rather than growing a
 * scrollbar of its own: the vault is the page, and a box that scrolls inside
 * a page that also scrolls is a worse thing to use than a long page.
 */
function VaultShelves({
  sections,
  ...props
}: ShelfProps & { sections: Array<VaultSection> }) {
  const $grid = useRef<HTMLDivElement>(null)

  const columns = useColumnCount($grid, {
    gap: tileGap,
    minWidth: tileMinWidth,
  })

  const lines = useMemo(() => {
    const result: Array<VaultLine> = []

    sections.forEach((section) => {
      result.push({ kind: 'header', rarity: section.rarity, section })

      for (let index = 0; index < section.items.length; index += columns) {
        result.push({
          items: section.items.slice(index, index + columns),
          key: `${section.rarity}:${index}`,
          kind: 'row',
        })
      }
    })

    return result
  }, [columns, sections])

  return (
    <VirtualList
      className="px-3 pb-3"
      count={lines.length}
      estimateSize={(index) =>
        lines[index].kind === 'header'
          ? headerHeight
          : tileMinWidth + estimatedNameBar + tileGap
      }
      getKey={(index) => {
        const line = lines[index]

        return line.kind === 'header' ? `header:${line.rarity}` : line.key
      }}
      renderLine={(index) => {
        const line = lines[index]

        if (line.kind === 'header') {
          return (
            <ShelfHeader
              onToggleSection={props.onToggleSection}
              section={line.section}
              selectedSet={props.selectedSet}
            />
          )
        }

        return (
          <div
            className="grid"
            style={{
              gap: tileGap,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              paddingBottom: tileGap,
            }}
          >
            {line.items.map((item) => (
              <VaultTile
                isActing={props.isActing}
                item={item}
                key={item.itemId}
                onAction={props.onAction}
                onInspect={props.onInspect}
                onRecycleOne={props.onRecycleOne}
                onToggleItem={props.onToggleItem}
                records={props.records}
                selected={props.selectedSet.has(item.itemId)}
              />
            ))}
          </div>
        )
      }}
      sizerRef={$grid}
    />
  )
}

/**
 * A rarity heading, with the section's own select-all — "recycle every
 * common" is the single most common thing anyone does here.
 *
 * It no longer sticks to the top of the pane: a sticky element inside a
 * transformed, absolutely-positioned window has nothing stable to stick to.
 * The tab strip above says which kind you are in; the heading says which tier.
 */
function ShelfHeader({
  onToggleSection,
  section,
  selectedSet,
}: {
  onToggleSection: (itemIds: Array<string>) => void
  section: VaultSection
  selectedSet: Set<string>
}) {
  const color = vaultRarityColors[section.rarity]
  const selectable = section.items.filter(
    (item) => item.lockedReason === null
  )
  const allSelected =
    selectable.length > 0 &&
    selectable.every((item) => selectedSet.has(item.itemId))

  return (
    <header
      className="flex flex-wrap items-center gap-2 rounded-lg bg-surface/50 px-3 py-2"
      style={{
        boxShadow: `inset 3px 0 0 color-mix(in srgb, ${color} 70%, transparent)`,
        marginBottom: tileGap,
      }}
    >
      <RarityDot rarity={section.rarity} />
      <h3
        className="text-xs font-semibold"
        style={{ color }}
      >
        {rarityLabels[section.rarity]}
      </h3>
      <span className="micro-label">
        {section.items.length} item{section.items.length === 1 ? '' : 's'}
      </span>
      {selectable.length > 0 && (
        <Button
          className="ml-auto h-6 px-2 text-[0.6875rem]"
          onClick={() =>
            onToggleSection(section.items.map((item) => item.itemId))
          }
          size="sm"
          variant="ghost"
        >
          {allSelected ? 'Deselect' : `Select ${selectable.length}`}
        </Button>
      )}
    </header>
  )
}

/**
 * One tile, memoised.
 *
 * Selection state reaches it as a boolean rather than the selected-id set, so
 * ticking one item re-renders that item and nothing else. The context menu is
 * built in here rather than passed in for the same reason — a menu element
 * handed down as a prop is a new object on every render of the parent.
 */
const VaultTile = memo(function VaultTile({
  isActing,
  item,
  onAction,
  onInspect,
  onRecycleOne,
  onToggleItem,
  records,
  selected,
}: {
  isActing: boolean
  item: InventoryRow
  onAction: (request: ItemActionRequest) => void
  onInspect: (item: InventoryRow) => void
  onRecycleOne: (itemId: string) => void
  onToggleItem: (itemId: string) => void
  records: ItemRecordMap
  selected: boolean
}) {
  const locked = item.lockedReason !== null

  return (
    <ItemTile
      className="w-full"
      footer={item.displaySubtitle}
      level={item.level}
      locked={locked}
      menu={
        <ItemMenu
          isActing={isActing}
          item={item}
          onAction={onAction}
          onInspect={() => onInspect(item)}
          onRecycle={() => onRecycleOne(item.itemId)}
        />
      }
      name={item.displayName}
      onClick={() => (locked ? onInspect(item) : onToggleItem(item.itemId))}
      portrait={item.portrait}
      power={item.power}
      records={records}
      selected={selected}
      templateId={item.templateId}
      tier={item.tier}
      title={
        locked
          ? 'Protected — click to inspect, right-click for actions'
          : 'Click to select · right-click for actions'
      }
    />
  )
})
