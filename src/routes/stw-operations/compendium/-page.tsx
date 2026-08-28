import type { CompendiumFamily } from './-hooks'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { SegmentedOption } from '../../../components/page'

import { BookOpen, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GoToTop } from '../../../components/go-to-top'
import { Input } from '../../../components/ui/input'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemTile } from '../../../components/items/item-tile'
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  Segmented,
} from '../../../components/page'

import { compendiumFamilyLabels, useCompendiumData } from './-hooks'

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
          <div className="flex flex-wrap gap-2 p-3">
            {entries.map((entry) => (
              <ItemTile
                footer={
                  entry.tiers > 1 ? `${entry.tiers} tiers` : entry.subType
                }
                key={entry.templateId}
                name={entry.name}
                onClick={() => setDetail({ templateId: entry.templateId })}
                records={records}
                templateId={entry.templateId}
                tier={entry.tier}
              />
            ))}
          </div>
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
