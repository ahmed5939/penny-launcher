import {
  FileJson2,
  LoaderCircle,
  Map as MapIcon,
  Maximize2,
  ScanSearch,
  Shield,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
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

import { Button } from '../../../components/ui/button'
import { TabsContent } from '../../../components/ui/tabs'
import {
  Callout,
  Chip,
  EmptyState,
  KeyValue,
  PageHeader,
  PageTabs,
  Panel,
  PanelHeader,
  ProgressBar,
  RefreshButton,
  Segmented,
  StatRow,
  StatTile,
  ToolBadges,
} from '../../../components/page'
import { ItemCard, ItemCardGrid } from '../../../components/items/item-card'

import { computeItemPower } from '../../../config/constants/fortnite/power'
import { RarityColor } from '../../../config/constants/resources'

import { useItemDatabaseStore, getItemRecord } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { getShortDateFormat, relativeTime } from '../../../lib/dates'
import { toast } from '../../../lib/notifications'
import { assets } from '../../../lib/repository'
import { cn } from '../../../lib/utils'
import {
  OUTPOST_MAP_UNDERLAYS,
  underlayBlueprintRect,
} from '../../../config/constants/outpost-maps'
import { OUTPOST_ZONE_TERRAIN } from '../../../config/constants/outpost-zones'
import { zoneTerrainImage } from './-blueprint-terrain'

import { Route } from './route'
import { resolveCollectionSelection } from '../../../lib/navigation/page-tabs'

import { useOutpostData } from './-hooks'
import { Blueprint3D } from './-blueprint-3d'
import {
  PROP_ROCK,
  PROP_TREE,
  propLabel,
  structureCentre,
  trapCentre,
} from './-blueprint-geometry'

const MAX_SHIELD_LEVEL = 10
const MAX_ENDURANCE_WAVE = 30

const TRAP_CATEGORIES: Array<{ key: OutpostTrapCategory; label: string }> = [
  { key: 'floor', label: 'Floor' },
  { key: 'wall', label: 'Wall' },
  { key: 'ceiling', label: 'Ceiling' },
  { key: 'other', label: 'Other' },
]

/** Minimap colours by layout code — structures by material, traps by slot. */
const MATERIAL_HEX = ['#c9a06a', '#9aa4ad', '#6fd3e0'] // wood, stone, metal
// floor/wall/ceiling/other
const TRAP_SLOT_HEX = [
  RarityColor.Legendary,
  RarityColor.Rare,
  RarityColor.Epic,
  RarityColor.Common,
]

/** Trap categories index straight into the slot palette, in declared order. */
const TRAP_CATEGORY_HEX: Record<OutpostTrapCategory, string> = {
  floor: TRAP_SLOT_HEX[0],
  wall: TRAP_SLOT_HEX[1],
  ceiling: TRAP_SLOT_HEX[2],
  other: TRAP_SLOT_HEX[3],
}

/** Trap slot labels by layout category code, for the hover tooltip. */
const TRAP_SLOT_LABEL = ['Floor', 'Wall', 'Ceiling', 'Other']

const MAX_ZOOM = 8

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
  return <Content />
}

function OutpostHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useTranslation(['sidebar'])

  return (
    <PageHeader
      actions={actions}
      icon={Shield}
      section={t('stw-operations.title')}
      status={<ToolBadges beta />}
      title="Outpost"
      description="Storm Shield progress for each zone, and the base you built there: scan it to walk it in 3D or read it as a blueprint."
    />
  )
}

function Content() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
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
      <>
        <OutpostHeader />
        <EmptyState
          icon={Shield}
          title="No account selected"
          description="Pick an account in the titlebar to inspect its outpost."
        />
      </>
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
      <OutpostHeader
        actions={
          <>
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
            <RefreshButton
              loading={infoLoading}
              onClick={handleRefresh}
            />
          </>
        }
      />

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
            hint={`of ${zones.length * MAX_SHIELD_LEVEL} across ${zones.length} zones`}
            label="Shield levels"
            value={totalLevels}
          />
          <StatTile
            hint={bestZone ? bestZone.zoneName : 'No endurance runs yet'}
            label="Best endurance wave"
            tone={
              (bestZone?.highestEnduranceWave ?? 0) >= MAX_ENDURANCE_WAVE
                ? 'success'
                : 'default'
            }
            value={bestZone?.highestEnduranceWave ?? 0}
          />
          <StatTile label="Amplifiers placed" value={totalAmplifiers} />
          <StatTile
            hint="Accounts with edit access"
            label="Builders"
            value={uniqueBuilders}
          />
        </StatRow>
      )}

      {zones.length > 0 && <PageTabs label="Outpost zones"
        value={resolveCollectionSelection(zones.map((zone) => zone.zoneId), tab) ?? tab}
        tabs={zones.map((zone) => ({ value: zone.zoneId, label: zone.zoneName }))}
        onValueChange={(value) => {
          if (value === 'pve_01' || value === 'pve_02' || value === 'pve_03' || value === 'pve_04') {
            void navigate({ search: (previous) => ({ ...previous, tab: value }), resetScroll: false })
          }
        }}>
        {zones.map((zone) => (
          <TabsContent key={`${primaryAccount.accountId}:${zone.zoneId}`} value={zone.zoneId}>
        <ZoneCard
          baseData={baseData[zone.zoneId]}
          displayName={primaryAccount.displayName || primaryAccount.accountId}
          isLoadingBase={loadingZone === zone.zoneId}
          key={zone.zoneId}
          onScanBase={handleScanBase}
          ratings={ratings}
          records={records}
          zone={zone}
        />
          </TabsContent>
        ))}
      </PageTabs>}
    </>
  )
}

function ZoneCard({
  baseData,
  displayName,
  isLoadingBase,
  onScanBase,
  ratings,
  records,
  zone,
}: {
  baseData?: OutpostBaseData
  displayName: string
  isLoadingBase: boolean
  onScanBase: (zoneId: string, saveFile: string) => void
  ratings: RatingTables
  records: ItemRecordMap
  zone: OutpostZoneInfo
}) {
  const visibleData = baseData
  const canScan = Boolean(zone.saveFile) && !isLoadingBase
  const badge = assets(ZONE_BADGES[zone.zoneId] ?? '')
  const enduranceComplete = zone.highestEnduranceWave >= MAX_ENDURANCE_WAVE
  const scanned = Boolean(visibleData?.success)
  const powerStats = visibleData?.success
    ? trapPowerStats(visibleData.trapItems, ratings)
    : null
  /**
   * The trap highlighted across the card — set by clicking a dot on the
   * blueprint or a tile in the trap list, cleared by clicking it again.
   */
  const [selectedTrap, setSelectedTrap] = useState<string | null>(null)
  const hasLayout = Boolean(visibleData?.success && visibleData.layout)

  return (
    <Panel>
      <PanelHeader
        actions={
          <>
            {visibleData?.success && (
              <Button
                onClick={async () => {
                  const result = await window.electronAPI.exportOutpostReport(
                    displayName,
                    zone,
                    visibleData
                  )

                  if (result.status === 'saved') {
                    toast.success('Outpost report saved.')
                  } else if (result.status === 'error') {
                    toast.error(result.error ?? 'Could not save the outpost report.')
                  }
                }}
                size="sm"
                variant="ghost"
              >
                <FileJson2 className="size-3.5" />
                Export report
              </Button>
            )}
            {/* Before the first scan the empty blueprint offers the button. */}
            {(scanned || isLoadingBase) && (
              <Button
                disabled={!canScan}
                onClick={() => {
                  setSelectedTrap(null)
                  onScanBase(zone.zoneId, zone.saveFile)
                }}
                size="sm"
                variant="outline"
              >
                {isLoadingBase ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <ScanSearch className="size-3.5" />
                )}
                Rescan base
              </Button>
            )}
          </>
        }
        description={
          zone.saveCount > 0 && zone.lastSavedAt
            ? `Base last saved ${relativeTime(zone.lastSavedAt)}`
            : undefined
        }
        title={
          <span className="flex items-center gap-2.5">
            {badge && (
              <img alt="" className="size-7 shrink-0 object-contain" src={badge} />
            )}
            {zone.zoneName}
          </span>
        }
      />

      {/*
        The status rail keeps a fixed width so every zone's blueprint area
        starts on the same vertical line down the page.
      */}
      <div className="grid gap-6 px-5 py-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
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

          <DefenseTimeline defenses={zone.defenses} />

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <KeyValue
              label="Amplifiers"
              value={<span className="figure">{zone.amplifierCount}</span>}
            />
            <KeyValue
              label="Builders"
              value={<span className="figure">{zone.editPermissions.length}</span>}
            />
            {powerStats && (
              <KeyValue
                label="Average trap power"
                value={<span className="figure">{powerStats.average}</span>}
              />
            )}
            {zone.saveCount > 0 && (
              <KeyValue
                label="Cloud saves"
                value={<span className="figure">{zone.saveCount}</span>}
              />
            )}
          </dl>

          {/* Purely numeric slot tags ("00"…"08") say nothing beyond the count. */}
          {zone.amplifierSlots.some((slot) => !/^\d+$/.test(slot)) && (
            <ChipList
              items={zone.amplifierSlots.map((slot) =>
                slot.replace(/_/g, ' ')
              )}
              label="Amplifier slots"
            />
          )}

          {zone.editPermissions.length > 0 && (
            <ChipList
              items={zone.editPermissions.map(
                (permission) => permission.displayName
              )}
              label="Edit access"
            />
          )}
        </div>

        <BlueprintShowcase
          baseData={visibleData}
          canScan={canScan}
          isLoadingBase={isLoadingBase}
          amplifierSlots={zone.amplifierSlots}
          onScan={() => onScanBase(zone.zoneId, zone.saveFile)}
          onSelectTrap={setSelectedTrap}
          zoneId={zone.zoneId}
          selectedTrap={selectedTrap}
        />
      </div>

      {visibleData?.success && !visibleData.warning && (
        <BaseDetails
          baseData={visibleData}
          onSelectTrap={hasLayout ? setSelectedTrap : undefined}
          powerStats={powerStats}
          ratings={ratings}
          records={records}
          selectedTrap={selectedTrap}
        />
      )}
    </Panel>
  )
}

/** A captioned row of neutral chips — names, slots, anything enumerable. */
function ChipList({ items, label }: { items: Array<string>; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="micro-label text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item, index) => (
          <Chip key={`${item}-${index}`}>{item}</Chip>
        ))}
      </div>
    </div>
  )
}

/**
 * The right-hand showcase: the blueprint once the base has been scanned,
 * otherwise a scan prompt (or the scan's error) in the same slot, so the
 * card keeps its shape through every state.
 */
function BlueprintShowcase({
  amplifierSlots,
  baseData,
  canScan,
  isLoadingBase,
  onScan,
  onSelectTrap,
  selectedTrap,
  zoneId,
}: {
  /** Occupied amplifier slots for this zone (`"00"`, `"01"` …). */
  amplifierSlots?: Array<string>
  baseData?: OutpostBaseData
  canScan: boolean
  isLoadingBase: boolean
  onScan: () => void
  onSelectTrap: (name: string | null) => void
  selectedTrap: string | null
  zoneId: string
}) {
  const [view, setView] = useState<'3d' | 'plan'>('3d')

  if (isLoadingBase) {
    return (
      <div
        className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-lg bg-muted/20 p-6 text-center"
        role="status"
      >
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Downloading and scanning the base save…
        </p>
      </div>
    )
  }

  if (baseData?.success && baseData.layout) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <Segmented
          className="self-start"
          onChange={setView}
          options={[
            { label: '3D', value: '3d' },
            { label: 'Blueprint', value: 'plan' },
          ]}
          value={view}
        />
        {/* Only the chosen view is mounted, so the 3D scene costs nothing while the plan is open. */}
        {view === '3d' ? (
          <Blueprint3D
            amplifierSlots={amplifierSlots}
            layout={baseData.layout}
            onSelectTrap={onSelectTrap}
            selectedTrap={selectedTrap}
            traps={baseData.traps}
            zoneId={zoneId}
          />
        ) : (
          <Blueprint
            baseData={baseData}
            layout={baseData.layout}
            onSelectTrap={onSelectTrap}
            selectedTrap={selectedTrap}
            zoneId={zoneId}
          />
        )}
      </div>
    )
  }

  const message = !baseData
    ? canScan
      ? 'Scan this base to draw its blueprint and list every structure and trap placed in the zone.'
      : 'This zone has no cloud save to scan yet.'
    : baseData.success
      ? (baseData.warning ??
        'The save was scanned but nothing in it had a position to draw.')
      : baseData.error

  if (baseData && !baseData.success) {
    return (
      <Callout title="Base scan failed" tone="danger">
        {message}
      </Callout>
    )
  }

  return (
    <EmptyState
      action={
        !baseData && canScan ? (
          <Button onClick={onScan} size="sm" variant="outline">
            <ScanSearch className="size-3.5" />
            Scan base
          </Button>
        ) : undefined
      }
      description={message}
      icon={MapIcon}
      title="No blueprint yet"
    />
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
function Blueprint({
  baseData,
  layout,
  onSelectTrap,
  selectedTrap,
  zoneId,
}: {
  baseData: OutpostBaseData
  layout: OutpostLayout
  onSelectTrap: (name: string | null) => void
  selectedTrap: string | null
  zoneId?: string
}) {
  const zoneTerrain = zoneId ? OUTPOST_ZONE_TERRAIN[zoneId] : undefined
  const underlay =
    zoneId && !zoneTerrain ? OUTPOST_MAP_UNDERLAYS[zoneId] : undefined
  const terrainImage = useMemo(
    () => (zoneTerrain ? zoneTerrainImage(zoneTerrain) : null),
    [zoneTerrain]
  )
  const underlayRect = underlay
    ? underlayBlueprintRect(underlay)
    : (terrainImage?.rect ?? null)
  const underlayHref = underlay
    ? (assets(underlay.image) ?? underlay.image)
    : terrainImage?.href
  const gridId = useId()
  const gridMajorId = useId()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{
    moved: number
    startCx: number
    startCy: number
    startX: number
    startY: number
  } | null>(null)
  const suppressClick = useRef(false)
  const [hovered, setHovered] = useState<{
    category: number
    index: number
    name?: string
    x: number
    y: number
  } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null)

  /**
   * Drawn a quarter turn counter-clockwise — world (x, y) → screen (y, −x) —
   * so the plan's north/south matches the in-game compass. Wall yaw
   * quadrants shift by one, which swaps their axis to match. Tile centres
   * include the half-cell offset from floor/stair/roof actor pivots.
   */
  const structures = useMemo(
    () =>
      layout.structures.map(
        (piece): [number, number, number, number, number, number] => {
          const [, , z, mat, kind, yaw] = piece
          const centre = structureCentre(piece)

          return [centre.y, -centre.x, z, mat, kind, yaw + 1]
        }
      ),
    [layout.structures]
  )
  const traps = useMemo(
    () =>
      layout.traps.map((trap): [number, number, number, number, number] => {
        const [, , z, cat, nameIdx] = trap
        const centre = trapCentre(trap)

        return [centre.y, -centre.x, z, cat, nameIdx]
      }),
    [layout.traps]
  )
  /* World actors near the build, as faint markers under everything else. */
  const props = useMemo(
    () =>
      layout.props
        .filter(
          ([x, y]) =>
            x >= layout.bounds.minX - 3 &&
            x <= layout.bounds.maxX + 3 &&
            y >= layout.bounds.minY - 3 &&
            y <= layout.bounds.maxY + 3
        )
        .map(([x, y, , kind, , scale, nameIdx]) => ({
          kind,
          name: propLabel(layout.propNames[nameIdx] ?? 'World asset'),
          scale: Math.min(2, Math.max(0.5, scale || 1)),
          x: y,
          y: -x,
        })),
    [layout.bounds, layout.propNames, layout.props]
  )
  const bounds = {
    maxX: layout.bounds.maxY,
    maxY: -layout.bounds.minX,
    minX: layout.bounds.minY,
    minY: -layout.bounds.maxX,
  }

  const minX = bounds.minX - 1.2
  const minY = bounds.minY - 1.2
  const width = Math.max(1, bounds.maxX - bounds.minX + 2.4)
  const height = Math.max(1, bounds.maxY - bounds.minY + 2.4)

  /* The zoomed window: same aspect as the full map, clamped inside it. */
  const clamp = (value: number, low: number, high: number) =>
    Math.min(Math.max(value, low), high)
  const vbW = width / zoom
  const vbH = height / zoom
  const cx = clamp(
    center?.x ?? minX + width / 2,
    minX + vbW / 2,
    minX + width - vbW / 2
  )
  const cy = clamp(
    center?.y ?? minY + height / 2,
    minY + vbH / 2,
    minY + height - vbH / 2
  )
  const vbX = cx - vbW / 2
  const vbY = cy - vbH / 2
  /* Trap dots shrink a little as the view closes in, or they turn to blobs. */
  const dotScale = 1 / Math.sqrt(zoom)

  const applyZoom = (factor: number, anchor?: { x: number; y: number }) => {
    const next = clamp(zoom * factor, 1, MAX_ZOOM)

    if (next === zoom) return

    if (next <= 1) {
      setCenter(null)
    } else if (anchor) {
      /* Pull the centre toward the anchor so that point stays put. */
      const ratio = zoom / next

      setCenter({
        x: anchor.x + (cx - anchor.x) * ratio,
        y: anchor.y + (cy - anchor.y) * ratio,
      })
    }

    setZoom(next)
  }

  /* Wheel zoom needs a non-passive listener to keep the page from scrolling. */
  useEffect(() => {
    const wrapper = wrapperRef.current

    if (!wrapper) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()

      const rect = wrapper.getBoundingClientRect()

      applyZoom(event.deltaY < 0 ? 1.25 : 1 / 1.25, {
        x: vbX + ((event.clientX - rect.left) / rect.width) * vbW,
        y: vbY + ((event.clientY - rect.top) / rect.height) * vbH,
      })
    }

    wrapper.addEventListener('wheel', onWheel, { passive: false })

    return () => wrapper.removeEventListener('wheel', onWheel)
  })

  const trapsByName = useMemo(
    () => new Map(baseData.traps.map((trap) => [trap.displayName, trap])),
    [baseData.traps]
  )

  const trapNames = layout.trapNames ?? []
  /* Only dim the other dots when the selection actually exists on this map. */
  const selectionOnMap =
    selectedTrap !== null &&
    layout.traps.some(([, , , , nameIdx]) =>
      trapNames[nameIdx] === selectedTrap
    )
  const hoveredGroup = hovered?.name ? trapsByName.get(hovered.name) : undefined

  const byKind = (kind: number) =>
    structures.filter((piece) => piece[4] === kind)
  const others = structures.filter((piece) => piece[4] > KIND_ROOF)

  const fill = (mat: number) => MATERIAL_HEX[mat] ?? MATERIAL_HEX[0]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {bounds.maxX - bounds.minX + 1} × {bounds.maxY - bounds.minY + 1}{' '}
          tiles, north up
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {selectedTrap && (
            <button
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-1.5 py-0.5 micro-label text-primary"
              onClick={() => onSelectTrap(null)}
              title="Clear the trap highlight"
              type="button"
            >
              {selectedTrap}
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-muted/20 p-3">
        {/*
          The wrapper carries the viewBox's exact aspect ratio so the svg
          fills it edge to edge — that is what lets the hover tooltip be
          positioned with plain percentages of the map's coordinates.
        */}
        <div
          className={cn(
            'relative mx-auto w-full',
            zoom > 1 && 'cursor-grab active:cursor-grabbing'
          )}
          onClickCapture={(event) => {
            /* A drag should not also register as a trap click on release. */
            if (suppressClick.current) {
              event.stopPropagation()
              suppressClick.current = false
            }
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onPointerDown={(event) => {
            if (zoom <= 1) return
            if ((event.target as HTMLElement).closest('button')) return

            drag.current = {
              moved: 0,
              startCx: cx,
              startCy: cy,
              startX: event.clientX,
              startY: event.clientY,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!drag.current) return

            const rect = event.currentTarget.getBoundingClientRect()
            const dx = event.clientX - drag.current.startX
            const dy = event.clientY - drag.current.startY

            drag.current.moved = Math.max(
              drag.current.moved,
              Math.abs(dx) + Math.abs(dy)
            )
            setCenter({
              x: drag.current.startCx - (dx / rect.width) * vbW,
              y: drag.current.startCy - (dy / rect.height) * vbH,
            })
          }}
          onPointerUp={() => {
            suppressClick.current = (drag.current?.moved ?? 0) > 5
            drag.current = null
          }}
          ref={wrapperRef}
          style={{
            aspectRatio: `${width} / ${height}`,
            maxWidth: `${Math.max(18, Math.round(30 * (width / height) * 10) / 10)}rem`,
            touchAction: 'none',
          }}
        >
          <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
            <Button
              className="size-7"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => applyZoom(1.5)}
              size="icon"
              title="Zoom in"
              type="button"
              variant="outline"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              className="size-7"
              disabled={zoom <= 1}
              onClick={() => applyZoom(1 / 1.5)}
              size="icon"
              title="Zoom out"
              type="button"
              variant="outline"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            {zoom > 1 && (
              <Button
                className="size-7"
                onClick={() => {
                  setZoom(1)
                  setCenter(null)
                }}
                size="icon"
                title="Reset view"
                type="button"
                variant="outline"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            )}
          </div>

          <svg
            className="block size-full text-border"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Top-down floor plan of the base"
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          >
            <defs>
              {/*
                Offset by half a cell so the lines land on tile boundaries —
                pieces are centred on integer coordinates.
              */}
              <pattern
                height={1}
                id={gridId}
                patternUnits="userSpaceOnUse"
                width={1}
                x={0.5}
                y={0.5}
              >
                <path
                  d="M 1 0 L 0 0 0 1"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.22}
                  strokeWidth={0.03}
                />
              </pattern>
              <pattern
                height={4}
                id={gridMajorId}
                patternUnits="userSpaceOnUse"
                width={4}
                x={0.5}
                y={0.5}
              >
                <path
                  d="M 4 0 L 0 0 0 4"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.4}
                  strokeWidth={0.045}
                />
              </pattern>
            </defs>
            {underlayRect && underlayHref && (
              <image
                height={underlayRect.height}
                href={underlayHref}
                opacity={0.85}
                preserveAspectRatio="none"
                transform={
                  underlay?.mirrorX || underlay?.mirrorY
                    ? /* Mirror about the image's own centre. */
                      `translate(${underlayRect.x + underlayRect.width / 2} ${underlayRect.y + underlayRect.height / 2}) scale(${underlay.mirrorX ? -1 : 1} ${underlay.mirrorY ? -1 : 1}) translate(${-(underlayRect.x + underlayRect.width / 2)} ${-(underlayRect.y + underlayRect.height / 2)})`
                    : undefined
                }
                width={underlayRect.width}
                x={underlayRect.x}
                y={underlayRect.y}
              />
            )}
            <rect
              fill={`url(#${gridId})`}
              height={height}
              width={width}
              x={minX}
              y={minY}
            />
            <rect
              fill={`url(#${gridMajorId})`}
              height={height}
              width={width}
              x={minX}
              y={minY}
            />

            {props.map((prop, index) =>
              prop.kind === PROP_TREE ? (
                <circle
                  cx={prop.x}
                  cy={prop.y}
                  fill="#4f8a3c"
                  key={`p${index}`}
                  opacity={0.45}
                  r={0.32 * prop.scale}
                >
                  <title>{prop.name}</title>
                </circle>
              ) : prop.kind === PROP_ROCK ? (
                <circle
                  cx={prop.x}
                  cy={prop.y}
                  fill="#7a7f86"
                  key={`p${index}`}
                  opacity={0.45}
                  r={0.24 * prop.scale}
                >
                  <title>{prop.name}</title>
                </circle>
              ) : (
                <rect
                  fill="#8a7f72"
                  height={0.4 * prop.scale}
                  key={`p${index}`}
                  opacity={0.4}
                  rx={0.04}
                  width={0.4 * prop.scale}
                  x={prop.x - 0.2 * prop.scale}
                  y={prop.y - 0.2 * prop.scale}
                >
                  <title>{prop.name}</title>
                </rect>
              )
            )}
            {byKind(KIND_FLOOR).map(([x, y, , mat], index) => (
              <rect
                fill={fill(mat)}
                height={0.94}
                key={`f${index}`}
                opacity={0.5}
                rx={0.06}
                width={0.94}
                x={x - 0.47}
                y={y - 0.47}
              />
            ))}
            {others.map(([x, y, , mat], index) => (
              <rect
                fill={fill(mat)}
                height={0.8}
                key={`o${index}`}
                opacity={0.3}
                rx={0.06}
                width={0.8}
                x={x - 0.4}
                y={y - 0.4}
              />
            ))}
            {byKind(KIND_ROOF).map(([x, y, , mat], index) => (
              <rect
                fill={fill(mat)}
                height={0.7}
                key={`r${index}`}
                opacity={0.4}
                rx={0.06}
                width={0.7}
                x={x - 0.35}
                y={y - 0.35}
              />
            ))}
            {byKind(KIND_STAIR).map(([x, y, , mat], index) => (
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
            {byKind(KIND_WALL).map(([x, y, , mat, , yaw], index) =>
              yaw % 2 === 0 ? (
                <rect
                  fill={fill(mat)}
                  height={0.16}
                  key={`w${index}`}
                  opacity={0.95}
                  rx={0.05}
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
                  rx={0.05}
                  width={0.16}
                  x={x - 0.08}
                  y={y - 0.5}
                />
              )
            )}

            {traps.map(([x, y, , cat, nameIdx], index) => {
              const name = trapNames[nameIdx]
              const isSelected = selectionOnMap && name === selectedTrap
              const dimmed = selectionOnMap && name !== selectedTrap
              const isHovered = hovered?.index === index

              return (
                <circle
                  cx={x}
                  cy={y}
                  fill={TRAP_SLOT_HEX[cat] ?? TRAP_SLOT_HEX[3]}
                  fillOpacity={dimmed ? 0.2 : 1}
                  key={`t${index}`}
                  onClick={
                    name
                      ? () => onSelectTrap(isSelected ? null : name)
                      : undefined
                  }
                  onMouseEnter={() =>
                    setHovered({ category: cat, index, name, x, y })
                  }
                  onMouseLeave={() => setHovered(null)}
                  r={(isSelected || isHovered ? 0.42 : 0.3) * dotScale}
                  stroke={isSelected || isHovered ? '#ffffff' : '#0008'}
                  strokeOpacity={dimmed ? 0.2 : 1}
                  strokeWidth={
                    (isSelected || isHovered ? 0.09 : 0.04) * dotScale
                  }
                />
              )
            })}
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute z-10 min-w-max rounded-md border border-border bg-popover px-2 py-1 shadow-md"
              style={{
                left: `${((hovered.x - vbX) / vbW) * 100}%`,
                top: `${((hovered.y - vbY) / vbH) * 100}%`,
                transform: 'translate(-50%, calc(-100% - 8px))',
              }}
            >
              <p className="text-xs font-medium">
                {hovered.name ?? 'Trap'}
              </p>
              <p className="micro-label text-muted-foreground">
                {TRAP_SLOT_LABEL[hovered.category] ?? 'Other'} trap
                {hoveredGroup && ` · ×${hoveredGroup.count} placed`}
                {hoveredGroup?.tier && ` · T${hoveredGroup.tier}`}
              </p>
            </div>
          )}
        </div>
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
      <p className="text-caption text-muted-foreground">
        Scroll to zoom, drag to pan, click a trap to highlight every copy.
      </p>
    </div>
  )
}

/**
 * Everything the scan found, below the blueprint at the card's full width:
 * the structure breakdown as one strip of tiles, then the traps grouped by
 * slot with the same colours the blueprint's dots use.
 */
function BaseDetails({
  baseData,
  onSelectTrap,
  powerStats,
  ratings,
  records,
  selectedTrap,
}: {
  baseData: OutpostBaseData
  /** Present only when a blueprint exists to highlight the trap on. */
  onSelectTrap?: (name: string | null) => void
  powerStats: { average: number; max: number; min: number } | null
  ratings: RatingTables
  records: ItemRecordMap
  selectedTrap: string | null
}) {
  const { structures } = baseData
  const materials = [
    { count: structures.materials.wood, key: 'wooditemdata', name: 'Wood' },
    { count: structures.materials.stone, key: 'stoneitemdata', name: 'Stone' },
    { count: structures.materials.metal, key: 'metalitemdata', name: 'Metal' },
  ]
  const pieces = [
    { count: structures.walls, name: 'Walls' },
    { count: structures.floors, name: 'Floors' },
    { count: structures.stairs, name: 'Stairs' },
    { count: structures.cones, name: 'Cones' },
    {
      count: structures.other,
      hint: 'Doors, windows, arches and other edited pieces',
      name: 'Edited',
    },
  ]

  return (
    <>
      {structures.total > 0 && (
        <div className="flex flex-col gap-3 border-t border-border/30 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="section-label">Structures</h3>
            <p className="text-xs text-muted-foreground">
              <span className="figure text-foreground">{structures.total}</span>{' '}
              pieces · T1 {structures.tiers.tier1} · T2 {structures.tiers.tier2}{' '}
              · T3 {structures.tiers.tier3}
              {baseData.saveSizeBytes > 0 &&
                ` · ${formatBytes(baseData.saveSizeBytes)} save`}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {materials.map((material) => (
              <KeyValue
                key={material.name}
                label={
                  <span className="flex items-center gap-1.5">
                    <img
                      alt=""
                      className="size-4 object-contain"
                      src={assets(material.key)}
                    />
                    {material.name}
                  </span>
                }
                value={<span className="figure">{material.count}</span>}
              />
            ))}
            {pieces.map((piece) => (
              <KeyValue
                key={piece.name}
                label={<span title={piece.hint}>{piece.name}</span>}
                value={<span className="figure">{piece.count}</span>}
              />
            ))}
          </dl>
        </div>
      )}

      {baseData.traps.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-border/30 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="section-label">Traps</h3>
            <p className="text-xs text-muted-foreground">
              <span className="figure text-foreground">{baseData.totalTraps}</span>{' '}
              placed
              {powerStats &&
                (powerStats.min === powerStats.max
                  ? ` · power ${powerStats.max}`
                  : ` · power ${powerStats.min}–${powerStats.max}`)}
              {onSelectTrap && ' · click one to find it in the base'}
            </p>
          </div>

          {/* One grid in slot order; the dot matches the trap's frame in the 3D view. */}
          <ItemCardGrid>
            {TRAP_CATEGORIES.flatMap(({ key, label }) =>
              baseData.traps
                .filter((trap) => trap.category === key)
                .sort((a, b) => b.count - a.count)
                .map((trap) => (
                  <TrapCard
                    key={trap.displayName}
                    onSelect={onSelectTrap}
                    ratings={ratings}
                    records={records}
                    selected={selectedTrap === trap.displayName}
                    slot={
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ backgroundColor: TRAP_CATEGORY_HEX[key] }}
                        />
                        {label} trap
                      </span>
                    }
                    trap={trap}
                  />
                ))
            )}
          </ItemCardGrid>
        </div>
      )}
    </>
  )
}

/** The scan's TID rarity codes, for traps the database can't name. */
const RARITY_NAMES: Record<string, string> = {
  c: 'Common',
  uc: 'Uncommon',
  r: 'Rare',
  vr: 'Epic',
  sr: 'Legendary',
  ur: 'Mythic',
}

/** A trap group as the game shows items: its art, rarity, power and perks. */
function TrapCard({
  onSelect,
  ratings,
  records,
  selected,
  slot,
  trap,
}: {
  /** Present only when a blueprint exists to highlight the trap on. */
  onSelect?: (name: string | null) => void
  ratings: RatingTables
  records: ItemRecordMap
  selected?: boolean
  /** Which surface it mounts on. */
  slot: ReactNode
  trap: OutpostTrap
}) {
  const record = trap.templateId
    ? getItemRecord(records, trap.templateId)
    : null
  // Without a database record the card has no art of its own; use the icon.
  const fallbackArt = record?.image
    ? null
    : (assets(trap.iconKey ?? '') ?? assets('voucher_generic_trap'))
  const power =
    trap.templateId && trap.level !== null
      ? computeItemPower({
          level: trap.level,
          tables: ratings,
          templateId: trap.templateId,
        })
      : null

  return (
    <ItemCard
      badges={
        trap.perks.length > 0
          ? trap.perks.map((perk) => (
              <Chip key={perk.templateId}>
                {perkName(records, perk.templateId)}
                {perk.count > 1 && ` ×${perk.count}`}
              </Chip>
            ))
          : undefined
      }
      className={cn(selected && 'ring-2 ring-primary/70')}
      eyebrow={trap.templateId ? undefined : RARITY_NAMES[trap.rarity ?? '']}
      level={power === null ? trap.level : undefined}
      name={trap.displayName}
      onClick={
        onSelect
          ? () => onSelect(selected ? null : trap.displayName)
          : undefined
      }
      overlay={
        fallbackArt ? (
          <img
            alt=""
            className="absolute inset-0 size-full bg-card object-contain p-3"
            src={fallbackArt}
          />
        ) : undefined
      }
      power={power}
      quantity={trap.count}
      records={records}
      subtitle={slot}
      templateId={trap.templateId ?? ''}
      tier={trap.tier ?? undefined}
    />
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
