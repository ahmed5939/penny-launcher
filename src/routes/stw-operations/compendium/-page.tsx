import type { CompendiumFamily } from './-hooks'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { SegmentedOption } from '../../../components/page'

import { BookOpen, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GoToTop } from '../../../components/go-to-top'
import { Input } from '../../../components/ui/input'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemTile } from '../../../components/items/item-tile'
import { VirtualList } from '../../../components/virtual-list'
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  Segmented,
} from '../../../components/page'

import { compendiumFamilyLabels, useCompendiumData } from './-hooks'

import { useColumnCount } from '../../../hooks/ui/virtual'

const familyOptions: Array<SegmentedOption<CompendiumFamily>> = (
  ['hero', 'melee', 'ranged', 'trap', 'defender', 'survivor'] as const
).map((family) => ({
  label: compendiumFamilyLabels[family],
  value: family,
}))

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={BookOpen}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.compendium')}
        description="Every hero, weapon, trap, defender and survivor in the game — whether you own it or not. No account needed."
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
    isLoading,
    ratings,
    records,
    search,
    setFamily,
    setSearch,
    total,
  } = useCompendiumData()

  return (
    <>
      <Panel id="compendium-card">
        <PanelBody className="space-y-3">
          <Segmented
            onChange={setFamily}
            options={familyOptions}
            value={family}
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${compendiumFamilyLabels[family].toLowerCase()}`}
                value={search}
              />
            </label>
            <p className="text-xs tabular-nums text-muted-foreground">
              {entries.length} shown · {total.toLocaleString()} in database
            </p>
          </div>
        </PanelBody>
      </Panel>

      {total <= 0 ? (
        <EmptyState
          description={
            isLoading
              ? 'Downloading the game data. This happens once, then it is cached.'
              : 'The item database has not been downloaded yet. It is fetched on startup — restart the app if this persists.'
          }
          icon={BookOpen}
          title={isLoading ? 'Building the compendium' : 'No data yet'}
        />
      ) : entries.length > 0 ? (
        <Panel>
          <CompendiumGrid
            entries={entries}
            onInspect={setDetail}
            records={records}
          />
        </Panel>
      ) : (
        <EmptyState
          description="Nothing matches that search."
          icon={Search}
          title="No results"
        />
      )}

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

      <GoToTop containerId="compendium-card" />
    </>
  )
}

/** The tile grid's own metrics, shared by the CSS and the virtualiser. */
const tileMinWidth = 96
const tileGap = 8
/** Name bar plus footer — the part of a tile that is not the square plate. */
const estimatedNameBar = 46

/**
 * The whole game's item list, of which a few rows exist at a time.
 *
 * A family can run past a thousand entries, and each tile is a bordered plate
 * with two images on it. Rendering them all is what made this page take a
 * second to answer a keystroke in the search box.
 */
function CompendiumGrid({
  entries,
  onInspect,
  records,
}: {
  entries: ReturnType<typeof useCompendiumData>['entries']
  onInspect: (subject: ItemDetailSubject) => void
  records: ReturnType<typeof useCompendiumData>['records']
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
