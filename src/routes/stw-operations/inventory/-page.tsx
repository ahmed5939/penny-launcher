import type { InventoryRow } from './-hooks'
import type { InventoryEntry } from '../../../kernel/core/inventory'
import type { ItemActionRequest } from '../../../kernel/core/item-actions'
import type { ItemKind, Rarity } from '../../../config/constants/fortnite/items'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { LucideIcon } from 'lucide-react'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  ArrowUp,
  Boxes,
  Crown,
  HeartPulse,
  Hammer,
  Info,
  ShieldAlert,
  ShieldHalf,
  Sparkles,
  Star,
  Swords,
  Target,
  Trash2,
  UsersRound,
  Zap,
} from 'lucide-react'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { VirtualList } from '../../../components/virtual-list'
import {
  ItemDetailDialog,
  levelCapForTier,
  superchargeMaxLevel,
} from '../../../components/items/item-detail'
import { evolutionOptions } from '../../../components/items/evolution-options'
import { getItemRecord } from '../../../state/items/database'
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
  AccountResourceGate,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Picker,
  RefreshButton,
  SearchField,
  Segmented,
  StatRow,
  StatTile,
  vaultRarityColors,
} from '../../../components/page'

import { useInventoryData, useInventoryResource } from './-hooks'
import { useInventoryStore } from '../../../state/stw-operations/inventory'
import { DefendersView } from '../defenders/-view'

import { useColumnCount } from '../../../hooks/ui/virtual'
import { useStableCallback } from '../../../hooks/ui/stable-callback'

import {
  itemKindLabels,
  rarityLabels,
  rarityOrder,
} from '../../../config/constants/fortnite/items'

/**
 * Kind is a tab, not a filter.
 *
 * It used to be four independent toggles sitting above two more rows of
 * "up to rarity" and "up to tier" segmented controls — three quarters of a
 * screen of chrome before the first item, and a set of switches you could
 * turn all the way off until the vault looked broken. Kinds are mutually
 * exclusive in every way that matters: nobody compares a survivor against a
 * sniper rifle. So each kind is its own page, and the narrowing controls
 * that remain are two dropdowns on one line.
 */
const kindIcons: Record<ItemKind, LucideIcon> = {
  defender: Target,
  hero: Crown,
  schematic: Hammer,
  survivor: HeartPulse,
}

/** `itemKindLabels` is plural — a shelf of one still has to read right. */
const kindNouns: Record<ItemKind, [string, string]> = {
  defender: ['defender', 'defenders'],
  hero: ['hero', 'heroes'],
  schematic: ['schematic', 'schematics'],
  survivor: ['survivor', 'survivors'],
}

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
  { label: 'Sort by power', value: 'power' },
  { label: 'Sort by level', value: 'level' },
  { label: 'Sort by name', value: 'name' },
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
  records,
  isActing,
  item,
  onAction,
  onInspect,
  onRecycle,
}: {
  isActing: boolean
  item: InventoryRow
  records: ItemRecordMap
  onAction: (request: ItemActionRequest) => void
  onInspect: () => void
  onRecycle: () => void
}) {
  const locked = item.lockedReason !== null
  /*
   * Same ladder as the detail dialog: manuals to the tier cap, then a maxed
   * tier-5 item (a "130") supercharges one level at a time up to 60.
   */
  const cap = levelCapForTier(item.tier)
  const supercharging = item.tier >= 5 && item.level >= 50
  const canLevel = !supercharging || item.level < superchargeMaxLevel
  const bulkTarget =
    cap !== null && !supercharging ? Math.min(item.level + 10, cap) : null
  const canBulkLevel = bulkTarget !== null && bulkTarget - item.level >= 2

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

      {canLevel && (
        <ContextMenuItem
          disabled={isActing}
          onSelect={() =>
            onAction({ kind: 'level', itemId: item.itemId })
          }
        >
          {supercharging ? (
            <Zap className="mr-2 size-3.5" />
          ) : (
            <ArrowUp className="mr-2 size-3.5" />
          )}
          {supercharging ? 'Supercharge' : 'Level up'}
          <ContextMenuShortcut>+1</ContextMenuShortcut>
        </ContextMenuItem>
      )}

      {canBulkLevel && (
        <ContextMenuItem
          disabled={isActing}
          onSelect={() =>
            onAction({
              kind: 'level',
              itemId: item.itemId,
              desiredLevel: bulkTarget as number,
            })
          }
        >
          <ArrowUp className="mr-2 size-3.5" />
          Level to {bulkTarget}
          {bulkTarget === cap && ' (tier max)'}
          <ContextMenuShortcut>
            +{(bulkTarget as number) - item.level}
          </ContextMenuShortcut>
        </ContextMenuItem>
      )}

      {item.tier > 0 && item.tier < 5 && evolutionOptions(getItemRecord(records, item.templateId), item.tier).map((option) => (
        <ContextMenuItem
          key={option.conversionIndex}
          disabled={isActing}
          onSelect={() =>
            onAction({
              kind: 'evolve',
              itemId: item.itemId,
              desiredLevel: item.level,
              desiredTier: romanTiers[item.tier] ?? 'no_tier',
              conversionIndex: option.conversionIndex,
            })
          }
        >
          <Star className="mr-2 size-3.5" />
          {option.label}
        </ContextMenuItem>
      ))}

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

/**
 * Schematics, heroes, defenders and survivors are four pages, not four tabs
 * of one vault. Each is read on its own — you go looking for a hero, not for
 * "the inventory" — so each gets its own sidebar entry and header. They share
 * everything below the header: the same shelves, inspect dialog, upgrades
 * and recycling.
 */
const kindPages: Record<ItemKind, { description: string }> = {
  schematic: { description: 'Every weapon and trap schematic the account owns. Click to inspect, tick to select, right-click for quick actions.' },
  hero: { description: 'Every hero the account owns, with their perks and loadout status. Click to inspect, tick to select, right-click for quick actions.' },
  defender: { description: 'Every defender the account owns. Switch to Weapon fit to match their rolls with the schematics you have.' },
  survivor: { description: 'Every survivor and lead the account owns, with personality and set bonus. Click to inspect, tick to select, right-click for quick actions.' },
}

function KindPage({ kind }: { kind: ItemKind }) {
  const { t } = useTranslation(['sidebar'])
  const current = useInventoryStore((state) => state.filters.kinds[0])
  const updateFilters = useInventoryStore((state) => state.updateFilters)
  const clearSelection = useInventoryStore((state) => state.clearSelection)

  /* The route sets this before render; this covers arriving by any other way. */
  useLayoutEffect(() => {
    if (current !== kind) {
      updateFilters({ kinds: [kind] })
      clearSelection()
    }
  }, [kind, current, updateFilters, clearSelection])

  const resource = useInventoryResource()

  return (
    <>
      <PageHeader
        actions={
          <RefreshButton
            disabled={!resource.accountId}
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
        icon={kindIcons[kind]}
        section={t('stw-operations.title')}
        title={itemKindLabels[kind]}
        description={kindPages[kind].description}
      />
      {current === kind && (
        <AccountResourceGate
          icon={kindIcons[kind]}
          loading={{
            title: `Loading ${kindNouns[kind][1]}…`,
            description: 'Reading the account profile from Epic.',
          }}
          resource={resource}
          what={`this account's ${kindNouns[kind][1]}`}
        >
          {(entry) => (
            <Content
              entry={entry}
              key={entry.accountId}
              reload={resource.refresh}
            />
          )}
        </AccountResourceGate>
      )}
    </>
  )
}

export const SchematicsPage = () => <KindPage kind="schematic" />
export const HeroesPage = () => <KindPage kind="hero" />
export const DefendersPage = () => <KindPage kind="defender" />
export const SurvivorsPage = () => <KindPage kind="survivor" />

function Content({
  entry,
  reload,
}: {
  entry: InventoryEntry
  reload: () => void
}) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('power')

  const {
    activeKind,
    allRows,
    alterationPools,
    clearSelection,
    confirmOpen,
    filters,
    handleItemAction,
    handleLoad,
    handleRecycle,
    handleToggleAll,
    handleToggleItem,
    handleToggleMany,
    handleUpgradeSelected,
    isActing,
    isDisabledRecycle,
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
  } = useInventoryData(entry, reload)

  const defenderFit = activeKind === 'defender' && filters.defenderView === 'fit'

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

  /**
   * The dialog reads the live row, not a snapshot taken on open. An upgrade
   * reloads the vault, and the whole point of pressing "Evolve" with the
   * dialog open is watching the level, tier and power actually move. It
   * reads from the unfiltered set, so narrowing the grid underneath never
   * touches what the dialog is showing.
   */
  const detail = useMemo(
    () => allRows.find((item) => item.itemId === detailId) ?? null,
    [allRows, detailId]
  )

  /** The last row the dialog showed — what a successor is matched against. */
  const lastDetail = useRef<InventoryRow | null>(null)

  useEffect(() => {
    if (detail) {
      lastDetail.current = detail
    }
  }, [detail])

  /*
   * Evolving or upgrading rarity replaces the item on Epic's side — new
   * item id, new template id — so after the reload the open row is gone.
   * Follow it to its successor (same item at the same level, tier the same
   * or one up) instead of snapping the dialog shut and losing the item. A
   * genuinely gone item (recycled) has no successor and closes as before.
   */
  useEffect(() => {
    if (!detailId || detail) {
      return
    }

    const previous = lastDetail.current
    const successor = previous
      ? allRows.find(
          (item) =>
            item.kind === previous.kind &&
            item.displayName === previous.displayName &&
            item.level === previous.level &&
            item.tier >= previous.tier
        )
      : undefined

    setDetailId(successor?.itemId ?? null)
  }, [allRows, detail, detailId])

  /*
   * Every handler a tile is given has to keep its identity between renders,
   * or `memo` on the tile buys nothing and one click re-renders the shelf.
   */
  const handleInspect = useStableCallback((item: InventoryRow) => {
    setDetailId(item.itemId)
  })
  const handleRecycleOne = useStableCallback((itemId: string) => {
    handleToggleItem(itemId)
    setConfirmOpen(true)
  })
  const handleToggleOne = useStableCallback(handleToggleItem)
  const handleAction = useStableCallback(handleItemAction)
  const handleToggleSection = useStableCallback(handleToggleMany)

  const allSelected =
    recyclableCount > 0 && selectedIds.length >= recyclableCount

  /** The whole kind as the game shows it — before search, rarity or tier. */
  const owned = useMemo(() => {
    const ofKind = allRows.filter(
      (item) =>
        item.kind === activeKind &&
        (item.kind !== 'schematic' ||
          ['Melee', 'Ranged', 'Trap'].includes(
            getItemRecord(records, item.templateId)?.category ?? ''
          ))
    )
    const mythic = ofKind.filter((item) => item.rarity === 'mythic').length

    return {
      mythic,
      topShelf:
        mythic + ofKind.filter((item) => item.rarity === 'legendary').length,
      total: ofKind.length,
    }
  }, [activeKind, allRows, records])

  return (
    <>
      {/* What the go-to-top button watches: once this scrolls away, it shows. */}
      <div id="vault-card" />

      {/*
        The figures a vault is read for, straight under the title: how much
        there is, how much of it is top-shelf, what is off-limits and what is
        in hand. They describe the whole kind, not the filtered view, so
        narrowing the list does not make the account look poorer.
      */}
      {!defenderFit && (
        <StatRow>
          <StatTile
            label="Owned"
            value={owned.total.toLocaleString()}
          />
          <StatTile
            accent={vaultRarityColors.legendary}
            hint={
              owned.mythic > 0
                ? `${owned.mythic.toLocaleString()} mythic`
                : undefined
            }
            label="Legendary and up"
            value={owned.topShelf.toLocaleString()}
          />
          <StatTile
            hint="Favourited or equipped"
            label="Protected"
            value={lockedCount.toLocaleString()}
          />
          <StatTile
            hint={totalSelected > 0 ? undefined : 'Tick items to recycle'}
            label="Selected"
            tone={totalSelected > 0 ? 'primary' : 'default'}
            value={totalSelected.toLocaleString()}
          />
        </StatRow>
      )}

      <Panel className="chrome-surface sticky top-0 z-10">
        {activeKind === 'defender' && (
          <FilterBar className={defenderFit ? 'border-b-0' : undefined}>
            <Segmented
              onChange={(defenderView) => updateFilters({ defenderView })}
              options={[
                { label: 'Browse', value: 'browse' },
                { label: 'Weapon fit', value: 'fit' },
              ]}
              value={filters.defenderView}
            />
            <span className="text-xs text-muted-foreground">
              {defenderFit
                ? 'Ranks each defender’s rolls and suggests schematics you own that suit them.'
                : 'Switch to Weapon fit to match defenders with your weapon schematics.'}
            </span>
          </FilterBar>
        )}

        {!defenderFit && (
          <FilterBar className="border-b-0">
            <SearchField
              label={`Search ${kindNouns[activeKind][1]}`}
              onChange={(search) => updateFilters({ search })}
              placeholder="Name, type or template id"
              value={filters.search}
            />

            {/*
              Kept as a plain Select rather than a Picker: each option carries
              its rarity dot, which a Picker's text-only options cannot.
            */}
            <Select
              onValueChange={(maxRarity: Rarity) => {
                updateFilters({ maxRarity })
                clearSelection()
              }}
              value={filters.maxRarity}
            >
              <SelectTrigger
                aria-label="Highest rarity shown"
                className="h-8 w-40"
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

            <Picker
              className="min-w-32"
              label="Highest tier shown"
              onChange={(value) => {
                updateFilters({ maxTier: Number(value) })
                clearSelection()
              }}
              options={tierFilterOptions}
              value={String(filters.maxTier)}
            />

            <Picker
              label="Sort order"
              onChange={setSort}
              options={sortOptions}
              value={sort}
            />
          </FilterBar>
        )}
      </Panel>

      {defenderFit && (
        <DefendersView
          accountSelected
          embedded
          error={null}
          items={allRows}
          loading={false}
          onRefresh={handleLoad}
          ratings={ratings}
          records={records}
        />
      )}

      {!defenderFit && (
        <>

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
                  description="Nothing here matches the current search, rarity and tier."
                  icon={Boxes}
                  title="No matches"
                />
              </PanelBody>
            )}
          </Panel>
        </>
      )}

      {totalSelected > 0 && (
        <div className="sticky bottom-3 z-10">
          <Panel className="chrome-surface flex flex-wrap items-center gap-3 px-4 py-3 shadow-lg">
            <ShieldAlert className="size-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm">
                <span className="figure font-semibold">
                  {totalSelected}
                </span>{' '}
                item{totalSelected === 1 ? '' : 's'} selected
              </p>
              <p className="text-xs text-muted-foreground">
                Recycling can’t be undone. Protected items are never included.
              </p>
            </div>
            {recycleRewards.length > 0 && (
              <span
                aria-label="Recycle value"
                className="flex flex-wrap items-center gap-1.5"
              >
                {recycleRewards.map((reward) => (
                  <span
                    className="figure inline-flex items-center gap-1 rounded-md bg-muted/50 py-0.5 pl-0.5 pr-2 text-xs"
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
            setDetailId(null)
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
                  className="figure flex items-center gap-2 text-sm"
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
const tileMinWidth = 132
const tileGap = 12
const headerHeight = 37
/** Eyebrow, name and footer — the part of a tile that is not the artboard. */
const estimatedNameBar = 52

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
          className="ml-auto h-6 px-2 text-xs"
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
          records={records}
          isActing={isActing}
          item={item}
          onAction={onAction}
          onInspect={() => onInspect(item)}
          onRecycle={() => onRecycleOne(item.itemId)}
        />
      }
      name={item.displayName}
      onClick={() => onInspect(item)}
      onToggleSelect={
        locked ? undefined : () => onToggleItem(item.itemId)
      }
      personality={item.personality}
      portrait={item.portrait}
      power={item.power}
      records={records}
      selected={selected}
      setBonus={item.setBonus}
      templateId={item.templateId}
      tier={item.tier}
      title={
        locked
          ? 'Protected — click to inspect, right-click for actions'
          : 'Click to inspect · tick the box to select · right-click for actions'
      }
    />
  )
})
