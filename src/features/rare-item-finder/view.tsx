import type { ItemRecord, ItemRecordMap } from '../../kernel/core/item-database'
import type { FinderItem, FinderSourceId, RareItemScan, ScannedProfile } from './types'
import type { ChipTone } from '../../components/page'

import { useMemo, useState } from 'react'
import { AlertTriangle, Radar, ShieldQuestion, Sparkles, Star } from 'lucide-react'

import { getItemRecord, useItemDatabaseStore } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { SOURCES } from './sources'

import { Dialog, DialogContent } from '../../components/ui/dialog'
import { ItemCard, ItemCardGrid } from '../../components/items/item-card'
import { DetailHeader, DetailSection, PerkSlotRow } from '../../components/items/detail-parts'
import { AccountResourceGate, Callout, Chip, EmptyState, FilterBar, PageHeader, PageTabs, Pager, Panel, PanelBody, PanelHeader, PanelSectionHeader, Picker, RefreshButton, SearchField, StatRow, StatTile, ToolBadges, accentByRarity, paginate, rarityTypeFromName, useAccountResource } from '../../components/page'

const PAGE_SIZE = 48

type ViewId = 'aoe' | 'historical' | 'modded' | 'location'
type StatusFilter = 'highlighted' | 'hybrid' | 'modded' | 'legacy' | 'review' | 'all'
type SortKey = 'power' | 'rarity' | 'name'

/**
 * The three account-wide views are what the tool is for. "By location" reads
 * one inventory at a time; it is one tab with a picker rather than four,
 * because browsing an inventory is what the Vault, Collection Book and
 * Backpack & Storage pages are for.
 */
const views: Array<{ id: ViewId; label: string; title: string; description: string }> = [
  { id: 'aoe', label: 'AOE weapons', title: 'AOE weapons', description: 'Legacy Knockback AOE weapons and schematics across the whole account, grouped by where each copy lives.' },
  { id: 'historical', label: 'Historical', title: 'Historical weapons & traps', description: 'Perks that were legitimately obtainable once and are outside today’s rules — Discharger reload speed, Vindertech five-headshots, and the others the user evidenced. Unverified slot positions are noted.' },
  { id: 'modded', label: 'Modded', title: 'Modded weapons & traps', description: 'Confirmed modded rolls, plus candidates whose perks fall outside the extracted rules and have no other explanation. The two are labelled separately.' },
  { id: 'location', label: 'By location', title: 'By location', description: 'One inventory at a time, with every weapon and trap it holds. Filter by status to see only what stands out.' },
]

const locationLabel: Record<FinderSourceId, string> = {
  campaign: 'Inventory',
  collection_book_schematics0: 'Collection Book',
  theater0: 'Backpack',
  outpost0: 'Storage',
}

const rarityRank: Record<string, number> = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 }

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'highlighted', label: 'Legacy, historical & modded' },
  { value: 'hybrid', label: 'Legacy hybrids' },
  { value: 'modded', label: 'Modded candidates' },
  { value: 'legacy', label: 'Legacy only' },
  { value: 'review', label: 'Needs review' },
  { value: 'all', label: 'Everything checked' },
]

/** The one word that matters about a copy, in the tone the vault uses for it. */
function headline(item: FinderItem): { label: string; tone: ChipTone } {
  if (item.modded) return { label: item.defenderPerk ? 'Modded · defender perk' : item.moddedConfirmed ? 'Modded' : 'Modded candidate', tone: 'danger' }
  if (item.aoe) return { label: 'AOE weapon', tone: 'accent' }
  if (item.hybrid) return { label: 'Legacy hybrid', tone: 'accent' }
  if (item.historical) return { label: 'Historical perk', tone: 'success' }
  if (item.status === 'legacy') return { label: 'Legacy', tone: 'accent' }
  if (item.status === 'review') return { label: 'Needs review', tone: 'warning' }
  return { label: 'Current perks', tone: 'neutral' }
}

/**
 * Scan results carry their own artwork (crafted `Weapon:` ids are often
 * missing from the live database — the Dragon's Roar case). Fold those in
 * under the live records so the cards draw the right plate and art.
 */
function useTileRecords(records: ItemRecordMap, scan: RareItemScan | null) {
  return useMemo(() => {
    const merged: ItemRecordMap = { ...records }
    for (const profile of scan?.profiles ?? []) {
      for (const item of profile.items) {
        const key = item.templateId.toLowerCase()
        if (merged[key] || !item.image) continue
        merged[key] = {
          name: item.name,
          description: item.description || null,
          rarity: item.rarity === 'unknown' ? null : item.rarity[0].toUpperCase() + item.rarity.slice(1),
          tier: item.tier,
          image: item.image,
          largeImage: null,
        } as unknown as ItemRecord
      }
    }
    return merged
  }, [records, scan])
}

export function RareItemFinderPage() {
  useRequestItemDatabase()
  /*
   * Keyed on the account id only. Token refreshes and display-name updates
   * re-render without restarting the scan; a real switch discards whatever
   * the previous account's scan returns late.
   */
  const resource = useAccountResource((accountId) => window.electronAPI.requestRareItemScan(accountId), {
    fallbackError: 'The scan could not be completed. Rescan to retry.',
    owner: (result) => result.accountId,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        actions={<RefreshButton disabled={!resource.accountId} label="Rescan" loading={resource.loading} onClick={resource.refresh} />}
        description="Legacy, hybrid, historical, Knockback AOE and modded weapons and traps, across inventory schematics, the Collection Book, the backpack and storage. Nothing here changes an item."
        icon={Radar}
        section="Save the World"
        status={<ToolBadges beta readOnly />}
        title="Rare Item Finder"
      />
      <AccountResourceGate
        icon={Radar}
        loading={{ title: 'Scanning four inventories…', description: 'Reading inventory schematics, the Collection Book, the backpack and storage, then checking every perk against the 42.10 rules.' }}
        resource={resource}
        what="the scan"
      >
        {(scan) => <Results key={scan.accountId} scan={scan} />}
      </AccountResourceGate>
    </div>
  )
}

function Results({ scan: current }: { scan: RareItemScan }) {
  const records = useTileRecords(useItemDatabaseStore((s) => s.records), current)
  const [view, setView] = useState<ViewId>('aoe')
  const [location, setLocation] = useState<FinderSourceId>('campaign')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'weapon' | 'trap'>('all')
  const [status, setStatus] = useState<StatusFilter>('highlighted')
  const [sort, setSort] = useState<SortKey>('power')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<FinderItem | null>(null)

  const aggregate = view === 'aoe' || view === 'historical' || view === 'modded'
  const { succeeded, failed } = useMemo(() => ({
    succeeded: current.profiles.filter((p) => p.status === 'success'),
    failed: current.profiles.filter((p) => p.status === 'error'),
  }), [current.profiles])

  const profile: Pick<ScannedProfile, 'status' | 'items' | 'scannedCount' | 'malformedItems' | 'error'> | null = useMemo(() => aggregate
    ? {
        status: succeeded.length ? 'success' : 'error',
        items: succeeded.flatMap((p) => p.items).filter((i) => (view === 'aoe' ? i.aoe : view === 'historical' ? i.historical && !i.modded : i.modded)),
        scannedCount: succeeded.reduce((n, p) => n + (p.scannedCount ?? 0), 0),
        malformedItems: succeeded.reduce((n, p) => n + (p.malformedItems ?? 0), 0),
        error: { message: 'No inventories could be checked.', code: '' },
      }
    : (current.profiles.find((p) => p.sourceId === location) ?? null), [aggregate, current.profiles, succeeded, view])

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchesStatus = (item: FinderItem) =>
      status === 'all' ? true
        : status === 'highlighted' ? item.status === 'legacy' || item.modded || item.historical
        : status === 'hybrid' ? item.hybrid
        : status === 'modded' ? item.modded
        : item.status === status
    const items = (profile?.status === 'success' ? profile.items : []).filter(
      (item) =>
        (aggregate || kind === 'all' || item.kind === kind) &&
        (aggregate || matchesStatus(item)) &&
        (!q || [item.name, item.templateId, ...item.perks.map((p) => `${p.name} ${p.id}`)].join(' ').toLowerCase().includes(q))
    )
    const byKey = sort === 'power'
      ? (a: FinderItem, b: FinderItem) => (b.power ?? -1) - (a.power ?? -1)
      : sort === 'rarity'
        ? (a: FinderItem, b: FinderItem) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0)
        : () => 0
    return items.sort((a, b) => byKey(a, b) || a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId))
  }, [profile, aggregate, kind, status, query, sort])

  const shown = paginate(displayed, page, PAGE_SIZE)
  const visible = shown.items
  const activeView = views.find((v) => v.id === view)!
  const complete = current.counts.complete

  const countFor = (id: ViewId) => {
    if (id === 'aoe' || id === 'historical' || id === 'modded') return succeeded.length ? current.counts[id] : null
    return null
  }
  const tabs = views.map((v) => {
    const n = countFor(v.id)
    return { value: v.id, label: n === null ? v.label : `${v.label} · ${n}` }
  })

  return (
    <>
      <StatRow>
        <StatTile icon={Sparkles} label="Legacy items" tone={current.counts.legacy ? 'primary' : 'default'} value={current.counts.legacy.toLocaleString()} />
        <StatTile icon={AlertTriangle} label="Needs review" tone={current.counts.review ? 'warning' : 'default'} value={current.counts.review.toLocaleString()} />
        <StatTile icon={ShieldQuestion} label="Modded candidates" tone={current.counts.modded ? 'danger' : 'default'} value={current.counts.modded.toLocaleString()} />
        <StatTile
          hint={complete ? `All four inventories · ${new Date(current.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `${failed.length} of 4 inventories could not be read`}
          label="Items checked"
          tone={complete ? 'default' : 'warning'}
          value={current.counts.scanned.toLocaleString()}
        />
      </StatRow>

      {failed.length > 0 && (
        <Callout title="Scan incomplete" tone="warning">
          {failed.map((p) => `${locationLabel[p.sourceId]}: ${p.error?.message ?? 'could not be read'}`).join(' · ')} Counts above only cover the inventories that were read.
        </Callout>
      )}

      <PageTabs label="Views" onValueChange={(next) => { setView(next); setPage(0) }} tabs={tabs} value={view}>
        <Panel>
          <PanelHeader
            actions={<span className="micro-label">{profile?.status === 'success' ? `${displayed.length.toLocaleString()} shown · ${(profile.scannedCount ?? 0).toLocaleString()} checked` : null}</span>}
            description={activeView.description}
            title={activeView.title}
          />

          <FilterBar>
            <SearchField label="Search items or perks" onChange={(v) => { setQuery(v); setPage(0) }} placeholder="Item name, perk or template id" value={query} />
            {!aggregate && (
              <>
                <Picker label="Location" onChange={(v) => { setLocation(v); setPage(0) }} options={SOURCES.map((source) => ({ value: source.id, label: locationLabel[source.id] }))} value={location} />
                <Picker label="Item type" onChange={(v) => { setKind(v); setPage(0) }} options={[{ value: 'all', label: 'Weapons & traps' }, { value: 'weapon', label: 'Weapons' }, { value: 'trap', label: 'Traps' }]} value={kind} />
                <Picker label="Status" onChange={(v) => { setStatus(v); setPage(0) }} options={statusFilters} value={status} />
              </>
            )}
            <Picker label="Sort" onChange={setSort} options={[{ value: 'power', label: 'Power, high to low' }, { value: 'rarity', label: 'Rarity, high to low' }, { value: 'name', label: 'Name, A to Z' }]} value={sort} />
          </FilterBar>

          {aggregate ? (
            SOURCES.map((location) => {
              const original = current.profiles.find((p) => p.sourceId === location.id)
              const inLocation = displayed.filter((i) => i.sourceId === location.id)
              const here = visible.filter((i) => i.sourceId === location.id)
              return (
                <section aria-label={locationLabel[location.id]} key={location.id}>
                  <PanelSectionHeader
                    actions={
                      <>
                        {original?.malformedItems ? <Chip tone="warning">{original.malformedItems} unreadable</Chip> : null}
                        <span className="micro-label">
                          {original?.status === 'success' ? `${inLocation.length} ${inLocation.length === 1 ? 'copy' : 'copies'}` : original?.status === 'error' ? 'Not read' : 'Not scanned'}
                        </span>
                      </>
                    }
                    title={locationLabel[location.id]}
                  />
                  <PanelBody>
                    {here.length > 0 ? (
                      <TileGrid items={here} onInspect={setDetail} records={records} />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {original?.status === 'error'
                          ? (original.error?.message ?? 'Rescan to check this inventory.')
                          : original?.status !== 'success'
                            ? 'Waiting for this inventory.'
                            : inLocation.length
                              ? 'Matches are on another page.'
                              : query
                                ? 'No matches for this search.'
                                : 'Nothing here.'}
                      </p>
                    )}
                  </PanelBody>
                </section>
              )
            })
          ) : displayed.length > 0 ? (
            <PanelBody>
              <TileGrid items={visible} onInspect={setDetail} records={records} />
            </PanelBody>
          ) : (
            <PanelBody>
              <EmptyState
                className="border-0 bg-transparent py-8"
                description={
                  profile?.status === 'error'
                    ? (profile.error?.message ?? 'Rescan to check this inventory.')
                    : query || kind !== 'all'
                      ? 'Nothing matches the current search or type filter.'
                      : status === 'all'
                        ? 'This inventory holds no weapons or traps.'
                        : `Nothing in this inventory is ${statusFilters.find((f) => f.value === status)?.label.toLowerCase()}. ${status === 'legacy' ? 'Try “Needs review” for unfamiliar perks and Epic flags.' : 'It was checked successfully.'}`
                }
                icon={Radar}
                title={profile?.status === 'error' ? 'This inventory could not be read' : 'No matches'}
              />
            </PanelBody>
          )}

          <Pager onPageChange={setPage} page={shown.page} pageSize={PAGE_SIZE} total={displayed.length} />
        </Panel>
      </PageTabs>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {current.rulesVersion}. Slot checks use the extracted 42.10 rules read with 42.00 mappings; historical slot tables and server hotfixes are not included, so a mismatch is a reason to look, not proof of modification. Copies are listed per location and never merged.
      </p>

      <Dialog onOpenChange={(open) => { if (!open) setDetail(null) }} open={detail !== null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {detail && <Detail item={detail} records={records} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function TileGrid({ items, onInspect, records }: { items: Array<FinderItem>; onInspect: (item: FinderItem) => void; records: ItemRecordMap }) {
  return (
    <ItemCardGrid>
      {items.map((item) => {
        const { label, tone } = headline(item)
        return (
          <ItemCard
            badges={<Chip tone={tone}>{label}</Chip>}
            favorite={item.favorite}
            footer={<span className="truncate">{locationLabel[item.sourceId]} · {item.perks.length} perk{item.perks.length === 1 ? '' : 's'}</span>}
            key={item.key}
            level={item.level}
            name={item.name}
            onClick={() => onInspect(item)}
            power={item.power}
            quantity={item.quantity}
            records={records}
            subtitle={item.kind === 'trap' ? 'Trap' : 'Weapon'}
            templateId={item.templateId}
            tier={item.tier}
            title={`${item.name} · ${label} · ${locationLabel[item.sourceId]}`}
          />
        )
      })}
    </ItemCardGrid>
  )
}

/** The perk's own rarity colour, as the item dialog on every other page draws it. */
function perkAccent(records: ItemRecordMap, id: string) {
  const type = rarityTypeFromName(getItemRecord(records, id)?.rarity)
  return type ? (accentByRarity[type] ?? null) : null
}

function Detail({ item, records }: { item: FinderItem; records: ItemRecordMap }) {
  const { label, tone } = headline(item)
  const finding = (codes: Array<string>, perk: FinderItem['perks'][number]) =>
    item.slotAudit.findings.find((f) => codes.includes(f.code) && f.slot === perk.slot && f.perkId === perk.id.toLowerCase())

  return (
    <>
      <DetailHeader
        badges={
          <>
            <Chip tone={tone}>{label}</Chip>
            {item.modded && item.aoe && <Chip tone="accent">AOE weapon</Chip>}
            {item.hybrid && (item.modded || item.aoe) && <Chip tone="accent">Legacy hybrid</Chip>}
          </>
        }
        description={item.description}
        facts={
          <>
            <span>Level <span className="figure">{item.level}</span></span>
            {item.quantity > 1 && <span>×<span className="figure">{item.quantity}</span></span>}
            <span>{locationLabel[item.sourceId]} · {SOURCES.find((s) => s.id === item.sourceId)?.schematic ? 'schematic' : 'crafted copy'}</span>
            {item.favorite && <span className="inline-flex items-center gap-1"><Star className="size-3" /> Favourited</span>}
          </>
        }
        meta={[item.kind === 'trap' ? 'Trap' : 'Weapon', item.tier > 0 && `Tier ${item.tier}`]}
        name={item.name}
        power={item.power}
        rarity={item.rarity === 'unknown' ? null : item.rarity[0].toUpperCase() + item.rarity.slice(1)}
        records={records}
        templateId={item.templateId}
      />

      <DetailSection icon={Sparkles} title="Perks on this copy">
        {item.perks.length ? (
          <ul className="space-y-1.5">
            {item.perks.map((perk, index) => {
              const historical = finding(['historical_perk', 'historical_slot_unverified'], perk)
              const mismatch = finding(['disallowed_slot', 'defender_on_schematic'], perk)
              const tags: Array<{ text: string; tone: ChipTone }> = []
              if (mismatch) tags.push({ text: perk.defender ? 'Defender perk on a schematic' : 'Outside current rules', tone: 'danger' })
              if (historical) tags.push({ text: historical.code === 'historical_slot_unverified' ? 'Historical · slot unverified' : 'Historical · no longer selectable', tone: 'success' })
              if (perk.aoe) tags.push({ text: 'AOE', tone: 'accent' })
              else if (perk.legacy) tags.push({ text: 'Legacy', tone: 'accent' })
              if (item.hybrid && perk.modern) tags.push({ text: 'Modern', tone: 'neutral' })
              if (!perk.known) tags.push({ text: 'Unknown perk', tone: 'warning' })
              return (
                <PerkSlotRow
                  accent={perkAccent(records, perk.id)}
                  id={perk.id}
                  index={perk.slot}
                  key={index}
                  title={perk.name}
                >
                  {tags.map((tag) => <Chip key={tag.text} tone={tag.tone}>{tag.text}</Chip>)}
                </PerkSlotRow>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">This copy has no perk entries.</p>
        )}
      </DetailSection>

      <DetailSection icon={ShieldQuestion} title={`Slot rule check · ${item.slotAudit.build}`}>
        <ul className="space-y-1.5">
          {item.slotAudit.findings.length ? (
            item.slotAudit.findings.map((f, i) => (
              <li className="panel px-3 py-2 text-xs leading-relaxed" key={i}>{f.message}</li>
            ))
          ) : (
            <li className="panel px-3 py-2 text-xs leading-relaxed text-muted-foreground">Every perk fits the extracted slot rules. That is consistent with a normal roll; it does not prove one.</li>
          )}
        </ul>
        {item.reviewReasons.length > 0 && <p className="text-xs text-muted-foreground">{item.reviewReasons.join(' · ')}</p>}
      </DetailSection>

      <p className="select-all break-all rounded-lg bg-muted/40 px-3 py-2 font-mono text-[0.625rem] text-muted-foreground ring-1 ring-inset ring-border/60">
        {item.templateId} · {item.itemId}
      </p>
    </>
  )
}
