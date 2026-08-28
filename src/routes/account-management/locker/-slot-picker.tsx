import type { CosmeticMeta } from '../../../kernel/core/locker-catalog'
import type { LockerSlotKey } from '../../../config/fortnite/locker'

import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Eraser, PackageOpen } from 'lucide-react'

import { slotLabels } from '../../../config/fortnite/locker'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/page'

import { CosmeticTile } from './-cosmetic-tile'

import { useColumnCount } from '../../../hooks/ui/virtual'

/** Tile width plus the grid gap — what `useColumnCount` measures against. */
const tileWidth = 112
const tileGap = 8
const rowHeight = tileWidth + tileGap

/**
 * "What can go in this slot."
 *
 * An account can own several thousand emotes, so the list virtualises. It
 * scrolls in its own pane rather than against the page's — a dialog is the
 * one place in the app where that is the right answer, because the page
 * behind it is not scrollable while the dialog is open.
 */
export function SlotPicker({
  equippedTemplateId,
  isEquipping,
  items,
  onClose,
  onPick,
  slotKey,
}: {
  equippedTemplateId: string | null
  isEquipping: boolean
  items: Array<CosmeticMeta>
  onClose: () => void
  onPick: (templateId: string | null, itemName: string) => void
  slotKey: LockerSlotKey | null
}) {
  const [query, setQuery] = useState('')
  const $scroll = useRef<HTMLDivElement>(null)
  const $grid = useRef<HTMLDivElement>(null)

  const columns = useColumnCount($grid, {
    gap: tileGap,
    minWidth: tileWidth,
  })

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (needle.length === 0) {
      return items
    }

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.id.toLowerCase().includes(needle)
    )
  }, [items, query])

  const rows = Math.ceil(filtered.length / columns)
  const virtualizer = useVirtualizer({
    count: rows,
    estimateSize: () => rowHeight,
    overscan: 3,
    getScrollElement: () => $scroll.current,
  })

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setQuery('')
          onClose()
        }
      }}
      open={slotKey !== null}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {slotKey ? `Pick a ${slotLabels[slotKey]}` : 'Pick a cosmetic'}
          </DialogTitle>
          <DialogDescription>
            Only what this account owns. Equipping writes straight to the
            locker — the change is live in game the next time the lobby
            refreshes.
          </DialogDescription>
        </DialogHeader>

        <Input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
          value={query}
        />

        {filtered.length > 0 ? (
          <div
            className="max-h-[52vh] overflow-y-auto pr-1"
            ref={$scroll}
          >
            <div
              className="relative w-full"
              ref={$grid}
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((row) => (
                <div
                  className="absolute left-0 top-0 flex w-full gap-2"
                  key={row.key}
                  style={{ transform: `translateY(${row.start}px)` }}
                >
                  {filtered
                    .slice(row.index * columns, (row.index + 1) * columns)
                    .map((cosmetic) => (
                      <CosmeticTile
                        cosmetic={cosmetic}
                        disabled={isEquipping}
                        key={cosmetic.templateId}
                        onClick={() =>
                          onPick(cosmetic.templateId, cosmetic.name)
                        }
                        selected={
                          cosmetic.templateId === equippedTemplateId
                        }
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-6"
            description={
              query.trim().length > 0
                ? 'Nothing on this account matches that search.'
                : 'This account owns nothing that fits this slot.'
            }
            icon={PackageOpen}
            title="Nothing to equip"
          />
        )}

        <DialogFooter className="sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString()} of{' '}
            {items.length.toLocaleString()}
          </span>
          <Button
            disabled={isEquipping || !equippedTemplateId}
            onClick={() => onPick(null, 'Slot')}
            variant="outline"
          >
            <Eraser className="mr-2 size-4" />
            Clear slot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
