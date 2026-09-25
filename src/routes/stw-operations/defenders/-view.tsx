import { useMemo, useState } from 'react'
import { ShieldHalf, Star, Swords } from 'lucide-react'
import type { InventoryItem } from '../../../kernel/core/inventory'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { RatingTables } from '../../../config/constants/fortnite/power'
import type { DefenderCatalog, WeaponMatch } from '../../../features/defenders/types'
import catalogData from '../../../features/defenders/catalog.json'
import { assessDefender, compareDefenders } from '../../../features/defenders/assess'
import { matchWeapons } from '../../../features/defenders/weapons'
import { computeItemPower } from '../../../config/constants/fortnite/power'
import { rarityLabels } from '../../../config/constants/fortnite/items'
import { ItemIcon } from '../../../components/items/item-icon'
import { getItemRecord } from '../../../state/items/database'
import { StatRow, StatTile, Chip, vaultRarityColors, PageHeader, Panel, PanelHeader, PanelBody, EmptyState, Callout, FilterBar, Pager, Picker, RefreshButton, SearchField, ToolBadges, paginate } from '../../../components/page'

const catalog = catalogData as DefenderCatalog
const WEAPON_PAGE_SIZE = 6

export type DefendersViewProps = {
  accountSelected: boolean; loading: boolean; error: string | null; items: InventoryItem[]
  records: ItemRecordMap; ratings: RatingTables; onRefresh: () => void
  /** Rendered inside the vault's Defender tab, which owns the header and Refresh. */
  embedded?: boolean
}
export function DefendersView({ accountSelected, loading, error, items, records, ratings, onRefresh, embedded }: DefendersViewProps) {
  const [classFilter, setClassFilter] = useState('All')
  const [rarityFilter, setRarityFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('usefulness')
  const [selection, setSelection] = useState<string | null>(null)
  const [role, setRole] = useState('All')
  const [weaponOrder, setWeaponOrder] = useState('fit')
  const [weaponPage, setWeaponPage] = useState(0)
  const defenders = useMemo(() => items.filter(i => i.kind === 'defender').map(i => assessDefender(i, catalog)).sort(compareDefenders), [items])
  const visible = useMemo(() => defenders.filter(d => (classFilter === 'All' || d.className === classFilter)
    && (rarityFilter === 'All' || d.item.rarity === rarityFilter)
    && `${getItemRecord(records, d.item.templateId)?.name ?? ''} ${d.item.name} ${d.item.itemId} ${d.perks.map(p => p.description).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    .sort(sort === 'level' ? (a,b) => b.item.level-a.item.level || compareDefenders(a,b) : compareDefenders), [defenders, classFilter, rarityFilter, records, search, sort])
  const active = visible.find(d => d.item.itemId === selection) ?? visible[0]
  const matches = useMemo(() => active ? matchWeapons(active, items, catalog) : [], [active, items])
  const filteredMatches = matches.filter(w => role === 'All' || w.roles.includes(role)).sort((a,b) => weaponOrder === 'level' ? b.item.level - a.item.level || b.relevance - a.relevance : b.relevance - a.relevance || b.item.level - a.item.level)
  const knownSchematics = items.filter(i => i.kind === 'schematic' && catalog.schematics[i.templateId.toLowerCase()]).length
  const shownWeapons = paginate(filteredMatches, weaponPage, WEAPON_PAGE_SIZE)
  const power = (item: InventoryItem) => computeItemPower({ tables: ratings, templateId: item.templateId, level: item.level })
  /** The game's name for the defender; the class is only a fallback for an item the database does not know. */
  const nameOf = (d: { item: InventoryItem; className: string | null }) => getItemRecord(records, d.item.templateId)?.name ?? `${d.className ?? 'Unknown'} defender`
  return <div id="penny-defenders" className="space-y-5">
    {!embedded && <PageHeader section="Save the World" title="Defenders" icon={ShieldHalf}
      description="Find strong weapon rolls, then choose weapons that make the most of them."
      status={<ToolBadges beta />}
      actions={<RefreshButton disabled={!accountSelected} loading={loading} onClick={onRefresh} />} />}
    {/* Once there are defenders on screen a refresh keeps them there; only the button spins. */}
    {!accountSelected ? <EmptyState icon={ShieldHalf} title="Choose an account" description="Select an account in Penny’s title bar to compare its defenders and weapon schematics." />
      : error && defenders.length === 0 ? <div role="alert"><Callout tone="danger" title="Could not load defenders">{error}</Callout></div>
      : loading && defenders.length === 0 ? <div role="status"><EmptyState icon={ShieldHalf} title="Loading your defenders…" description="Reading the selected account’s inventory." /></div>
      : defenders.length === 0 ? <EmptyState icon={ShieldHalf} title="No defenders found" description="This account’s campaign inventory has no defenders." />
      : <>
        {error && <div role="alert"><Callout tone="warning" title="Could not refresh defenders">{error} Showing the last loaded inventory.</Callout></div>}
        <StatRow><StatTile icon={ShieldHalf} label="Defenders" value={defenders.length} /><StatTile accent={vaultRarityColors.legendary} icon={Star} label="Strong weapon rolls" value={defenders.filter(d => d.band === 4).length} /><StatTile icon={Swords} label="Weapon schematics" value={knownSchematics} /></StatRow>
        <Panel><FilterBar className="border-b-0">
          <SearchField label="Find a defender" onChange={setSearch} placeholder="Name or perk" value={search} />
          <Picker label="Class" value={classFilter} onChange={setClassFilter} options={['All','Assault','Pistol','Sniper','Shotgun','Melee'].map(v => ({value:v,label:v === 'All' ? 'All classes' : v}))} />
          <Picker label="Rarity" value={rarityFilter} onChange={setRarityFilter} options={[{value:'All',label:'All rarities'}, ...Object.entries(rarityLabels).filter(([value]) => value !== 'mythic').map(([value,label]) => ({value,label}))]} />
          <Picker label="Sort" value={sort} onChange={setSort} options={[{value:'usefulness',label:'Weapon-roll usefulness'},{value:'level',label:'Current level'}]} />
        </FilterBar></Panel>
        {!active ? <EmptyState icon={ShieldHalf} title="No matching defenders" description="Try a different class, rarity or search." /> : <div className="grid items-start gap-5 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.6fr)]">
          <Panel><PanelHeader as="div" compact title={<span className="flex items-baseline gap-2"><span className="figure">{visible.length}</span><span className="text-muted-foreground">defender{visible.length === 1 ? '' : 's'}</span></span>} /><PanelBody className="max-h-[700px] divide-y divide-border/50 overflow-y-auto p-0">
            {visible.map(d => <button key={d.item.itemId} type="button" aria-pressed={active.item.itemId === d.item.itemId} onClick={() => { setSelection(d.item.itemId); setWeaponPage(0) }} className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${active.item.itemId === d.item.itemId ? 'border-l-primary bg-primary/5' : 'border-l-transparent'}`}>
              <PowerItemIcon item={d.item} records={records} power={power(d.item)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-ui font-semibold"><span className="truncate">{nameOf(d)}</span>{d.item.lockedReason === 'favorite' && <Star className="size-3 shrink-0 text-primary" aria-label="Favourite" />}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground"><span style={{color:vaultRarityColors[d.item.rarity]}}>{rarityLabels[d.item.rarity]}</span> · level {d.item.level}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{d.effectiveWeaponPerks} weapon · {d.survivalPerks} survival perk{d.survivalPerks === 1 ? '' : 's'}</span>
              </span>
              <Chip tone={d.band === 4 ? 'success' : 'neutral'}>{d.band === 4 ? 'Strong' : d.label}</Chip>
            </button>)}
          </PanelBody></Panel>
          <div className="min-w-0 space-y-4" aria-live="polite">
            <Panel><PanelBody className="space-y-3">
              <div className="flex items-center gap-4"><ItemIcon templateId={active.item.templateId} records={records} size="xl" /><div className="min-w-0 flex-1"><p className="text-title font-semibold leading-tight">{nameOf(active)}</p><p className="mt-1 text-xs text-muted-foreground"><span style={{color:vaultRarityColors[active.item.rarity]}}>{rarityLabels[active.item.rarity]}</span>{active.className ? ` · ${active.className}` : ''} · level {active.item.level}</p></div>{power(active.item) !== null && <div className="text-right"><p className="micro-label">Power</p><p className="figure mt-1 text-display-sm font-bold leading-none">{power(active.item)}</p></div>}<Chip tone={active.band === 4 ? 'success' : 'neutral'}>{active.label}</Chip></div>
              <ul className="divide-y divide-border/50 text-sm">{active.perks.map((p,i) => <li key={i} className="flex justify-between gap-3 py-2"><span>{p.description}</span><span className="shrink-0 text-xs text-muted-foreground">{p.kind}</span></li>)}</ul>
              {!active.perks.length && <EmptyState className="border-0 bg-transparent py-4" title="No perk rolls" description="No perk rolls were returned for this defender." />}
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{active.reasons.map(s => <li key={s}>{s}</li>)}</ul>
            </PanelBody></Panel>
            <Panel>
              <PanelHeader icon={Swords} title="Weapons that suit this defender"
                description={`${filteredMatches.length} owned roll${filteredMatches.length === 1 ? '' : 's'} that suit it. Fit assumes the fully unlocked roll.`} />
              <FilterBar>
                <Picker label="Role" value={role} onChange={v => { setRole(v); setWeaponPage(0) }} options={['All','Crowd damage','Crowd control','Body-hit damage'].map(v => ({value:v,label:v === 'All' ? 'All roles' : v}))} />
                <Picker label="Weapon order" value={weaponOrder} onChange={v => { setWeaponOrder(v); setWeaponPage(0) }} options={[{value:'fit',label:'Best perk fit'},{value:'level',label:'Highest current level'}]} />
              </FilterBar>
              {filteredMatches.length === 0
                ? <EmptyState className="border-0 bg-transparent py-8" icon={Swords} title="No checked weapon matches" description="Try another role. Unsupported or unknown weapons are not guessed; this does not mean the defender is useless." />
                : <ul className="divide-y divide-border/50">{shownWeapons.items.map(w => <WeaponRow key={w.item.itemId} match={w} power={power(w.item)} records={records} />)}</ul>}
              <Pager onPageChange={setWeaponPage} page={shownWeapons.page} pageSize={WEAPON_PAGE_SIZE} total={filteredMatches.length} />
            </Panel>
          </div>
        </div>}
        <details className="text-xs text-muted-foreground"><summary className="text-foreground/80">How usefulness is judged</summary><div className="mt-2 space-y-2">
          <p>Epic and Legendary defenders with three compatible weapon perks rank first. Damage, critical stats, fire rate, reload and magazine size count as weapon perks. Survival perks remain useful when staying alive is the priority.</p>
          <p>Roll quality is separate from level. Allocated perks are shown; low-level defenders may need upgrading to unlock their full roll. Melee bonuses for different weapon types are not added together.</p>
          <p>Weapon suggestions favour AOE and matching perk interactions. They use your actual schematic rolls and are not measured DPS rankings. No headshot, ammo-saving or durability benefit is credited. A wasted perk does not disqualify a weapon.</p>
          <p>Defender mechanics used here: sixth-perk cooldowns are ignored; Dragon’s Roar supplies 3-second innate affliction. These are player-reported rules. Trigger conditions and target immunity still matter. Legacy effects outside slot six may need separate verification.</p>
          <p>Game definitions: {catalog.build}. New or unrecognised items need review. Owned schematics do not guarantee a crafted weapon is in your backpack.</p>
        </div></details>
      </>}
  </div>
}

function WeaponRow({ match: w, power, records }: { match: WeaponMatch; power: number | null; records: ItemRecordMap }) {
  return <li>
    <div className="flex items-center gap-3 px-5 pt-4"><PowerItemIcon item={w.item} records={records} power={power} /><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{w.name}</h3><p className="mt-0.5 text-xs text-muted-foreground"><span style={{color:vaultRarityColors[w.item.rarity]}}>{rarityLabels[w.item.rarity]}</span> · level {w.item.level}</p></div><div className="flex max-w-40 flex-wrap justify-end gap-1">{w.roles.map(role => <Chip key={role}>{role}</Chip>)}</div></div>
    <div className="space-y-3 px-5 pb-4 pt-3 text-sm">
    {w.item.level < 50 && <p className="text-xs text-muted-foreground">Upgrade candidate: this schematic is level {w.item.level}. Some listed perks may still need unlocking.</p>}
    <ul className="list-disc space-y-1 pl-4">{w.reasons.map(s => <li key={s}>{s}</li>)}</ul>
    {w.sixth && <p><span className="font-medium">Sixth slot: </span>{w.sixth}</p>}
    {w.limits.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{w.limits.map(s => <li key={s}>{s}</li>)}</ul>}
    <details><summary className="text-xs text-muted-foreground">This weapon’s perks</summary><ol className="mt-2 list-decimal space-y-1 pl-5">{w.perks.map((p,i) => <li key={i} className={w.inactivePerks.includes(p) ? 'text-muted-foreground' : ''}>{p}{w.inactivePerks.includes(p) ? ' — inactive for defenders' : ''}</li>)}</ol></details>
    </div>
  </li>
}

function PowerItemIcon({ item, records, power, size = 'large' }: { item: InventoryItem; records: ItemRecordMap; power: number | null; size?: 'large' | 'xl' }) {
  return <span className="flex shrink-0 flex-col items-start gap-1">{power !== null && <span aria-label={`Power level ${power}`} className="figure text-2xs font-bold leading-none text-foreground"><span className="mr-1 font-medium text-muted-foreground">PL</span>{power}</span>}<ItemIcon templateId={item.templateId} records={records} size={size} /></span>
}
