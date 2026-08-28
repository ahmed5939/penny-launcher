import {
  Building2,
  Gauge,
  LoaderCircle,
  Map as MapIcon,
  RadioTower,
  RefreshCw,
  Save,
  ScanSearch,
  Shield,
  Users,
  Waves,
} from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  OutpostBaseData,
  OutpostDefenseRecord,
  OutpostLayout,
  OutpostTrap,
  OutpostTrapCategory,
  OutpostZoneInfo,
} from '../../../kernel/core/outpost-types'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { RatingTables } from '../../../config/constants/fortnite/power'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import {
  Callout,
  Chip,
  EmptyState,
  PageHeader,
  Panel,
  ProgressBar,
  StatRow,
  StatTile,
} from '../../../components/page'

import { computeItemPower } from '../../../config/constants/fortnite/power'
import { peglegImageURL } from '../../../config/constants/pegleg'
import { RarityColor, RarityType } from '../../../config/constants/resources'

import { useItemDatabaseStore, getItemRecord } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { getShortDateFormat, relativeTime } from '../../../lib/dates'
import { assets } from '../../../lib/repository'
import { cn } from '../../../lib/utils'

import { useOutpostData } from './-hooks'

const MAX_SHIELD_LEVEL = 10
const MAX_ENDURANCE_WAVE = 30

const TRAP_CATEGORIES: Array<{ key: OutpostTrapCategory; label: string }> = [
  { key: 'floor', label: 'Floor' },
  { key: 'wall', label: 'Wall' },
  { key: 'ceiling', label: 'Ceiling' },
  { key: 'other', label: 'Other' },
]

/** TID rarity codes are exactly the `RarityType` enum values. */
const RARITY_HEX: Record<string, string> = {
  [RarityType.Common]: RarityColor.Common,
  [RarityType.Uncommon]: RarityColor.Uncommon,
  [RarityType.Rare]: RarityColor.Rare,
  [RarityType.Epic]: RarityColor.Epic,
  [RarityType.Legendary]: RarityColor.Legendary,
  [RarityType.Mythic]: RarityColor.Mythic,
}

const RARITY_LABEL: Record<string, string> = {
  [RarityType.Common]: 'Common',
  [RarityType.Uncommon]: 'Uncommon',
  [RarityType.Rare]: 'Rare',
  [RarityType.Epic]: 'Epic',
  [RarityType.Legendary]: 'Legendary',
  [RarityType.Mythic]: 'Mythic',
}

/** Minimap colours by layout code — structures by material, traps by slot. */
const MATERIAL_HEX = ['#c9a06a', '#9aa4ad', '#6fd3e0'] // wood, stone, metal
const TRAP_SLOT_HEX = ['#ed7e39', '#51a1db', '#d076f6', '#bfbaba'] // floor/wall/ceiling/other

function perkName(records: ItemRecordMap, templateId: string) {
  const record = getItemRecord(records, templateId)

  if (record?.name) return record.name

  // Fall back to a readable form of the alteration id.
  return templateId
    .replace(/^Alteration:aid_/i, '')
    .replace(/_t\d\d$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Real power levels for the base's traps: each unique (item, level) pair is
 * rated through the game's own curves, then weighted by how many are placed.
 * Null until the rating tables have downloaded or when no trap had a level.
 */
function trapPowerStats(
  items: OutpostBaseData['trapItems'],
  tables: RatingTables
): { average: number; max: number; min: number } | null {
  let total = 0
  let count = 0
  let min = Infinity
  let max = -Infinity

  for (const item of items) {
    const power = computeItemPower({
      level: item.level,
      tables,
      templateId: item.templateId,
    })

    if (power === null) continue

    total += power * item.count
    count += item.count
    min = Math.min(min, power)
    max = Math.max(max, power)
  }

  if (count === 0) return null

  return { average: Math.round(total / count), max, min }
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`

  return `${bytes} B`
}

/**
 * The difficulty-skull colours already mean "how deep into the campaign" on
 * the alerts screen, so they double as zone badges here.
 */
const ZONE_BADGES: Record<string, string> = {
  pve_01: 'green-skull',
  pve_02: 'yellow-skull',
  pve_03: 'orange-skull',
  pve_04: 'red-skull',
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Shield}
        section={t('stw-operations.title')}
        title={
          <span className="flex items-center gap-2">
            Outpost
            <BetaBadge />
          </span>
        }
        description="Storm Shield state for the selected account — zone levels, endurance records, amplifiers, and a full scan of the base built in each zone."
      />
      <Content />
    </>
  )
}

function Content() {
  const {
    baseData,
    errorMessage,
    handleRefresh,
    handleScanAll,
    handleScanBase,
    infoLoading,
    loadingZone,
    primaryAccount,
    zones,
  } = useOutpostData()

  // Perk names and power curves come from the item database; load on mount.
  useRequestItemDatabase()
  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)

  if (!primaryAccount) {
    return (
      <EmptyState
        icon={Shield}
        title="No account selected"
        description="Pick an account in the titlebar to inspect its outpost."
      />
    )
  }

  const scannable = zones.some((zone) => zone.saveFile)
  const uniqueBuilders = new Set(
    zones.flatMap((zone) =>
      zone.editPermissions.map((permission) => permission.accountId)
    )
  ).size
  const totalLevels = zones.reduce((total, zone) => total + zone.level, 0)
  const bestZone = zones.reduce<OutpostZoneInfo | null>(
    (best, zone) =>
      zone.highestEnduranceWave > (best?.highestEnduranceWave ?? 0)
        ? zone
        : best,
    null
  )
  const totalAmplifiers = zones.reduce(
    (total, zone) => total + zone.amplifierCount,
    0
  )

  return (
    <>
      <div className="flex items-center justify-end gap-2 border-b border-border/60 pb-3">
        <Button
          disabled={!scannable || loadingZone !== null}
          onClick={handleScanAll}
          variant="outline"
        >
          {loadingZone !== null ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ScanSearch className="size-4" />
          )}
          Scan all bases
        </Button>
        <Button
          className="min-w-32"
          disabled={infoLoading}
          onClick={handleRefresh}
        >
          {infoLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {errorMessage && (
        <Callout title="Outpost unavailable" tone="warning">
          {errorMessage}
        </Callout>
      )}

      {!infoLoading && zones.length === 0 && !errorMessage && (
        <EmptyState
          icon={Shield}
          title="No outpost data"
          description="This account's metadata profile has no Storm Shield entries."
        />
      )}

      {zones.length > 0 && (
        <StatRow>
          <StatTile
            hint={`across ${zones.length} zones, of ${zones.length * MAX_SHIELD_LEVEL}`}
            icon={Shield}
            label="Shield levels"
            tone="primary"
            value={totalLevels}
          />
          <StatTile
            hint={bestZone ? bestZone.zoneName : 'no endurance runs yet'}
            icon={Waves}
            label="Best endurance wave"
            tone={
              (bestZone?.highestEnduranceWave ?? 0) >= MAX_ENDURANCE_WAVE
                ? 'success'
                : 'default'
            }
            value={bestZone?.highestEnduranceWave ?? 0}
          />
          <StatTile
            icon={RadioTower}
            label="Amplifiers placed"
            value={totalAmplifiers}
          />
          <StatTile
            hint="accounts with edit access"
            icon={Users}
            label="Builders"
            value={uniqueBuilders}
          />
        </StatRow>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {zones.map((zone) => (
          <ZoneCard
            baseData={baseData[zone.zoneId]}
            isLoadingBase={loadingZone === zone.zoneId}
            key={zone.zoneId}
            onScanBase={handleScanBase}
            ratings={ratings}
            records={records}
            zone={zone}
          />
        ))}
      </div>
    </>
  )
}

function ZoneCard({
  baseData,
  isLoadingBase,
  onScanBase,
  ratings,
  records,
  zone,
}: {
  baseData?: OutpostBaseData
  isLoadingBase: boolean
  onScanBase: (zoneId: string, saveFile: string) => void
  ratings: RatingTables
  records: ItemRecordMap
  zone: OutpostZoneInfo
}) {
  const canScan = Boolean(zone.saveFile) && !isLoadingBase
  const badge = assets(ZONE_BADGES[zone.zoneId] ?? '')
  const enduranceComplete = zone.highestEnduranceWave >= MAX_ENDURANCE_WAVE
  const powerStats = baseData?.success
    ? trapPowerStats(baseData.trapItems, ratings)
    : null

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {badge && (
            <img
              alt=""
              className="size-9 shrink-0 object-contain"
              src={badge}
            />
          )}
          <div>
            <p className="text-sm font-semibold">{zone.zoneName}</p>
            <p className="micro-label text-muted-foreground">
              Storm Shield · Level {zone.level}
            </p>
          </div>
        </div>
        <Button
          disabled={!canScan}
          onClick={() => onScanBase(zone.zoneId, zone.saveFile)}
          size="sm"
          variant="outline"
        >
          {isLoadingBase ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <ScanSearch className="size-3.5" />
          )}
          Scan base
        </Button>
      </div>

      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <MeterRow
          label="Shield level"
          total={MAX_SHIELD_LEVEL}
          value={zone.level}
        />
        <MeterRow
          label={enduranceComplete ? 'Endurance complete' : 'Endurance wave'}
          total={MAX_ENDURANCE_WAVE}
          value={zone.highestEnduranceWave}
        />
      </div>

      <DefenseTimeline defenses={zone.defenses} />

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={enduranceComplete ? 'success' : 'accent'}>
          <Waves className="size-3" />
          Wave {zone.highestEnduranceWave}
        </Chip>
        <Chip>
          <RadioTower className="size-3" />
          {zone.amplifierCount} amplifiers
        </Chip>
        <Chip>
          <Users className="size-3" />
          {zone.editPermissions.length} builders
        </Chip>
        {powerStats && (
          <Chip tone="accent">
            <Gauge className="size-3" />
            PL {powerStats.average} avg
          </Chip>
        )}
        {zone.saveCount > 0 && (
          <Chip>
            <Save className="size-3" />
            {zone.saveCount} saves
            {zone.lastSavedAt && ` · ${relativeTime(zone.lastSavedAt)}`}
          </Chip>
        )}
      </div>

      {zone.amplifierSlots.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Amplifiers:{' '}
          {zone.amplifierSlots
            .map((slot) => slot.replace(/_/g, ' '))
            .join(', ')}
        </p>
      )}

      {zone.editPermissions.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Edit access:{' '}
          {zone.editPermissions
            .map((permission) => permission.displayName)
            .join(', ')}
        </p>
      )}

      {baseData && !baseData.success && (
        <p className="text-xs text-destructive">{baseData.error}</p>
      )}

      {baseData?.warning && (
        <p className="text-xs text-warning">{baseData.warning}</p>
      )}

      {baseData?.success && !baseData.warning && (
        <BaseScan baseData={baseData} ratings={ratings} records={records} />
      )}
    </Panel>
  )
}

/**
 * Ten dots, one per Storm Shield Defense, with the claim date in the
 * tooltip — the campaign quest ledger remembers when each one was beaten.
 */
function DefenseTimeline({
  defenses,
}: {
  defenses: Array<OutpostDefenseRecord>
}) {
  if (defenses.length === 0) {
    return null
  }

  const byNumber = new Map(defenses.map((record) => [record.defense, record]))
  const dated = defenses.filter((record) => record.completedAt)
  const last = dated.reduce<OutpostDefenseRecord | null>(
    (latest, record) =>
      !latest || record.completedAt > latest.completedAt ? record : latest,
    null
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="micro-label text-muted-foreground">Defenses</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: MAX_SHIELD_LEVEL }, (_, index) => index + 1).map(
          (defense) => {
            const record = byNumber.get(defense)

            return (
              <span
                className={cn(
                  'size-2 rounded-full',
                  record ? 'bg-success' : 'bg-muted/70'
                )}
                key={defense}
                title={
                  record?.completedAt
                    ? `Defense ${defense} — ${getShortDateFormat(record.completedAt)}`
                    : record
                      ? `Defense ${defense} — completed`
                      : `Defense ${defense} — not completed`
                }
              />
            )
          }
        )}
      </div>
      {last && (
        <span
          className="text-xs text-muted-foreground"
          title={getShortDateFormat(last.completedAt)}
        >
          last {relativeTime(last.completedAt)}
        </span>
      )}
    </div>
  )
}

function MeterRow({
  label,
  total,
  value,
}: {
  label: string
  total: number
  value: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="micro-label text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">
          {value}/{total}
        </span>
      </div>
      <ProgressBar total={total} value={value} />
    </div>
  )
}

function BaseScan({
  baseData,
  ratings,
  records,
}: {
  baseData: OutpostBaseData
  ratings: RatingTables
  records: ItemRecordMap
}) {
  const { structures } = baseData
  const powerStats = trapPowerStats(baseData.trapItems, ratings)
  const materials = [
    { count: structures.materials.wood, key: 'wooditemdata', name: 'Wood' },
    { count: structures.materials.stone, key: 'stoneitemdata', name: 'Stone' },
    { count: structures.materials.metal, key: 'metalitemdata', name: 'Metal' },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="accent">
          <Building2 className="size-3" />
          {structures.total} structures
        </Chip>
        <Chip>{structures.walls} walls</Chip>
        <Chip>{structures.floors} floors</Chip>
        <Chip>{structures.stairs} stairs</Chip>
        <Chip>{structures.cones} cones</Chip>
        {structures.other > 0 && (
          <span title="Doors, windows, arches and other edited pieces">
            <Chip>{structures.other} edited</Chip>
          </span>
        )}
        <Chip>
          T1 {structures.tiers.tier1} · T2 {structures.tiers.tier2} · T3{' '}
          {structures.tiers.tier3}
        </Chip>
        {powerStats && (
          <Chip tone="accent">
            <Gauge className="size-3" />
            {powerStats.min === powerStats.max
              ? `PL ${powerStats.max}`
              : `PL ${powerStats.min}–${powerStats.max}`}
          </Chip>
        )}
        {baseData.saveSizeBytes > 0 && (
          <Chip>{formatBytes(baseData.saveSizeBytes)} save</Chip>
        )}
      </div>

      {baseData.layout && <Minimap layout={baseData.layout} />}

      {structures.total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {materials.map((material) => (
            <div
              className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5"
              key={material.name}
            >
              <img
                alt={material.name}
                className="size-6 shrink-0 object-contain"
                src={assets(material.key)}
              />
              <div className="min-w-0">
                <p className="micro-label text-muted-foreground">
                  {material.name}
                </p>
                <p className="text-sm font-semibold tabular-nums leading-none">
                  {material.count}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {baseData.traps.length > 0 && (
        <>
          <p className="micro-label text-muted-foreground">
            {baseData.totalTraps} traps placed
          </p>
          {TRAP_CATEGORIES.map(({ key, label }) => {
            const traps = baseData.traps.filter(
              (trap) => trap.category === key
            )

            if (traps.length === 0) {
              return null
            }

            const categoryTotal = traps.reduce(
              (total, trap) => total + trap.count,
              0
            )

            return (
              <div className="flex flex-col gap-1.5" key={key}>
                <p className="micro-label text-muted-foreground/80">
                  {label} · {categoryTotal}
                </p>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {traps.map((trap) => (
                    <TrapTile
                      key={trap.displayName}
                      ratings={ratings}
                      records={records}
                      trap={trap}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </>
      )}

    </div>
  )
}

function TrapTile({
  ratings,
  records,
  trap,
}: {
  ratings: RatingTables
  records: ItemRecordMap
  trap: OutpostTrap
}) {
  const fallbackTrapIcon = assets('voucher_generic_trap')
  const accent = trap.rarity ? RARITY_HEX[trap.rarity] : undefined
  const record = trap.templateId
    ? getItemRecord(records, trap.templateId)
    : null
  const art = record?.image
    ? peglegImageURL(record.image)
    : (assets(trap.iconKey ?? '') ?? fallbackTrapIcon)
  const power =
    trap.templateId && trap.level !== null
      ? computeItemPower({
          level: trap.level,
          tables: ratings,
          templateId: trap.templateId,
        })
      : null

  return (
    <li
      className="flex flex-col gap-1.5 rounded-lg border px-2 py-1.5 text-xs"
      style={accent ? { borderColor: `${accent}66` } : undefined}
    >
      <div className="flex items-center gap-2">
        <img
          alt=""
          className="size-8 shrink-0 rounded object-contain"
          src={art}
          style={accent ? { backgroundColor: `${accent}1a` } : undefined}
        />
        <span
          className="min-w-0 flex-1 truncate font-medium"
          title={trap.displayName}
        >
          {trap.displayName}
        </span>
        <span className="shrink-0 font-semibold tabular-nums">
          ×{trap.count}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {trap.rarity && RARITY_LABEL[trap.rarity] && (
          <span
            className="rounded px-1 py-px micro-label"
            style={{ backgroundColor: `${accent}22`, color: accent }}
          >
            {RARITY_LABEL[trap.rarity]}
            {trap.tier ? ` ·T${trap.tier}` : ''}
          </span>
        )}
        {power !== null ? (
          <span className="rounded bg-muted/60 px-1 py-px micro-label tabular-nums">
            PL {power}
          </span>
        ) : (
          trap.level !== null && (
            <span className="rounded bg-muted/60 px-1 py-px micro-label tabular-nums">
              Lv {trap.level}
            </span>
          )
        )}
      </div>

      {trap.perks.length > 0 && (
        <div className="flex flex-wrap gap-1 text-[0.6875rem] text-muted-foreground">
          {trap.perks.map((perk) => (
            <span
              className="truncate rounded border border-border/50 px-1 py-px"
              key={perk.templateId}
              title={perkName(records, perk.templateId)}
            >
              {perkName(records, perk.templateId)}
              {perk.count > 1 && (
                <span className="ml-0.5 font-semibold tabular-nums">
                  ×{perk.count}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </li>
  )
}

/** Piece kinds in paint order — floors under everything, walls on top. */
const KIND_FLOOR = 0
const KIND_WALL = 1
const KIND_STAIR = 2
const KIND_ROOF = 3

/**
 * A top-down floor plan of the base, drawn to Fortnite's build grid. Floors
 * are full tiles, walls are thin segments on the grid lines they actually
 * occupy (their yaw picks the axis), stairs are diamonds and roofs smaller
 * tiles — all tinted by material, with traps as bright dots on top. A faint
 * grid underlay keeps the tile rhythm visible where nothing is built.
 */
function Minimap({ layout }: { layout: OutpostLayout }) {
  const gridId = useId()
  const { bounds } = layout
  const minX = bounds.minX - 1
  const minY = bounds.minY - 1
  const width = Math.max(1, bounds.maxX - bounds.minX + 3)
  const height = Math.max(1, bounds.maxY - bounds.minY + 3)

  const byKind = (kind: number) =>
    layout.structures.filter((piece) => piece[3] === kind)
  const others = layout.structures.filter((piece) => piece[3] > KIND_ROOF)

  const fill = (mat: number) => MATERIAL_HEX[mat] ?? MATERIAL_HEX[0]

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1 micro-label text-muted-foreground">
        <MapIcon className="size-3" />
        Base layout · {bounds.maxX - bounds.minX + 1}×
        {bounds.maxY - bounds.minY + 1} tiles
      </p>
      <div className="overflow-hidden rounded-lg border border-border/60 bg-background/40 p-2">
        <svg
          className="mx-auto block h-auto w-full text-border"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Top-down floor plan of the base"
          viewBox={`${minX} ${minY} ${width} ${height}`}
        >
          <defs>
            <pattern
              height={1}
              id={gridId}
              patternUnits="userSpaceOnUse"
              width={1}
              x={0}
              y={0}
            >
              <path
                d="M 1 0 L 0 0 0 1"
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeWidth={0.03}
              />
            </pattern>
          </defs>
          <rect
            fill={`url(#${gridId})`}
            height={height}
            width={width}
            x={minX}
            y={minY}
          />

          {byKind(KIND_FLOOR).map(([x, y, mat], index) => (
            <rect
              fill={fill(mat)}
              height={0.94}
              key={`f${index}`}
              opacity={0.5}
              width={0.94}
              x={x - 0.47}
              y={y - 0.47}
            />
          ))}
          {others.map(([x, y, mat], index) => (
            <rect
              fill={fill(mat)}
              height={0.8}
              key={`o${index}`}
              opacity={0.3}
              width={0.8}
              x={x - 0.4}
              y={y - 0.4}
            />
          ))}
          {byKind(KIND_ROOF).map(([x, y, mat], index) => (
            <rect
              fill={fill(mat)}
              height={0.7}
              key={`r${index}`}
              opacity={0.4}
              width={0.7}
              x={x - 0.35}
              y={y - 0.35}
            />
          ))}
          {byKind(KIND_STAIR).map(([x, y, mat], index) => (
            <rect
              fill={fill(mat)}
              height={0.55}
              key={`st${index}`}
              opacity={0.65}
              transform={`rotate(45 ${x} ${y})`}
              width={0.55}
              x={x - 0.275}
              y={y - 0.275}
            />
          ))}
          {byKind(KIND_WALL).map(([x, y, mat, , yaw], index) =>
            yaw % 2 === 0 ? (
              <rect
                fill={fill(mat)}
                height={0.16}
                key={`w${index}`}
                opacity={0.95}
                width={1}
                x={x - 0.5}
                y={y - 0.08}
              />
            ) : (
              <rect
                fill={fill(mat)}
                height={1}
                key={`w${index}`}
                opacity={0.95}
                width={0.16}
                x={x - 0.08}
                y={y - 0.5}
              />
            )
          )}
          {layout.traps.map(([x, y, cat], index) => (
            <circle
              cx={x}
              cy={y}
              fill={TRAP_SLOT_HEX[cat] ?? TRAP_SLOT_HEX[3]}
              key={`t${index}`}
              r={0.28}
              stroke="#0008"
              strokeWidth={0.04}
            />
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 micro-label text-muted-foreground">
        <LegendSwatch color={MATERIAL_HEX[0]} label="Wood" />
        <LegendSwatch color={MATERIAL_HEX[1]} label="Stone" />
        <LegendSwatch color={MATERIAL_HEX[2]} label="Metal" />
        <span className="text-border">|</span>
        <LegendSwatch color={TRAP_SLOT_HEX[0]} label="Floor trap" round />
        <LegendSwatch color={TRAP_SLOT_HEX[1]} label="Wall trap" round />
        <LegendSwatch color={TRAP_SLOT_HEX[2]} label="Ceiling trap" round />
      </div>
    </div>
  )
}

function LegendSwatch({
  color,
  label,
  round,
}: {
  color: string
  label: string
  round?: boolean
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={cn('size-2', round ? 'rounded-full' : 'rounded-sm')}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}
