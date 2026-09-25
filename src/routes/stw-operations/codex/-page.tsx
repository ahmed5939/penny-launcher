import type { CodexFamily } from './-hooks'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { SegmentedOption } from '../../../components/page'

import { BookOpen, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GoToTop } from '../../../components/go-to-top'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemTile } from '../../../components/items/item-tile'
import { VirtualList } from '../../../components/virtual-list'
import {
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  Picker,
  SearchField,
  Segmented,
} from '../../../components/page'

import { codexFamilyLabels, codexSortOptions, useCodexData } from './-hooks'

import { useColumnCount } from '../../../hooks/ui/virtual'

const familyOptions: Array<SegmentedOption<CodexFamily>> = (
  ['hero', 'melee', 'ranged', 'trap', 'defender', 'survivor'] as const
).map((family) => ({
  label: codexFamilyLabels[family],
  value: family,
}))

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={BookOpen}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.codex')}
        description="Every hero, weapon, trap, defender and survivor in the game, whether you own it or not. Pick one to see its perks and stats."
      />
      <Content />
    </>
  )
}

function Content() {
  const [detail, setDetail] = useState<ItemDetailSubject | null>(null)

  const {
    alterationPools,
    entries,
    family,
    familyTotal,
    isLoading,
    rarities,
    rarity,
    ratings,
    records,
    search,
    setFamily,
    setRarity,
    setSearch,
    setSort,
    sort,
    total,
  } = useCodexData()
  const familyLabel = codexFamilyLabels[family].toLowerCase()

  return (
    <>
      {/*
        One panel: the family and filters sit directly on the grid they
        filter, not in a box of their own above it.
      */}
      <Panel id="codex-card">
        <FilterBar>
          <Segmented
            onChange={(next) => {
              setFamily(next)
              setRarity('all')
            }}
            options={familyOptions}
            value={family}
          />
          <SearchField
            label={`Search ${familyLabel}`}
            onChange={setSearch}
            placeholder={`Search ${familyLabel}`}
            value={search}
          />
          <Picker
            disabled={rarities.length <= 1}
            label="Rarity"
            onChange={setRarity}
            options={[
              { label: 'All rarities', value: 'all' },
              ...rarities.map((value) => ({ label: value, value })),
            ]}
            value={rarity}
          />
          <Picker
            label="Sort order"
            onChange={setSort}
            options={codexSortOptions}
            value={sort}
          />
          <span className="text-xs text-muted-foreground">
            <span className="figure text-foreground">
              {entries.length.toLocaleString()}
            </span>{' '}
            of <span className="figure">{familyTotal.toLocaleString()}</span>
          </span>
        </FilterBar>

        {total <= 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-10"
            description={
              isLoading
                ? 'Downloading the game data. This happens once, then it is cached.'
                : 'The item database has not been downloaded yet. It is fetched on startup — restart the app if this persists.'
            }
            icon={BookOpen}
            title={isLoading ? 'Building the codex' : 'No data yet'}
          />
        ) : entries.length > 0 ? (
          <CodexGrid
            entries={entries}
            onInspect={setDetail}
            records={records}
          />
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-10"
            description="Try another rarity, or clear the search."
            icon={Search}
            title={`No ${familyLabel} match`}
          />
        )}
      </Panel>

      <ItemDetailDialog
        alterationPools={alterationPools}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null)
          }
        }}
        ratings={ratings}
        records={records}
        subject={detail}
      />

      <GoToTop containerId="codex-card" />
    </>
  )
}

/** The tile grid's own metrics, shared by the CSS and the virtualiser. */
const tileMinWidth = 132
const tileGap = 12
/** Eyebrow, name and footer — the part of a tile that is not the artboard. */
const estimatedNameBar = 52

/**
 * The whole game's item list, of which a few rows exist at a time.
 *
 * A family can run past a thousand entries, and each tile is a bordered plate
 * with two images on it. Rendering them all is what made this page take a
 * second to answer a keystroke in the search box.
 */
function CodexGrid({
  entries,
  onInspect,
  records,
}: {
  entries: ReturnType<typeof useCodexData>['entries']
  onInspect: (subject: ItemDetailSubject) => void
  records: ReturnType<typeof useCodexData>['records']
}) {
  const $grid = useRef<HTMLDivElement>(null)

  const columns = useColumnCount($grid, {
    gap: tileGap,
    minWidth: tileMinWidth,
  })

  const rows = useMemo(() => {
    const result: Array<typeof entries> = []

    for (let index = 0; index < entries.length; index += columns) {
      result.push(entries.slice(index, index + columns))
    }

    return result
  }, [columns, entries])

  return (
    <VirtualList
      className="p-3"
      count={rows.length}
      estimateSize={() => tileMinWidth + estimatedNameBar + tileGap}
      getKey={(index) => rows[index][0]?.templateId ?? String(index)}
      renderLine={(index) => (
        <div
          className="grid"
          style={{
            gap: tileGap,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            paddingBottom: tileGap,
          }}
        >
          {rows[index].map((entry) => (
            <ItemTile
              className="w-full"
              footer={entry.tiers > 1 ? `${entry.tiers} tiers` : entry.subType}
              key={entry.templateId}
              name={entry.name}
              onClick={() => onInspect({ templateId: entry.templateId })}
              records={records}
              templateId={entry.templateId}
              tier={entry.tier}
            />
          ))}
        </div>
      )}
      sizerRef={$grid}
    />
  )
}
