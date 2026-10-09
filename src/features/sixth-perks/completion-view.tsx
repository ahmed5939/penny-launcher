import type { ItemRecordMap } from '../../kernel/core/item-database'
import type { PlanStep } from './planner'
import type { SixthPerksScan } from './types'

import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, History, ListOrdered } from 'lucide-react'

import { useItemDatabaseStore } from '../../state/items/database'
import { useSixthPerksStore } from '../../state/stw-operations/sixth-perks'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { catalog, matchWeapons, overallCompletion } from './model'
import { completionPlan } from './planner'
import { useCatalogRecords } from './records'
import { ScanActions, ScanNotices, useSixthPerksScan } from './scan'

import { ItemIcon } from '../../components/items/item-icon'
import { Chip, EmptyState, PageHeader, Pager, Panel, PanelBody, PanelHeader, StatRow, StatTile, ToolBadges, paginate } from '../../components/page'
import { Button } from '../../components/ui/button'

import { raritiesColor, RarityType } from '../../config/constants/resources'

const PAGE_SIZE = 20

const templateIds = new Map(catalog.weapons.map((weapon) => [weapon.id, weapon.templateId]))

function percent(value: number) {
  return `${value.toFixed(1)}%`
}

/** A cost figure with the game's own icon for the material. */
function CostLabel({ name, templateId }: { name: string; templateId: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <ItemIcon size="small" templateId={templateId} title={name} />
      {name}
    </span>
  )
}

/**
 * Path to completion: its own page, over the same scan as the catalog.
 * Recommendations only — nothing here crafts, upgrades or spends.
 */
export function CompletionPage() {
  useRequestItemDatabase()
  const state = useSixthPerksScan()
  const records = useCatalogRecords(useItemDatabaseStore((s) => s.records))
  const setFocusWeapon = useSixthPerksStore((s) => s.setFocusWeapon)
  const navigate = useNavigate()
  const openWeapon = (weaponId: string) => {
    setFocusWeapon(weaponId)
    void navigate({ to: '/stw-operations/sixth-perks' })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/stw-operations/sixth-perks">
                <ArrowLeft className="mr-2 size-4" />
                6th Perks
              </Link>
            </Button>
            <ScanActions state={state} />
          </>
        }
        description="The cheapest order to fill your missing 6th perks, starting with copies you already own."
        icon={ListOrdered}
        section="Save the World"
        status={<ToolBadges beta readOnly />}
        title="Path to completion"
      />
      <ScanNotices state={state} />
      {state.scan ? (
        <Plan onWeapon={openWeapon} records={records} scan={state.scan} />
      ) : state.accountId && (
        <div role={state.loading ? 'status' : undefined}>
          <EmptyState
            description={state.loading ? 'Reading inventory schematics…' : 'Scan your schematics to see each step and what it costs.'}
            icon={ListOrdered}
            title={state.loading ? 'Scanning…' : 'Scan to build your plan'}
          />
        </div>
      )}
    </div>
  )
}

function Plan({ onWeapon, records, scan }: { onWeapon: (weaponId: string) => void; records: ItemRecordMap; scan: SixthPerksScan }) {
  const rows = useMemo(() => matchWeapons(scan), [scan])
  const plan = useMemo(() => completionPlan(rows, scan), [rows, scan])
  const now = useMemo(() => overallCompletion(rows), [rows])
  const [page, setPage] = useState(0)
  const shown = paginate(plan.steps, page, PAGE_SIZE)
  const additionalCore = plan.additionalCoreLower === plan.additionalCoreUpper ? `${plan.additionalCoreLower}` : `${plan.additionalCoreLower}–${plan.additionalCoreUpper}`

  return (
    <>
      <StatRow>
        <StatTile hint={`${now.owned.toLocaleString()} of ${now.total.toLocaleString()} perks`} label="Now" value={percent(now.percent)} />
        <StatTile
          accent={raritiesColor[RarityType.Legendary]}
          hint={`${plan.readyCount.toLocaleString()} ${plan.readyCount === 1 ? 'step' : 'steps'}${plan.partial ? ' · provisional' : ''}`}
          label="With copies you own"
          value={percent(plan.afterReadyPercent)}
        />
        <StatTile hint="If you get every extra schematic" label="Catalog ceiling" value={percent(plan.catalogCeilingPercent)} />
      </StatRow>

      <Panel>
        <PanelHeader compact title="Cost with copies you own" />
        <PanelBody className="space-y-4">
          <StatRow>
            <StatTile label={<CostLabel name="Legendary Flux" templateId="AccountResource:reagent_evolverarity_sr" />} value={plan.legendaryFlux.toLocaleString()} />
            <StatTile label={<CostLabel name="Epic Flux" templateId="AccountResource:reagent_evolverarity_vr" />} value={plan.epicFlux.toLocaleString()} />
            <StatTile label={<CostLabel name="Core RE-PERK" templateId="AccountResource:reagent_alteration_gameplay_generic" />} value={plan.core.toLocaleString()} />
            <StatTile hint={`of ${plan.fixedTotal} with a fixed starting perk`} label="Fixed-start weapons to re-perk" value={plan.fixedMissing.toLocaleString()} />
          </StatRow>
          <p className="text-xs text-muted-foreground">
            {plan.extraSchematics > 0 && `Then ${plan.extraSchematics.toLocaleString()} more ${plan.extraSchematics === 1 ? 'schematic' : 'schematics'} and ${additionalCore} more Core RE-PERK, depending on what they roll. `}
            Getting, researching, unslotting, levelling and evolving schematics cost extra.
          </p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader compact title={`${plan.steps.length.toLocaleString()} ${plan.steps.length === 1 ? 'step' : 'steps'}`} />
        {plan.steps.length === 0 ? (
          <EmptyState className="border-0 bg-transparent py-8" icon={ListOrdered} title="Nothing left to do" description="Every current 6th perk is covered." />
        ) : (
          <ol className="divide-y divide-border/40">
            {shown.items.map((step, index) => (
              <StepRow index={shown.page * PAGE_SIZE + index + 1} key={`${step.weaponId}:${step.perk}:${step.copyId ?? index}`} onWeapon={onWeapon} records={records} step={step} />
            ))}
          </ol>
        )}
        <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={plan.steps.length} />
      </Panel>

      {plan.blocked.length > 0 && (
        <Panel>
          <PanelHeader compact icon={History} title={`${plan.blocked.length} historical ${plan.blocked.length === 1 ? 'perk' : 'perks'} with no known way to get`} />
          <ul className="divide-y divide-border/40">
            {plan.blocked.map((step, index) => (
              <StepRow blocked key={`${step.weaponId}:${step.perk}:${index}`} onWeapon={onWeapon} records={records} step={step} />
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}

function StepRow({ blocked, index, onWeapon, records, step }: { blocked?: boolean; index?: number; onWeapon: (weaponId: string) => void; records: ItemRecordMap; step: PlanStep }) {
  const templateId = templateIds.get(step.weaponId)

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      {typeof index === 'number' && <span className="figure w-6 shrink-0 pt-2 text-right text-xs text-muted-foreground">{index}</span>}
      {templateId && <ItemIcon records={records} size="large" templateId={templateId} title={step.weapon} />}
      <div className="min-w-0 flex-1">
        <button className="text-ui font-semibold text-primary hover:underline" onClick={() => onWeapon(step.weaponId)} type="button">
          {step.weapon}
        </button>
        <p className="text-ui leading-snug">{step.perk}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{step.action}</p>
        {step.copyId && <p className="mt-0.5 break-all font-mono text-2xs text-muted-foreground">{step.copyId}</p>}
      </div>
      {!blocked && (
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {step.conditional && <Chip tone="warning">Needs another schematic</Chip>}
          {step.core > 0 && <Chip>{step.core} Core RE-PERK</Chip>}
          {step.legendaryFlux > 0 && <Chip>{step.legendaryFlux} Legendary Flux</Chip>}
          {step.epicFlux > 0 && <Chip>{step.epicFlux} Epic Flux</Chip>}
        </div>
      )}
    </li>
  )
}
