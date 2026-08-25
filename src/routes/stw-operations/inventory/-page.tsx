import type { InventoryRow } from './-hooks'
import type { ItemActionRequest } from '../../../kernel/core/item-actions'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { ItemKind, Rarity } from '../../../config/constants/fortnite/items'
import type { SegmentedOption } from '../../../components/page'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  ArrowUp,
  Boxes,
  CheckCheck,
  Info,
  Sparkles,
  Star,
  Lock,
  Recycle,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserX,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
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
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  Segmented,
  StatRow,
  StatTile,
} from '../../../components/page'

import { useInventoryData } from './-hooks'

import {
  itemKindLabels,
  rarityLabels,
  rarityOrder,
} from '../../../config/constants/fortnite/items'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

const kinds: Array<ItemKind> = ['schematic', 'hero', 'defender', 'survivor']

const rarityOptions: Array<SegmentedOption<Rarity>> = rarityOrder.map(
  (rarity) => ({ label: rarityLabels[rarity], value: rarity })
)

const tierOptions: Array<SegmentedOption<string>> = [
  { label: 'Any', value: '0' },
  { label: '≤ T1', value: '1' },
  { label: '≤ T2', value: '2' },
  { label: '≤ T3', value: '3' },
  { label: '≤ T4', value: '4' },
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
        title={
          <span className="flex items-center gap-2">
            {t('stw-operations.options.inventory')}
            <BetaBadge />
          </span>
        }
        description="Every hero, schematic, defender and survivor the account owns. Click to select, right-click for actions."
      />
      <Content />
    </>
  )
}

function Content() {
  const [detail, setDetail] = useState<ItemDetailSubject | null>(null)

  const {
    account,
    clearSelection,
    confirmOpen,
    errorMessage,
    filters,
    handleLoad,
    handleRecycle,
    handleToggleAll,
    handleToggleItem,
    handleToggleKind,
    hasLoaded,
    isDisabledRecycle,
    isLoading,
    isRecycling,
    lockedCount,
    alterationPools,
    handleItemAction,
    handleUpgradeSelected,
    isActing,
    queuedUpgrades,
    ratings,
    recyclableCount,
    records,
    recycleRewards,
    rows,
    selectedIds,
    setConfirmOpen,
    totalSelected,
    updateFilters,
  } = useInventoryData()

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
      <Panel id="filters-card">
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[0.8125rem] font-medium">
              {parseCustomDisplayName(account)}
            </span>
            <span className="text-[0.65rem] text-muted-foreground">
              Click to select · right-click for actions
            </span>
            <Button
              className="ml-auto"
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
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {kinds.map((kind) => {
              const active = filters.kinds.includes(kind)

              return (
                <button
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-border/70 text-muted-foreground hover:text-foreground'
                  )}
                  key={kind}
                  onClick={() => handleToggleKind(kind)}
                  type="button"
                >
                  {itemKindLabels[kind]}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="space-y-1.5">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Up to rarity
              </span>
              <Segmented
                onChange={(maxRarity) => {
                  updateFilters({ maxRarity })
                  clearSelection()
                }}
                options={rarityOptions}
                value={filters.maxRarity}
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Up to tier
              </span>
              <Segmented
                onChange={(value) => {
                  updateFilters({ maxTier: Number(value) })
                  clearSelection()
                }}
                options={tierOptions}
                value={String(filters.maxTier)}
              />
            </label>

            <label className="min-w-48 flex-1 space-y-1.5">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Search
              </span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  onChange={(event) =>
                    updateFilters({ search: event.target.value })
                  }
                  placeholder="Name, type or template id"
                  value={filters.search}
                />
              </span>
            </label>
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
            <header className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
              <p className="text-[0.8125rem] font-medium">
                {rows.length} item{rows.length === 1 ? '' : 's'}
              </p>
              {recyclableCount > 0 && (
                <Button
                  className="ml-auto"
                  onClick={handleToggleAll}
                  size="sm"
                  variant="ghost"
                >
                  {allSelected
                    ? 'Deselect all'
                    : `Select all ${recyclableCount} selectable`}
                </Button>
              )}
            </header>

            {rows.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-3">
                {rows.map((item) => {
                  const locked = item.lockedReason !== null

                  return (
                    <ItemTile
                      footer={item.displaySubtitle}
                      key={item.itemId}
                      level={item.level}
                      locked={locked}
                      menu={
                        <ItemMenu
                          isActing={isActing}
                          item={item}
                          onAction={handleItemAction}
                          onInspect={() => setDetail(item)}
                          onRecycle={() => {
                            handleToggleItem(item.itemId)
                            setConfirmOpen(true)
                          }}
                        />
                      }
                      name={item.displayName}
                      onClick={() =>
                        locked
                          ? setDetail(item)
                          : handleToggleItem(item.itemId)
                      }
                      power={item.power}
                      records={records}
                      selected={selectedIds.includes(item.itemId)}
                      templateId={item.templateId}
                      tier={item.tier}
                      title={
                        locked
                          ? 'Protected — click to inspect, right-click for actions'
                          : 'Click to select · right-click for actions'
                      }
                    />
                  )
                })}
              </div>
            ) : (
              <PanelBody>
                <EmptyState
                  className="border-0 bg-transparent py-8"
                  description={
                    isLoading
                      ? 'Reading the account profile…'
                      : 'Nothing matches the current filters.'
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
          <Panel className="flex flex-wrap items-center gap-3 border-destructive/30 px-4 py-3 shadow-lg backdrop-blur">
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

      <GoToTop containerId="filters-card" />
    </>
  )
}
