import type { CollectionBookData } from '../../../features/collection-book/types'

import { useMemo, useState } from 'react'

import { bookCosts } from '../../../features/collection-book/costs'

import { Callout, Panel, PanelBody, PanelHeader, Segmented } from '../../../components/page'

import { cn } from '../../../lib/utils'

const names: Record<string, string> = {
  peoplexp: 'People XP',
  schematicxp: 'Schematic XP',
  reagent_people: 'Training Manuals',
  reagent_schematic: 'Schematic Designs',
  reagent_c_t01: 'Pure Drops of Rain',
  reagent_c_t02: 'Lightning in a Bottle',
  reagent_c_t03: 'Eye of the Storm',
  reagent_c_t04: 'Storm Shard',
}

export function Resources({ data, label }: { data: CollectionBookData; label: (id: string) => string }) {
  const [path, setPath] = useState<'ore' | 'crystal'>('ore')
  const totals = useMemo(() => bookCosts(data.slotted, path), [data.slotted, path])
  const ids = [...new Set([...Object.keys(names).map((k) => 'accountresource:' + k), ...Object.keys(totals.invested), ...Object.keys(totals.remaining)])]
  const partialInvested = totals.unknown.length + totals.unknownInvested.length > 0
  const partialRemaining = totals.unknown.length > 0
  const atMax = totals.count - totals.upgrades - totals.unknown.length

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          actions={
            totals.choices > 0 ? (
              <span className="flex items-center gap-2">
                <span className="micro-label">Unevolved path</span>
                <Segmented onChange={setPath} options={[{ value: 'ore', label: 'Ore' }, { value: 'crystal', label: 'Crystal' }]} value={path} />
              </span>
            ) : undefined
          }
          description={<>All <span className="figure">{data.slotted.length.toLocaleString()}</span> slotted items · <span className="figure">{totals.upgrades}</span> need upgrading · <span className="figure">{atMax}</span> already at their natural maximum.{totals.choices > 0 && <> {totals.choices} item{totals.choices === 1 ? '' : 's'} have not chosen an evolution path yet; items that already have one keep it.</>}</>}
          title="Investment and remaining cost"
        />
        {totals.unknown.length > 0 && (
          <div className="px-5 pt-4">
            <Callout tone="warning">Costs are unavailable for {totals.unknown.length} item{totals.unknown.length === 1 ? '' : 's'}. The totals below are incomplete.</Callout>
          </div>
        )}
        <PanelBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left">
                <th className="micro-label px-5 py-3 font-semibold">Resource</th>
                <th className="micro-label px-4 py-3 text-right font-semibold">Invested{partialInvested && ' · partial'}</th>
                <th className="micro-label px-4 py-3 text-right font-semibold">To max{partialRemaining && ' · partial'}</th>
                <th className="micro-label px-4 py-3 text-right font-semibold">Owned</th>
                <th className="micro-label px-5 py-3 text-right font-semibold">Shortfall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {ids.map((id) => {
                const need = totals.remaining[id] ?? 0
                const has = data.resources[id] ?? 0
                const short = Math.max(0, need - has)
                return (
                  <tr className="hover:bg-muted/30" key={id}>
                    <td className="px-5 py-2.5 font-medium">{names[id.split(':').pop()!] ?? label(id)}</td>
                    <td className="figure px-4 py-2.5 text-right text-muted-foreground">{(totals.invested[id] ?? 0).toLocaleString()}</td>
                    <td className="figure px-4 py-2.5 text-right">{need.toLocaleString()}</td>
                    <td className="figure px-4 py-2.5 text-right text-muted-foreground">{has.toLocaleString()}</td>
                    <td className={cn('figure px-5 py-2.5 text-right', short > 0 ? 'font-semibold text-warning' : 'text-muted-foreground')}>{short > 0 ? short.toLocaleString() : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </PanelBody>
      </Panel>

      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p>Invested is today’s cost to recreate each item’s level and evolutions from level 1 at its current rarity — not a record of what was spent. It excludes acquisition, rarity increases, perk changes, refunds and superchargers. Missing slots are not counted.</p>
        {totals.unknownInvested.length > 0 && (
          <p>Investment leaves out {totals.unknownInvested.length} item{totals.unknownInvested.length === 1 ? '' : 's'} whose earlier evolution route cannot be verified: {data.slotted.filter((i) => totals.unknownInvested.includes(i.id)).map((i) => label(i.templateId)).join(', ')}. Their remaining upgrade costs are still included.</p>
        )}
      </div>
    </div>
  )
}
