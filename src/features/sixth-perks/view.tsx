import type { ItemRecordMap } from '../../kernel/core/item-database'
import type { ChipTone } from '../../components/page'
import type { MatchCopy, OptionResult, SixthPerksScan, WeaponResult } from './types'

import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleHelp, ListOrdered, Swords } from 'lucide-react'

import { useItemDatabaseStore } from '../../state/items/database'
import { useSixthPerksStore } from '../../state/stw-operations/sixth-perks'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { completionProgress, filterWeapons, matchesPerkFilter, matchWeapons, overallCompletion, ownership, scanStatistics } from './model'
import { fixedStarts } from './planner'
import { useCatalogRecords } from './records'
import { ScanActions, ScanNotices, useSixthPerksScan } from './scan'

import { DetailHeader, DetailSection, PerkSlotRow } from '../../components/items/detail-parts'
import { ItemIcon } from '../../components/items/item-icon'
import { Chip, EmptyState, FilterBar, PageHeader, Pager, Panel, PanelBody, PanelHeader, Picker, ProgressBar, SearchField, StatRow, StatTile, ToolBadges, paginate } from '../../components/page'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent } from '../../components/ui/dialog'

import { raritiesColor, RarityType } from '../../config/constants/resources'

const PAGE_SIZE = 24

type PerkFilter = 'all' | 'perk-missing' | 'perk-owned' | 'perk-upgrade' | 'perk-book'
type Category = 'all' | 'Ranged' | 'Melee'
type Scope = 'all' | 'current'

/** Missing perks on a weapon whose completion is known, else null (unknown or Epic-only). */
function missingCount(weapon: WeaponResult) {
  const { owned, total } = completionProgress(weapon)
  if (!total) return null
  const missing = total - owned
  return missing > 0 && (weapon.inventoryUnknown || weapon.bookUnknown || weapon.unresolved.length > 0) ? null : missing
}

/** The perk rows a card shows under the current filter. */
function visibleOptions(weapon: WeaponResult, scope: Scope, perkFilter: PerkFilter) {
  return weapon.options.filter((option) => (scope === 'all' || option.availability === 'current') && matchesPerkFilter(option, weapon, perkFilter))
}

function ownershipTone(option: OptionResult, label: string): ChipTone {
  if (label === 'Missing') return 'danger'
  if (option.inventory.some((copy) => copy.countsForCompletion)) return 'success'
  if (option.book.some((copy) => copy.countsForCompletion)) return 'accent'
  if ([...option.inventory, ...option.book].some((copy) => copy.rarity === 'Epic')) return 'warning'
  return 'neutral'
}

/** Where a perk is owned — or, in red, that it is confirmed missing. Unknown stays unknown. */
function OwnershipChip({ option, weapon }: { option: OptionResult; weapon: WeaponResult }) {
  const label = ownership(option, weapon)
  return <Chip tone={ownershipTone(option, label)}>{label}</Chip>
}

function AvailabilityChips({ option, weapon }: { option: OptionResult; weapon: WeaponResult }) {
  return (
    <>
      {fixedStarts[weapon.id]?.defaultPerkId === option.id && <Chip>Starting perk</Chip>}
      {option.availability === 'historical' && <Chip>Historical · no longer rolls</Chip>}
      {option.availability === 'observed' && <Chip>Seen on this account</Chip>}
      {option.availability === 'website-listed' && <Chip tone="warning">Unverified</Chip>}
    </>
  )
}

export function SixthPerksPage() {
  useRequestItemDatabase()
  const state = useSixthPerksScan()

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/stw-operations/sixth-perks/completion">
                <ListOrdered className="mr-2 size-4" />
                Path to completion
              </Link>
            </Button>
            <ScanActions state={state} />
          </>
        }
        description="Every Legendary weapon's 6th perk options, and which ones your schematics already have."
        icon={Swords}
        section="Save the World"
        status={<ToolBadges beta readOnly />}
        title="6th Perks"
      />
      <ScanNotices state={state} />
      {/* Keyed so filters and the open weapon reset with the account or the book setting. */}
      <Catalog includeBook={state.includeBook} key={`${state.accountId ?? 'catalog'}:${state.includeBook}`} scan={state.scan} />
    </div>
  )
}

function Catalog({ includeBook, scan }: { includeBook: boolean; scan: SixthPerksScan | null }) {
  const records = useCatalogRecords(useItemDatabaseStore((s) => s.records))
  const rows = useMemo(() => matchWeapons(scan), [scan])
  const [query, setQuery] = useState('')
  const [perkFilter, setPerkFilter] = useState<PerkFilter>('all')
  const [category, setCategory] = useState<Category>('all')
  const [scope, setScope] = useState<Scope>('all')
  const [missing, setMissing] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  // The planner sends the user here to look at one weapon; open it once.
  const [selected, select] = useState<string | null>(() => useSixthPerksStore.getState().focusWeapon)
  useEffect(() => {
    useSixthPerksStore.getState().setFocusWeapon(null)
  }, [])

  // Filters narrow the list only; the figures above always cover the whole catalog.
  const filtered = useMemo(
    () => filterWeapons(rows, query, perkFilter, category).filter((weapon) => visibleOptions(weapon, scope, perkFilter).length > 0 && (missing === null || missingCount(weapon) === missing)),
    [rows, query, perkFilter, category, scope, missing],
  )
  const shown = paginate(filtered, page, PAGE_SIZE)
  const detail = rows.find((weapon) => weapon.id === selected) ?? null
  const reset = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setPage(0)
  }

  return (
    <>
      <Summary missing={missing} onMissing={reset(setMissing)} rows={rows} scan={scan} />
      <Panel>
        <PanelHeader compact title={`${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'weapon' : 'weapons'}`} />
        <FilterBar>
          <SearchField label="Search weapons or perks" onChange={reset(setQuery)} placeholder="Weapon or perk" value={query} />
          <Picker
            label="6th perk filter"
            onChange={reset(setPerkFilter)}
            options={[
              { value: 'all', label: 'All 6th perks' },
              { value: 'perk-missing', label: 'Missing', disabled: !scan },
              { value: 'perk-owned', label: 'Owned', disabled: !scan },
              { value: 'perk-upgrade', label: 'Needs upgrading', disabled: !scan },
              { value: 'perk-book', label: 'In Collection Book', disabled: !scan || !includeBook },
            ]}
            value={perkFilter}
          />
          <Picker
            label="Weapon category"
            onChange={reset(setCategory)}
            options={[
              { value: 'all', label: 'Ranged & melee' },
              { value: 'Ranged', label: 'Ranged' },
              { value: 'Melee', label: 'Melee' },
            ]}
            value={category}
          />
          <Picker
            label="Perks shown"
            onChange={reset(setScope)}
            options={[
              { value: 'all', label: 'Current & historical perks' },
              { value: 'current', label: 'Current perks only' },
            ]}
            value={scope}
          />
        </FilterBar>
        {filtered.length === 0 ? (
          <EmptyState className="border-0 bg-transparent py-8" description="Try another search or filter." icon={Swords} title="No matching weapons" />
        ) : (
          <PanelBody>
            <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {shown.items.map((weapon) => (
                <WeaponCard key={weapon.id} onOpen={() => select(weapon.id)} options={visibleOptions(weapon, scope, perkFilter)} records={records} scanned={Boolean(scan)} weapon={weapon} />
              ))}
            </ul>
          </PanelBody>
        )}
        <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={filtered.length} />
      </Panel>
      <WeaponDialog onClose={() => select(null)} records={records} scanned={Boolean(scan)} weapon={detail} />
    </>
  )
}

/** Completion across the whole catalog, then weapons grouped by how many perks they miss. */
function Summary({ missing, onMissing, rows, scan }: { missing: number | null; onMissing: (value: number | null) => void; rows: Array<WeaponResult>; scan: SixthPerksScan | null }) {
  const progress = useMemo(() => overallCompletion(rows), [rows])
  const statistics = useMemo(() => scanStatistics(rows), [rows])

  if (!scan) {
    return (
      <StatRow>
        <StatTile hint="Scan to check your schematics" label="6th perk completion" value="—" />
        <StatTile label="Legendary weapons" value={statistics.eligible.toLocaleString()} />
        <StatTile label="Legendary 6th perks" value={progress.total.toLocaleString()} />
      </StatRow>
    )
  }

  return (
    <StatRow>
      <StatTile
        accent={raritiesColor[RarityType.Legendary]}
        hint={`${progress.partial ? 'At least ' : ''}${progress.owned.toLocaleString()} of ${progress.total.toLocaleString()} Legendary perks`}
        label="6th perk completion"
        value={`${progress.percent.toFixed(1)}%`}
      >
        <ProgressBar className="mt-2" label="6th perk completion" total={progress.total} value={progress.owned} />
      </StatTile>
      {statistics.groups.map((group) => (
        <StatTile
          hint={group.count === 1 ? 'weapon' : 'weapons'}
          key={group.missing}
          label={group.missing === 0 ? 'Complete' : `Missing ${group.missing}`}
          onClick={() => onMissing(missing === group.missing ? null : group.missing)}
          pressed={missing === group.missing}
          tone={group.missing === 0 && group.count > 0 ? 'success' : 'default'}
          value={group.count.toLocaleString()}
        />
      ))}
      {statistics.unknown > 0 && <StatTile hint="weapons" label="Unknown" tone="warning" value={statistics.unknown.toLocaleString()} />}
    </StatRow>
  )
}

function WeaponCard({ onOpen, options, records, scanned, weapon }: { onOpen: () => void; options: Array<OptionResult>; records: ItemRecordMap; scanned: boolean; weapon: WeaponResult }) {
  const { owned, total } = completionProgress(weapon)
  const accent = raritiesColor[weapon.legendaryAvailable ? RarityType.Legendary : RarityType.Epic]
  const counts = [
    `Inventory ${weapon.inventoryUnknown ? '?' : weapon.inventoryCount}`,
    weapon.bookCount > 0 || weapon.bookUnknown ? `Book ${weapon.bookUnknown ? '?' : weapon.bookCount}` : null,
  ].filter(Boolean)

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-muted/25" style={{ borderLeft: `3px solid ${accent}` }}>
      <button className="flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/30" onClick={onOpen} type="button">
        <ItemIcon records={records} size="xl" templateId={weapon.templateId} title={weapon.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui font-semibold">{weapon.name}</span>
          <span className="block truncate text-caption text-muted-foreground">
            {weapon.category}
            {!weapon.legendaryAvailable
              ? ' · Epic only · not counted'
              : scanned
                ? ` · ${owned} of ${total} · ${counts.join(' · ')}`
                : ` · ${total} ${total === 1 ? 'perk' : 'perks'}`}
          </span>
          {scanned && weapon.legendaryAvailable && <ProgressBar className="mt-2" label={`${weapon.name} completion`} total={total} value={owned} />}
        </span>
      </button>
      <ul className="divide-y divide-border/40 px-3 pb-1">
        {options.map((option) => (
          <li className="py-2.5" key={option.id}>
            <p className="text-ui leading-snug">{option.description}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {scanned && <OwnershipChip option={option} weapon={weapon} />}
              <AvailabilityChips option={option} weapon={weapon} />
            </div>
          </li>
        ))}
      </ul>
      {weapon.unresolved.length > 0 && (
        <p className="px-3 pb-3 text-xs text-muted-foreground">
          {weapon.unresolved.length} {weapon.unresolved.length === 1 ? 'copy has' : 'copies have'} no readable 6th perk.
        </p>
      )}
    </li>
  )
}

function copyLine(copy: MatchCopy) {
  const note = copy.rarity === 'Epic' ? 'counts once upgraded to Legendary' : copy.active === false ? 'unlocks at a higher level' : null
  return [copy.location === 'inventory' ? 'Inventory' : 'Collection Book', copy.rarity, `Lv ${copy.level ?? '?'}`, `slot ${copy.slotIndex + 1}`, note].filter(Boolean).join(' · ')
}

/** Every copy of every perk, with its item and perk IDs. Nothing here is hidden by the summary. */
function WeaponDialog({ onClose, records, scanned, weapon }: { onClose: () => void; records: ItemRecordMap; scanned: boolean; weapon: WeaponResult | null }) {
  const progress = weapon ? completionProgress(weapon) : null

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(weapon)}>
      <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {weapon && progress && (
          <>
            <DetailHeader
              badges={fixedStarts[weapon.id] && <Chip>Fixed starting perk · others cost a Core RE-PERK each</Chip>}
              facts={
                scanned && (
                  <>
                    <span>Inventory {weapon.inventoryUnknown ? 'unknown' : weapon.inventoryCount}</span>
                    {(weapon.bookCount > 0 || weapon.bookUnknown) && <span>Collection Book {weapon.bookUnknown ? 'unknown' : weapon.bookCount}</span>}
                    {weapon.legendaryAvailable && <span>{progress.owned} of {progress.total} perks</span>}
                  </>
                )
              }
              meta={[weapon.category, !weapon.legendaryAvailable && 'not counted toward completion']}
              name={weapon.name}
              rarity={weapon.legendaryAvailable ? 'Legendary' : 'Epic'}
              records={records}
              templateId={weapon.templateId}
            />
            <DetailSection icon={Swords} title="6th perks">
              <ul className="space-y-1.5">
                {weapon.options.map((option, index) => {
                  const copies = [...option.inventory, ...option.book]
                  return (
                    <PerkSlotRow id={option.matchIds.join(' · ') || null} index={index} key={option.id} title={option.description}>
                      {scanned && <OwnershipChip option={option} weapon={weapon} />}
                      <AvailabilityChips option={option} weapon={weapon} />
                      {copies.length > 0 && (
                        <ul className="mt-1 basis-full space-y-1 text-caption text-muted-foreground">
                          {copies.map((copy) => (
                            <li key={`${copy.location}:${copy.id}:${copy.perkId}`}>
                              {copyLine(copy)}
                              <span className="block break-all font-mono text-2xs" title={copy.perkId}>{copy.id}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </PerkSlotRow>
                  )
                })}
              </ul>
            </DetailSection>
            {weapon.unresolved.length > 0 && (
              <DetailSection icon={CircleHelp} title="Copies without a readable 6th perk">
                <ul className="space-y-1 text-caption text-muted-foreground">
                  {weapon.unresolved.map(({ copy, location }) => (
                    <li key={`${location}:${copy.id}`}>
                      {location === 'book' ? 'Collection Book' : 'Inventory'}
                      <span className="block break-all font-mono text-2xs">{copy.id}</span>
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
