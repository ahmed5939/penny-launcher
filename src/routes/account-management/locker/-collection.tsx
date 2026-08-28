import type { CosmeticMeta } from '../../../kernel/core/locker-catalog'
import type { CardCosmeticGroup } from '../../../config/fortnite/locker'

import { useMemo, useRef, useState } from 'react'
import { PackageOpen, Search } from 'lucide-react'

import {
  cardCosmeticGroupLabels,
  cardCosmeticGroupOrder,
  cardGroupByBackendType,
  cosmeticRarityWeight,
} from '../../../config/fortnite/locker'

import { Input } from '../../../components/ui/input'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../../components/ui/toggle-group'
import { EmptyState, Panel, PanelBody, PanelHeader } from '../../../components/page'
import { VirtualList } from '../../../components/virtual-list'

import { CosmeticTile } from './-cosmetic-tile'

import { useColumnCount } from '../../../hooks/ui/virtual'

/** Tile width and the grid gap the row `flex` applies between them. */
const tileWidth = 112
const tileGap = 8
/** Tile plus its bottom margin — the virtualiser's first guess at a row. */
const rowHeight = tileWidth + 2 + tileGap

/**
 * Everything the account owns.
 *
 * The slot board answers "what am I wearing"; this answers "what do I have",
 * which for most accounts is a few thousand items — so it virtualises against
 * the page's own scroll pane rather than growing a box that scrolls inside a
 * page that also scrolls.
 *
 * Read-only on purpose. Equipping happens on the board, where a cosmetic is
 * being put somewhere specific: eight emote slots means picking an emote here
 * could not say *which* slot it was for.
 */
export function Collection({
  isLoading,
  owned,
}: {
  isLoading: boolean
  owned: Array<CosmeticMeta>
}) {
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<Array<CardCosmeticGroup>>([])
  const $grid = useRef<HTMLDivElement>(null)

  const columns = useColumnCount($grid, {
    gap: tileGap,
    minWidth: tileWidth,
  })

  /* Shelf counts, and which shelves this account has anything on at all. */
  const counts = useMemo(() => {
    const tally = new Map<CardCosmeticGroup, number>()

    owned.forEach((cosmetic) => {
      const group = cardGroupByBackendType.get(cosmetic.backendType)

      if (group) {
        tally.set(group, (tally.get(group) ?? 0) + 1)
      }
    })

    return tally
  }, [owned])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const wanted = new Set(groups)

    return owned
      .filter((cosmetic) => {
        if (wanted.size > 0) {
          const group = cardGroupByBackendType.get(cosmetic.backendType)

          if (!group || !wanted.has(group)) {
            return false
          }
        }

        return (
          needle.length === 0 ||
          cosmetic.name.toLowerCase().includes(needle) ||
          cosmetic.id.toLowerCase().includes(needle)
        )
      })
      .sort(
        (a, b) =>
          cosmeticRarityWeight(b.rarity) - cosmeticRarityWeight(a.rarity) ||
          a.name.localeCompare(b.name)
      )
  }, [groups, owned, query])

  const rows = Math.ceil(visible.length / columns)

  return (
    <>
      <Panel>
        <PanelHeader
          description="Every cosmetic on this account, best rarity first. Equipping is done from the Loadout tab."
          title="Collection"
        />
        <PanelBody className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
              value={query}
            />
          </div>

          <ToggleGroup
            className="flex-wrap justify-start"
            onValueChange={(value) =>
              setGroups(value as Array<CardCosmeticGroup>)
            }
            size="sm"
            type="multiple"
            value={groups}
            variant="outline"
          >
            {cardCosmeticGroupOrder
              .filter((group) => (counts.get(group) ?? 0) > 0)
              .map((group) => (
                <ToggleGroupItem
                  key={group}
                  value={group}
                >
                  {cardCosmeticGroupLabels[group]}
                  <span className="ml-1.5 text-muted-foreground">
                    {counts.get(group)?.toLocaleString()}
                  </span>
                </ToggleGroupItem>
              ))}
          </ToggleGroup>

          <p className="text-xs text-muted-foreground">
            Showing {visible.length.toLocaleString()} of{' '}
            {owned.length.toLocaleString()}
          </p>
        </PanelBody>
      </Panel>

      {visible.length > 0 ? (
        <VirtualList
          count={rows}
          estimateSize={() => rowHeight}
          getKey={(index) => `collection-row-${index}`}
          renderLine={(index) => (
            <div
              className="flex gap-2"
              style={{ paddingBottom: tileGap }}
            >
              {visible
                .slice(index * columns, (index + 1) * columns)
                .map((cosmetic) => (
                  <CosmeticTile
                    cosmetic={cosmetic}
                    key={cosmetic.templateId}
                  />
                ))}
            </div>
          )}
          sizerRef={$grid}
        />
      ) : (
        <EmptyState
          description={
            isLoading
              ? 'Reading this account’s cosmetics…'
              : owned.length === 0
                ? 'Nothing loaded yet — try Reload.'
                : 'Nothing matches that search.'
          }
          icon={PackageOpen}
          title={isLoading ? 'Loading' : 'Nothing to show'}
        />
      )}
    </>
  )
}
