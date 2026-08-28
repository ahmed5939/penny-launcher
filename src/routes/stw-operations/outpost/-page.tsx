import {
  Building2,
  Coins,
  LoaderCircle,
  RadioTower,
  RefreshCw,
  ScanSearch,
  Shield,
  Users,
  Waves,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { OutpostZoneInfo } from '../../../kernel/core/outpost-types'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import {
  Callout,
  Chip,
  EmptyState,
  PageHeader,
  Panel,
} from '../../../components/page'

import { useOutpostData } from './-hooks'

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
    handleScanBase,
    infoLoading,
    loadingZone,
    primaryAccount,
    zones,
  } = useOutpostData()

  if (!primaryAccount) {
    return (
      <EmptyState
        icon={Shield}
        title="No account selected"
        description="Pick an account in the titlebar to inspect its outpost."
      />
    )
  }

  return (
    <>
      <div className="flex items-center justify-end border-b border-border/60 pb-3">
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

      <div className="grid gap-3 lg:grid-cols-2">
        {zones.map((zone) => (
          <ZoneCard
            baseData={baseData[zone.zoneId]}
            isLoadingBase={loadingZone === zone.zoneId}
            key={zone.zoneId}
            onScanBase={handleScanBase}
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
  zone,
}: {
  baseData?: {
    error?: string
    structures: { cones: number; floors: number; stairs: number; total: number; walls: number }
    success: boolean
    totalTraps: number
    traps: Array<{ count: number; displayName: string }>
    warning?: string
  }
  isLoadingBase: boolean
  onScanBase: (zoneId: string, saveFile: string) => void
  zone: OutpostZoneInfo
}) {
  const canScan = Boolean(zone.saveFile) && !isLoadingBase

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{zone.zoneName}</p>
          <p className="micro-label text-muted-foreground">
            Storm Shield · Level {zone.level}
          </p>
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

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="accent">
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
      </div>

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
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="accent">
              <Building2 className="size-3" />
              {baseData.structures.total} structures
            </Chip>
            <Chip>
              {baseData.structures.walls} walls
            </Chip>
            <Chip>
              {baseData.structures.floors} floors
            </Chip>
            <Chip>
              {baseData.structures.stairs} stairs
            </Chip>
            <Chip>
              {baseData.structures.cones} cones
            </Chip>
            <Chip>
              <Coins className="size-3" />
              {baseData.totalTraps} traps
            </Chip>
          </div>

          {baseData.traps.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {baseData.traps.map((trap) => (
                <li
                  className="flex items-center justify-between gap-2 text-xs"
                  key={trap.displayName}
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {trap.displayName}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {trap.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  )
}
