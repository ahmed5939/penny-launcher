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
import { Button } from '../../../components/ui/button'
import { ItemIcon } from '../../../components/items/item-icon'
import { StatRow, StatTile, Chip, vaultRarityColors, PageHeader, Panel, PanelHeader, PanelBody, EmptyState, Callout, FilterBar, Picker, RefreshButton, SearchField, ToolBadges } from '../../../components/page'

const catalog = catalogData as DefenderCatalog

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
  const [limit, setLimit] = useState(6)
  const defenders = useMemo(() => items.filter(i => i.kind === 'defender').map(i => assessDefender(i, catalog)).sort(compareDefenders), [items])
  const visible = useMemo(() => defenders.filter(d => (classFilter === 'All' || d.className === classFilter)
    && (rarityFilter === 'All' || d.item.rarity === rarityFilter)
    && `${d.item.name} ${d.item.itemId} ${d.perks.map(p => p.description).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    .sort(sort === 'level' ? (a,b) => b.item.level-a.item.level || compareDefenders(a,b) : compareDefenders), [defenders, classFilter, rarityFilter, search, sort])
  const active = visible.find(d => d.item.itemId === selection) ?? visible[0]
  const matches = useMemo(() => active ? matchWeapons(active, items, catalog) : [], [active, items])
  const filteredMatches = matches.filter(w => role === 'All' || w.roles.includes(role)).sort((a,b) => weaponOrder === 'level' ? b.item.level - a.item.level || b.relevance - a.relevance : b.relevance - a.relevance || b.item.level - a.item.level)
  const knownSchematics = items.filter(i => i.kind === 'schematic' && catalog.schematics[i.templateId.toLowerCase()]).length
  const power = (item: InventoryItem) => computeItemPower({ tables: ratings, templateId: item.templateId, level: item.level })
  return <div id="penny-defenders" className="space-y-5">
    {!embedded && <PageHeader section="Save the World" title="Defenders" icon={ShieldHalf}
      description="Find strong weapon rolls, then choose weapons that make the most of them."
      status={<ToolBadges beta />}
      actions={<RefreshButton disabled={!accountSelected} loading={loading} onClick={onRefresh} />} />}
    {!accountSelected ? <EmptyState title="Choose an account" description="Select an account in Penny’s title bar to compare its defenders and weapon schematics." />
      : loading ? <div role="status"><EmptyState title="Loading your defenders…" description="Reading the selected account’s inventory." /></div>
      : error ? <div role="alert"><Callout tone="danger" title="Could not load defenders">{error}</Callout></div>
      : defenders.length === 0 ? <EmptyState title="No defenders found" description="This account’s campaign inventory has no defenders." />
      : <>
        <StatRow><StatTile icon={ShieldHalf} label="Defenders" value={defenders.length} /><StatTile icon={Star} label="Strong weapon rolls" value={defenders.filter(d => d.band === 4).length} tone="primary" /><StatTile icon={Swords} label="Weapon schematics" value={knownSchematics} /></StatRow>
        <details className="text-sm text-muted-foreground"><summary className="cursor-pointer text-foreground">How usefulness is judged</summary><div className="mt-2 space-y-2">
          <p>Epic and Legendary defenders with three compatible weapon perks rank first. Damage, critical stats, fire rate, reload and magazine size count as weapon perks. Survival perks remain useful when staying alive is the priority.</p>
          <p>Roll quality is separate from level. Allocated perks are shown; low-level defenders may need upgrading to unlock their full roll. Melee bonuses for different weapon types are not added together.</p>
          <p>Weapon suggestions favour AOE and matching perk interactions. They use your actual schematic rolls and are not measured DPS rankings. No headshot, ammo-saving or durability benefit is credited. A wasted perk does not disqualify a weapon.</p>
          <p>Defender mechanics used here: sixth-perk cooldowns are ignored; Dragon’s Roar supplies 3-second innate affliction. These are player-reported rules. Trigger conditions and target immunity still matter. Legacy effects outside slot six may need separate verification.</p>
          <p>Game definitions: {catalog.build}. New or unrecognised items need review. Owned schematics do not guarantee a crafted weapon is in your backpack.</p>
        </div></details>
        <Panel><FilterBar className="border-b-0">
          <SearchField label="Find a defender" onChange={setSearch} placeholder="Name, perk or item ID" value={search} />
          <Picker label="Class" value={classFilter} onChange={setClassFilter} options={['All','Assault','Pistol','Sniper','Shotgun','Melee'].map(v => ({value:v,label:v === 'All' ? 'All classes' : v}))} />
          <Picker label="Rarity" value={rarityFilter} onChange={setRarityFilter} options={[{value:'All',label:'All rarities'}, ...Object.entries(rarityLabels).filter(([value]) => value !== 'mythic').map(([value,label]) => ({value,label}))]} />
          <Picker label="Sort" value={sort} onChange={setSort} options={[{value:'usefulness',label:'Weapon-roll usefulness'},{value:'level',label:'Current level'}]} />
        </FilterBar></Panel>
        {!active ? <EmptyState title="No matching defenders" description="Try a different class, rarity or search." /> : <div className="grid items-start gap-5 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.6fr)]">
          <Panel><PanelHeader title={`${visible.length} defender${visible.length === 1 ? '' : 's'}`} description="Select a defender to compare weapon matches." /><PanelBody className="max-h-[700px] divide-y divide-border/50 overflow-y-auto p-0">
            {visible.map(d => <button key={d.item.itemId} type="button" aria-pressed={active.item.itemId === d.item.itemId} onClick={() => { setSelection(d.item.itemId); setLimit(6) }} className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${active.item.itemId === d.item.itemId ? 'border-l-primary bg-primary/5' : 'border-l-transparent'}`}>
              <PowerItemIcon item={d.item} records={records} power={power(d.item)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">{d.className ?? 'Unknown'} defender{d.item.lockedReason === 'favorite' && <Star className="size-3 text-primary" aria-label="Favourite" />}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground"><span style={{color:vaultRarityColors[d.item.rarity]}}>{rarityLabels[d.item.rarity]}</span> · level {d.item.level}{power(d.item) !== null ? ` · PL ${power(d.item)}` : ''}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{d.effectiveWeaponPerks} weapon · {d.survivalPerks} survival · {d.item.itemId.slice(0,8)}</span>
              </span>
              <Chip tone={d.band === 4 ? 'success' : 'neutral'}>{d.band === 4 ? 'Strong' : d.label}</Chip>
            </button>)}
          </PanelBody></Panel>
          <div className="min-w-0 space-y-4" aria-live="polite">
            <Panel><PanelHeader title={`${active.className ?? 'Unknown'} · ${active.item.itemId.slice(0,8)}`} description={`${rarityLabels[active.item.rarity]} · level ${active.item.level} · ${active.label}`} /><PanelBody className="space-y-3">
              <div className="flex items-center gap-3"><PowerItemIcon item={active.item} records={records} power={power(active.item)} size="xl" /><div><p className="text-sm font-medium">{active.className} defender</p><p className="mt-1 text-xs text-muted-foreground">{rarityLabels[active.item.rarity]} · level {active.item.level}</p></div><Chip tone={active.band === 4 ? 'success' : 'neutral'}>{active.label}</Chip></div>
              <ul className="divide-y divide-border/50 text-sm">{active.perks.map((p,i) => <li key={i} className="flex justify-between gap-3 py-2"><span>{p.description}</span><span className="shrink-0 text-xs text-muted-foreground">{p.kind}</span></li>)}</ul>
              {!active.perks.length && <p className="text-sm text-muted-foreground">No perk rolls were returned for this defender.</p>}
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{active.reasons.map(s => <li key={s}>{s}</li>)}</ul>
            </PanelBody></Panel>
            <h2 className="text-sm font-semibold">Weapons that suit this defender</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Picker label="Role" value={role} onChange={v => { setRole(v); setLimit(6) }} options={['All','Crowd damage','Crowd control','Body-hit damage'].map(v => ({value:v,label:v === 'All' ? 'All roles' : v}))} />
              <Picker label="Weapon order" value={weaponOrder} onChange={v => { setWeaponOrder(v); setLimit(6) }} options={[{value:'fit',label:'Best perk fit'},{value:'level',label:'Highest current level'}]} />
            </div>
            <p className="text-xs text-muted-foreground">{filteredMatches.length} matching owned rolls. Perk fit describes the fully unlocked roll; check level before investing. These are not measured DPS rankings.</p>
            {filteredMatches.length === 0 ? <EmptyState title="No checked weapon matches" description="Try another role. Unsupported or unknown weapons are not guessed; this does not mean the defender is useless." /> : filteredMatches.slice(0,limit).map(w => <WeaponCard key={w.item.itemId} match={w} power={power(w.item)} records={records} />)}
            {filteredMatches.length > limit && <Button variant="outline" onClick={() => setLimit(n => n+12)}>Show more weapon rolls</Button>}
          </div>
        </div>}
      </>}
  </div>
}

function WeaponCard({ match: w, power, records }: { match: WeaponMatch; power: number | null; records: ItemRecordMap }) {
  return <Panel><div className="flex items-center gap-3 border-b border-border/50 px-4 py-3"><PowerItemIcon item={w.item} records={records} power={power} /><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{w.name}</h3><p className="mt-0.5 text-xs text-muted-foreground"><span style={{color:vaultRarityColors[w.item.rarity]}}>{rarityLabels[w.item.rarity]}</span> · level {w.item.level}{power !== null ? ` · PL ${power}` : ''} · {w.item.itemId.slice(0,8)}</p></div><div className="flex max-w-40 flex-wrap justify-end gap-1">{w.roles.map(role => <Chip key={role}>{role}</Chip>)}</div></div><PanelBody className="space-y-3 text-sm">
    {w.item.level < 50 && <p className="text-xs text-muted-foreground">Upgrade candidate: this schematic is level {w.item.level}. Some listed perks may still need unlocking.</p>}
    <ul className="list-disc space-y-1 pl-4">{w.reasons.map(s => <li key={s}>{s}</li>)}</ul>
    {w.sixth && <p><span className="font-medium">Sixth slot: </span>{w.sixth}</p>}
    {w.limits.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{w.limits.map(s => <li key={s}>{s}</li>)}</ul>}
    <details><summary className="cursor-pointer">Inspect this weapon’s perks</summary><ol className="mt-2 list-decimal space-y-1 pl-5">{w.perks.map((p,i) => <li key={i} className={w.inactivePerks.includes(p) ? 'text-muted-foreground' : ''}>{p}{w.inactivePerks.includes(p) ? ' — inactive for defenders' : ''}</li>)}</ol><p className="mt-2 break-all text-xs text-muted-foreground">Schematic ID: {w.item.itemId}</p></details>
  </PanelBody></Panel>
}

function PowerItemIcon({ item, records, power, size = 'large' }: { item: InventoryItem; records: ItemRecordMap; power: number | null; size?: 'large' | 'xl' }) {
  return <span className="flex shrink-0 flex-col items-start gap-1">{power !== null && <span aria-label={`Power level ${power}`} className="figure text-[0.625rem] font-bold leading-none text-foreground"><span className="mr-1 font-medium text-muted-foreground">PL</span>{power}</span>}<ItemIcon templateId={item.templateId} records={records} size={size} /></span>
}
