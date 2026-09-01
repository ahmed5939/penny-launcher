import type { InventoryItem } from '../../../kernel/core/inventory'
import type {
  ItemActionKind,
  ItemActionRequest,
} from '../../../kernel/core/item-actions'
import type { ItemKind } from '../../../config/constants/fortnite/items'

import { useShallow } from 'zustand/react/shallow'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import {
  getItemRecord,
  useItemDatabaseStore,
} from '../../../state/items/database'
import { useInventoryStore } from '../../../state/stw-operations/inventory'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { computeItemPower } from '../../../config/constants/fortnite/power'
import {
  rarityFromLabel,
  rarityOrder,
} from '../../../config/constants/fortnite/items'

import { toast } from '../../../lib/notifications'

/**
 * What the success toast says, per action. "Item updated" told you nothing —
 * least of all whether the evolve you just paid for actually happened.
 */
const actionToasts: Record<ItemActionKind, string> = {
  level: 'Levelled up',
  evolve: 'Evolved to the next tier',
  rarity: 'Rarity upgraded',
  'perk-upgrade': 'Perk upgraded',
  'perk-respec': 'Perk changed',
}

/** The kind tabs, in the order the strip shows them. */
export const itemKinds: Array<ItemKind> = [
  'schematic',
  'hero',
  'defender',
  'survivor',
]

/** An item with whatever the game's own data knows about it folded in. */
export type InventoryRow = InventoryItem & {
  displayName: string
  displaySubtitle: string | null
  description: string | null
  /** What recycling it hands back, when known. */
  recycle: { amount: number; result: string } | null
  /** The number the game shows, computed from rarity, tier and level. */
  power: number | null
}

export function useInventoryData() {
  useRequestItemDatabase()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isActing, setActing] = useState(false)

  /**
   * The account comes from the title bar, not from a picker on this page.
   * An inventory is one account's inventory, and the app already asks you
   * which account you are working on once, at the top.
   */
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)
  const alterationPools = useItemDatabaseStore(
    (state) => state.alterationPools
  )
  const isDatabaseLoading = useItemDatabaseStore((state) => state.isLoading)

  const { data, filters, isLoading, isRecycling, mode, selection } =
    useInventoryStore(
      useShallow((state) => ({
        data: state.data,
        filters: state.filters,
        isLoading: state.isLoading,
        isRecycling: state.isRecycling,
        mode: state.mode,
        selection: state.selection,
      }))
    )
  const {
    clearSelection,
    updateData,
    updateFilters,
    updateLoading,
    updateMode,
    updateRecycling,
    updateSelection,
  } = useInventoryStore(
    useShallow((state) => ({
      clearSelection: state.clearSelection,
      updateData: state.updateData,
      updateFilters: state.updateFilters,
      updateLoading: state.updateLoading,
      updateMode: state.updateMode,
      updateRecycling: state.updateRecycling,
      updateSelection: state.updateSelection,
    }))
  )

  const entry = accountId ? data[accountId] : undefined
  const selected_ = (accountId ? selection[accountId] : undefined) ?? []
  const selectedSet = useMemo(() => new Set(selected_), [selected_])

  const maxRarityIndex = rarityOrder.indexOf(filters.maxRarity)
  const search = filters.search.trim().toLowerCase()
  const deferredSearch = useDeferredValue(search)

  /**
   * Everything the account owns is listed, favourited and equipped items
   * included — this is the vault, not a recycling queue. What protection
   * costs those items is the ability to be selected, nothing more.
   *
   * The kind gate is applied last and separately from the rest, because the
   * tab strip has to say how many schematics you have *under the current
   * rarity, tier and search* while you are standing on the heroes tab.
   */
  const { allRows, countsByKind, lockedCount, rows } = useMemo(() => {
    const items = entry?.items ?? []

    const mapped: Array<InventoryRow> = items.map((item) => {
      const record = getItemRecord(records, item.templateId)

      return {
        ...item,
        /*
         * The database outranks the template id here: mythic heroes carry an
         * `sr` token, so decoding alone files them under Legendary and paints
         * them orange.
         */
        rarity: rarityFromLabel(record?.rarity) ?? item.rarity,
        displayName: record?.name ?? item.name,
        displaySubtitle: record?.subType ?? item.subtitle,
        description: record?.description ?? null,
        recycle: record?.recycle ?? null,
        power: computeItemPower({
          level: item.level,
          tables: ratings,
          templateId: item.templateId,
        }),
      }
    })

    const visible = mapped.filter((item) => {
      // Craft-only ammo, building and utility recipes also use the
      // Schematic prefix. They are not manageable weapon/trap schematics.
      if (
        item.kind === 'schematic' &&
        !['Melee', 'Ranged', 'Trap'].includes(
          getItemRecord(records, item.templateId)?.category ?? ''
        )
      ) {
        return false
      }

      if (rarityOrder.indexOf(item.rarity) > maxRarityIndex) {
        return false
      }

      if (filters.maxTier > 0 && item.tier > filters.maxTier) {
        return false
      }

      if (deferredSearch.length > 0) {
        return (
          item.displayName.toLowerCase().includes(deferredSearch) ||
          (item.displaySubtitle ?? '').toLowerCase().includes(deferredSearch) ||
          item.templateId.toLowerCase().includes(deferredSearch)
        )
      }

      return true
    })

    const counts: Record<ItemKind, number> = {
      defender: 0,
      hero: 0,
      schematic: 0,
      survivor: 0,
    }

    visible.forEach((item) => {
      counts[item.kind] += 1
    })

    const kindRows = visible.filter((item) =>
      filters.kinds.includes(item.kind)
    )

    return {
      /**
       * Every item, before any filter — the detail dialog reads from this,
       * so narrowing the grid never closes what you are looking at.
       */
      allRows: mapped,
      countsByKind: counts,
      /** Of what is on screen — the stat sits in a row about the shown set. */
      lockedCount: kindRows.filter((item) => item.lockedReason !== null)
        .length,
      rows: kindRows,
    }
  }, [deferredSearch, entry, filters, maxRarityIndex, ratings, records])

  const rowsById = useMemo(
    () => new Map(rows.map((item) => [item.itemId, item])),
    [rows]
  )

  /** What the current selection would hand back, by resource. */
  const recycleRewards = useMemo(() => {
    const totals: Record<string, number> = {}

    rows.forEach((item) => {
      if (!selectedSet.has(item.itemId) || !item.recycle) {
        return
      }

      totals[item.recycle.result] =
        (totals[item.recycle.result] ?? 0) + item.recycle.amount
    })

    return Object.entries(totals)
      .filter(([, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([templateId, amount]) => ({ amount, templateId }))
  }, [rows, selectedSet])

  /** Exactly one kind is ever shown; the strip is the only way to change it. */
  const activeKind: ItemKind = filters.kinds[0] ?? itemKinds[0]

  const totalSelected = selected_.length
  const isDisabledRecycle = isRecycling || totalSelected <= 0 || !accountId

  useEffect(() => {
    const listener = window.electronAPI.responseInventory(
      async (response) => {
        updateLoading(false)
        updateData(response)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationInventoryRecycle(
      async (response) => {
        updateRecycling(false)
        clearSelection()

        const recycled = response.results.reduce(
          (accumulator, current) => accumulator + current.recycled,
          0
        )
        const skipped = response.results.reduce(
          (accumulator, current) => accumulator + current.skipped,
          0
        )
        const failed = response.results.filter((item) => item.errorMessage)

        toast(
          recycled > 0
            ? `Recycled ${recycled} item${recycled === 1 ? '' : 's'}`
            : 'Nothing was recycled'
        )

        if (skipped > 0) {
          toast(
            `${skipped} item${skipped === 1 ? ' was' : 's were'} skipped — favourited or equipped since you loaded the list`
          )
        }

        if (failed.length > 0) {
          toast(`Epic reported an error: ${failed[0].errorMessage}`)
        }

        handleLoad()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [accountId])

  const handleLoad = () => {
    if (!selected) {
      return
    }

    updateLoading(true)
    window.electronAPI.requestInventory([selected])
  }

  /** Switching account in the title bar reloads the page's contents. */
  useEffect(() => {
    if (accountId) {
      handleLoad()
    }
  }, [accountId])

  /**
   * One tab at a time. The old control was four independent toggles, which
   * could be turned off one by one until the vault was empty and looked
   * broken — and an "all" tab that mixed survivors in with sniper rifles was
   * no more use than that.
   */
  const handleSelectKind = (kind: ItemKind) => {
    updateFilters({ kinds: [kind] })
    clearSelection()
  }

  /** Protected items are visible but never selectable. */
  const recyclable = rows.filter((item) => item.lockedReason === null)

  const handleToggleItem = (itemId: string) => {
    if (!accountId) {
      return
    }

    const item = rowsById.get(itemId)

    if (!item || item.lockedReason !== null) {
      return
    }

    updateSelection(
      accountId,
      selectedSet.has(itemId)
        ? selected_.filter((value) => value !== itemId)
        : [...selected_, itemId]
    )
  }

  /** Ticks or unticks every *recyclable* item passing the filters. */
  const handleToggleAll = () => {
    if (!accountId) {
      return
    }

    const allSelected =
      recyclable.length > 0 && selected_.length >= recyclable.length

    updateSelection(
      accountId,
      allSelected ? [] : recyclable.map((item) => item.itemId)
    )
  }

  /**
   * Ticks or unticks one rarity section in a single click.
   *
   * Recycling is almost always "everything common", and the only way to say
   * that used to be select-all-then-untick or forty clicks.
   */
  const handleToggleMany = (itemIds: Array<string>) => {
    if (!accountId) {
      return
    }

    const selectable = itemIds.filter(
      (itemId) => rowsById.get(itemId)?.lockedReason === null
    )

    if (selectable.length === 0) {
      return
    }

    const selectableSet = new Set(selectable)
    const allSelected = selectable.every((itemId) => selectedSet.has(itemId))

    updateSelection(
      accountId,
      allSelected
        ? selected_.filter((itemId) => !selectableSet.has(itemId))
        : [...selected_, ...selectable]
    )
  }

  /**
   * Upgrades, evolutions and perk changes. Each spends materials, so the
   * caller confirms before this is reached, and the vault reloads after so
   * the new level and perks are what Epic actually stored.
   */
  const handleItemAction = (request: ItemActionRequest) => {
    if (!selected || isActing) {
      return
    }

    setActing(true)
    window.electronAPI.performItemAction(selected, request)
  }

  /**
   * Levels everything selected, one request per item.
   *
   * Epic has no bulk-upgrade command, so this is a queue rather than a
   * batch: each response schedules the next, which keeps the profile
   * revision consistent and lets a mid-run failure stop the rest.
   */
  const [queueLength, setQueueLength] = useState(0)
  /**
   * A ref, not state: the notification listener has to read the *current*
   * remainder, and a listener registered before the last render would close
   * over a stale copy.
   */
  const levelQueue = useRef<Array<string>>([])

  const setQueue = (next: Array<string>) => {
    levelQueue.current = next
    setQueueLength(next.length)
  }

  const handleUpgradeSelected = () => {
    if (isActing || selected_.length <= 0) {
      return
    }

    const [first, ...rest] = selected_

    setQueue(rest)
    handleItemAction({ kind: 'level', itemId: first })
  }

  useEffect(() => {
    const listener = window.electronAPI.notificationItemAction(
      async (response) => {
        setActing(false)

        if (response.errorMessage) {
          /** Stop the queue rather than repeating a failure item by item. */
          setQueue([])
          toast(`Epic rejected that: ${response.errorMessage}`)
          handleLoad()

          return
        }

        const [next, ...rest] = levelQueue.current

        if (next) {
          setQueue(rest)
          handleItemAction({ kind: 'level', itemId: next })

          return
        }

        toast(actionToasts[response.kind] ?? 'Item updated')
        handleLoad()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [accountId])

  const handleRecycle = () => {
    if (isDisabledRecycle || !selected || !accountId) {
      return
    }

    setConfirmOpen(false)
    updateRecycling(true)

    window.electronAPI.recycleInventoryItems([selected], {
      [accountId]: selected_,
    })
  }

  return {
    account: selected ?? null,
    activeKind,
    allRows,
    countsByKind,
    confirmOpen,
    errorMessage: entry?.errorMessage ?? null,
    filters,
    hasLoaded: entry !== undefined,
    isDatabaseLoading,
    isDisabledRecycle,
    isLoading,
    isRecycling,
    alterationPools,
    isActing: isActing || queueLength > 0,
    lockedCount,
    mode,
    ratings,
    records,
    queuedUpgrades: queueLength,
    recyclableCount: recyclable.length,
    recycleRewards,
    rows,
    selectedIds: selected_,
    selectedSet,
    totalSelected,

    clearSelection,
    handleLoad,
    handleRecycle,
    handleToggleAll,
    handleToggleItem,
    handleToggleMany,
    handleItemAction,
    handleSelectKind,
    handleUpgradeSelected,
    setConfirmOpen,
    updateFilters,
    updateMode,
  }
}
