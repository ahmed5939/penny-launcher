import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Boxes,
  Download,
  Hammer,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  Wrench,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type {
  TrapFamilyInfo,
  TrapHeightScaleEntry,
  TrapListItem,
  TrapNamedConfig,
} from '../../../kernel/core/file-tweaks/trap-height-types'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import {
  Callout,
  Chip,
  PageHeader,
  Panel,
  StatusPill,
} from '../../../components/page'

import { useFileTweaksData } from './-hooks'

const RARITY_LABELS: Record<string, string> = {
  C: 'Common',
  UC: 'Uncommon',
  R: 'Rare',
  VR: 'Epic',
  SR: 'Legendary',
  '-': 'Unique',
}

const RARITY_ORDER = ['C', 'UC', 'R', 'VR', 'SR', '-']

const CATEGORY_LABELS: Record<string, string> = {
  ceiling: 'Ceiling traps',
  floor: 'Floor traps',
  wall: 'Wall traps',
}
const CATEGORY_ORDER = ['floor', 'wall', 'ceiling']

type HeightOption = { hex: string; label: string }
type HeightOptionGroup = { group: string; options: HeightOption[] }

type TrapsData = {
  base: { currentHeight: string; found: boolean; isModified: boolean }
  families: Record<string, TrapFamilyInfo>
  heightScale: Array<TrapHeightScaleEntry>
  modified: Array<{
    currentHeight: string
    desc: string
    guid: string
    rarity: string
    tier: string
  }>
  namedConfigs: Array<TrapNamedConfig>
  traps: Array<TrapListItem>
}

function heightHexToUu(hex: string): number {
  const parts = hex.trim().split(/\s+/)
  const bytes = new Uint8Array([
    0,
    0,
    parseInt(parts[0], 16),
    parseInt(parts[1], 16),
  ])
  return new DataView(bytes.buffer).getFloat32(0, true)
}

function uuToHeightHex(value: number): string | null {
  if (!Number.isFinite(value)) return null

  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setFloat32(0, value, true)

  const hex = (byte: number) =>
    byte.toString(16).padStart(2, '0').toUpperCase()

  return `${hex(bytes[2])} ${hex(bytes[3])}`
}

/**
 * Height presets for one family: the universal block scale, the named
 * configs, and — for floor traps that support it — the family's inside-floor
 * and default values.
 */
function heightOptionsForFamily(
  family: TrapFamilyInfo | undefined,
  heightScale: Array<TrapHeightScaleEntry>,
  namedConfigs: Array<TrapNamedConfig>
): Array<HeightOptionGroup> {
  const groups: Array<HeightOptionGroup> = []

  groups.push({
    group: 'Block heights',
    options: heightScale.map((entry) => {
      const sign = Number(entry.blocks) > 0 ? '+' : ''

      return {
        hex: entry.hex,
        label: `${sign}${entry.blocks} blocks (${Math.round(entry.uu)} UU)`,
      }
    }),
  })

  if (namedConfigs.length > 0) {
    groups.push({
      group: 'Configurations',
      options: namedConfigs.map((config) => ({
        hex: config.hex,
        label: `${config.label} (${Math.round(config.uu)} UU)`,
      })),
    })
  }

  if (family?.insideFloor) {
    groups.push({
      group: 'Inside floor',
      options: [
        {
          hex: family.insideFloor.hex,
          label: `Inside floor (${Math.round(family.insideFloor.uu)} UU)`,
        },
      ],
    })
  }

  if (family) {
    groups.push({
      group: 'Default',
      options: [
        {
          hex: family.defaultHeight.hex,
          label: `Restore default (${Math.round(family.defaultHeight.uu)} UU)`,
        },
      ],
    })
  }

  return groups
}

function labelForHeight(
  hex: string,
  groups: Array<HeightOptionGroup>
): string {
  for (const group of groups) {
    const match = group.options.find((option) => option.hex === hex)

    if (match) return match.label
  }

  return `${Math.round(heightHexToUu(hex))} UU`
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  const {
    baseBusy,
    busyTrapGuid,
    handleApplyBase,
    handleApplyTrap,
    handleGenerateWorkerPower,
    handleLoadTraps,
    handleRevertAllTraps,
    handleRevertBase,
    handleRevertTrap,
    handleTogglePatch,
    handleWorkerPowerMode,
    patchLoading,
    patchStatuses,
    primaryAccount,
    refreshPatchStatus,
    trapsData,
    trapsError,
    trapsLoading,
    workerPower,
    workerPowerLoading,
    workerPowerMode,
  } = useFileTweaksData()

  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  const [baseUu, setBaseUu] = useState('-61')

  return (
    <>
      <PageHeader
        icon={Wrench}
        section={t('advanced-mode.title')}
        title={
          <span className="flex items-center gap-2">
            File Tweaks
            <BetaBadge />
          </span>
        }
        description="Patch Fortnite's game files directly — dev builds, dev stairs, airstrike and trap heights. Every change is reversible."
      />

      <Callout
        title="This edits game files on disk"
        tone="warning"
      >
        Close Fortnite before patching. If anything looks wrong in game, use
        "Verify" in the Epic Games Launcher to restore every file.
      </Callout>

      <div className="grid gap-3 lg:grid-cols-3">
        {(
          [
            {
              chunk: 'pakchunk10',
              description:
                'Unlocks developer-build movement features by breaking an asset name.',
              key: 'devBuilds',
              title: 'Dev Builds',
            },
            {
              chunk: 'pakchunk30',
              description:
                'Restores the removed buildable stairs. Turns Dev Builds off while active.',
              key: 'devStairs',
              title: 'DevStairs',
            },
            {
              chunk: 'pakchunk30',
              description:
                'Extends the airstrike impact radius to cover the whole map.',
              key: 'airStrike',
              title: 'AirStrike',
            },
          ] as const
        ).map((card) => (
          <PatchCard
            description={card.description}
            isLoading={patchLoading === card.key}
            key={card.key}
            onRefresh={() => refreshPatchStatus(card.key)}
            onToggle={() => handleTogglePatch(card.key)}
            status={patchStatuses[card.key]}
            title={card.title}
          />
        ))}
      </div>

      <TrapHeightSection
        baseBusy={baseBusy}
        baseUu={baseUu}
        busyTrapGuid={busyTrapGuid}
        onApplyBase={() => {
          const value = Number(baseUu)

          if (Number.isFinite(value)) handleApplyBase(value)
        }}
        onApplyTrap={handleApplyTrap}
        onBaseUuChange={setBaseUu}
        onLoad={handleLoadTraps}
        onRevertAll={handleRevertAllTraps}
        onRevertBase={handleRevertBase}
        onRevertTrap={handleRevertTrap}
        onSelectFamily={setSelectedFamily}
        selectedFamily={selectedFamily}
        trapsData={trapsData}
        trapsLoading={trapsLoading}
      />

      {trapsError && (
        <Callout title="Trap data unavailable" tone="danger">
          {trapsError}
        </Callout>
      )}

      <WorkerPowerSection
        disabled={!primaryAccount}
        mode={workerPowerMode}
        onChangeMode={handleWorkerPowerMode}
        onGenerate={handleGenerateWorkerPower}
        result={workerPower}
        working={workerPowerLoading}
      />
    </>
  )
}

function PatchCard({
  description,
  isLoading,
  onRefresh,
  onToggle,
  status,
  title,
}: {
  description: string
  isLoading: boolean
  onRefresh: () => void
  onToggle: () => void
  status?: { activated: boolean; error?: string; found: boolean }
  title: string
}) {
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        </div>

        {isLoading ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : status?.found ? (
          status.activated ? (
            <StatusPill tone="active">Active</StatusPill>
          ) : (
            <StatusPill tone="idle">Off</StatusPill>
          )
        ) : (
          <StatusPill tone="danger">Not found</StatusPill>
        )}
      </div>

      {status?.error && <p className="text-xs text-warning">{status.error}</p>}

      <div className="mt-auto flex items-center gap-2">
        <Button
          className="flex-1"
          disabled={isLoading || (Boolean(status) && !status?.found)}
          onClick={onToggle}
          size="sm"
        >
          {isLoading
            ? 'Working…'
            : status?.found && status.activated
              ? 'Deactivate'
              : 'Activate'}
        </Button>
        <Button
          aria-label={`Re-scan ${title}`}
          disabled={isLoading}
          onClick={onRefresh}
          size="icon"
          variant="ghost"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
    </Panel>
  )
}

function TrapHeightSection({
  baseBusy,
  baseUu,
  busyTrapGuid,
  onApplyBase,
  onApplyTrap,
  onBaseUuChange,
  onLoad,
  onRevertAll,
  onRevertBase,
  onRevertTrap,
  onSelectFamily,
  selectedFamily,
  trapsData,
  trapsLoading,
}: {
  baseBusy: boolean
  baseUu: string
  busyTrapGuid: string | null
  onApplyBase: () => void
  onApplyTrap: (guid: string, heightHex: string) => Promise<void>
  onBaseUuChange: (value: string) => void
  onLoad: () => void
  onRevertAll: () => void
  onRevertBase: () => void
  onRevertTrap: (guid: string) => Promise<void>
  onSelectFamily: (family: string | null) => void
  selectedFamily: string | null
  trapsData: TrapsData | null
  trapsLoading: boolean
}) {
  return (
    <Panel className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Hammer className="size-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">Trap height modifier</p>
            <p className="text-xs text-muted-foreground">
              Changes where traps sit on their tile, in pakchunk11.
            </p>
          </div>
        </div>

        {trapsData && trapsData.modified.length > 0 && (
          <Button
            disabled={baseBusy || busyTrapGuid !== null}
            onClick={onRevertAll}
            size="sm"
            variant="destructive"
          >
            <RefreshCw className="size-3.5" />
            Revert all ({trapsData.modified.length})
          </Button>
        )}
      </div>

      {!trapsData ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-muted-foreground">
            Load the trap database to start patching.
          </p>
          <Button
            disabled={trapsLoading}
            onClick={onLoad}
          >
            {trapsLoading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Boxes className="size-4" />
            )}
            Load traps
          </Button>
        </div>
      ) : selectedFamily ? (
        <FamilyDetail
          busyTrapGuid={busyTrapGuid}
          family={trapsData.families[selectedFamily]}
          familyName={selectedFamily}
          heightScale={trapsData.heightScale}
          modified={trapsData.modified}
          namedConfigs={trapsData.namedConfigs}
          onApplyTrap={onApplyTrap}
          onBack={() => onSelectFamily(null)}
          onRevertTrap={onRevertTrap}
          traps={trapsData.traps.filter(
            (trap) => trap.desc === selectedFamily
          )}
        />
      ) : (
        <FamilyGrid
          families={trapsData.families}
          modified={trapsData.modified}
          onSelect={onSelectFamily}
          traps={trapsData.traps}
        />
      )}

      {trapsData && (
        <BaseCard
          baseBusy={baseBusy}
          baseUu={baseUu}
          onApply={onApplyBase}
          onRevert={onRevertBase}
          onUuChange={onBaseUuChange}
          status={trapsData.base}
        />
      )}
    </Panel>
  )
}

function FamilyGrid({
  families,
  modified,
  onSelect,
  traps,
}: {
  families: Record<string, TrapFamilyInfo>
  modified: Array<{ desc: string; guid: string }>
  onSelect: (family: string) => void
  traps: Array<TrapListItem>
}) {
  const familiesByCategory = useMemo(() => {
    const result: Record<string, Array<string>> = {
      ceiling: [],
      floor: [],
      wall: [],
    }

    for (const [desc, info] of Object.entries(families)) {
      const category = info.category in result ? info.category : 'floor'
      result[category].push(desc)
    }

    return result
  }, [families])

  const modifiedCounts = useMemo(() => {
    const counts: Record<string, number> = {}

    for (const trap of modified) {
      counts[trap.desc] = (counts[trap.desc] ?? 0) + 1
    }

    return counts
  }, [modified])

  return (
    <div className="flex flex-col gap-4">
      {CATEGORY_ORDER.map((category) => {
        const items = familiesByCategory[category]

        if (!items || items.length === 0) return null

        return (
          <div key={category}>
            <p className="micro-label mb-2">{CATEGORY_LABELS[category]}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((desc) => {
                const info = families[desc]
                const count = modifiedCounts[desc] ?? 0
                const unsupported = !info?.heightSupported

                return (
                  <button
                    className={`group flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                      count > 0
                        ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                        : 'border-border/60 hover:bg-accent/30'
                    } ${unsupported ? 'opacity-50' : ''}`}
                    disabled={unsupported}
                    key={desc}
                    onClick={() => onSelect(desc)}
                  >
                    <span className="flex w-full items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold">
                        {desc}
                      </span>
                      {count > 0 && <Chip tone="accent">{count}</Chip>}
                    </span>
                    <span className="micro-label text-muted-foreground">
                      {unsupported
                        ? 'No height offset'
                        : `${traps.filter((trap) => trap.desc === desc).length} variants`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FamilyDetail({
  busyTrapGuid,
  family,
  familyName,
  heightScale,
  modified,
  namedConfigs,
  onApplyTrap,
  onBack,
  onRevertTrap,
  traps,
}: {
  busyTrapGuid: string | null
  family: TrapFamilyInfo | undefined
  familyName: string
  heightScale: Array<TrapHeightScaleEntry>
  modified: Array<{ currentHeight: string; guid: string }>
  namedConfigs: Array<TrapNamedConfig>
  onApplyTrap: (guid: string, heightHex: string) => Promise<void>
  onBack: () => void
  onRevertTrap: (guid: string) => Promise<void>
  traps: Array<TrapListItem>
}) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [customGuid, setCustomGuid] = useState<string | null>(null)
  const [customUu, setCustomUu] = useState('')

  const sorted = useMemo(
    () =>
      [...traps].sort((a, b) => {
        const rarity =
          RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)

        if (rarity !== 0) return rarity
        return a.tier.localeCompare(b.tier)
      }),
    [traps]
  )

  const optionGroups = useMemo(
    () => heightOptionsForFamily(family, heightScale, namedConfigs),
    [family, heightScale, namedConfigs]
  )

  const modifiedMap = useMemo(
    () => new Map(modified.map((trap) => [trap.guid, trap.currentHeight])),
    [modified]
  )

  if (!family) {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button onClick={onBack} size="sm" variant="ghost">
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{familyName}</p>
          <p className="micro-label text-muted-foreground">
            Default {Math.round(family.defaultHeight.uu)} UU
            {family.insideFloor
              ? ` · Inside floor ${Math.round(family.insideFloor.uu)} UU`
              : ''}
          </p>
        </div>
      </div>

      {!family.heightSupported && (
        <Callout title="Not patchable" tone="warning">
          This trap family has no modifiable height offset.
        </Callout>
      )}

      <div className="flex flex-col divide-y divide-border/60">
        {sorted.map((trap) => {
          const isBusy = busyTrapGuid === trap.guid
          const currentHeight = modifiedMap.get(trap.guid)
          const isModified = currentHeight !== undefined
          const otherBusy = busyTrapGuid !== null && busyTrapGuid !== trap.guid

          return (
            <div
              className="flex flex-wrap items-center gap-2 py-2.5"
              key={trap.guid}
            >
              <div className="flex min-w-40 items-center gap-2">
                <Chip>{RARITY_LABELS[trap.rarity] ?? trap.rarity}</Chip>
                <span className="micro-label text-muted-foreground">
                  {trap.tier}
                </span>
              </div>

              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                {currentHeight !== undefined && (
                  <Chip tone="accent">
                    {labelForHeight(currentHeight, optionGroups)}
                  </Chip>
                )}

                {customGuid === trap.guid ? (
                  <>
                    <Input
                      className="w-24"
                      onChange={(event) => setCustomUu(event.target.value)}
                      placeholder="Height in UU"
                      value={customUu}
                    />
                    <Button
                      disabled={otherBusy}
                      onClick={async () => {
                        const hex = uuToHeightHex(Number(customUu))

                        if (!hex) return

                        setCustomGuid(null)
                        setCustomUu('')
                        await onApplyTrap(trap.guid, hex)
                      }}
                      size="sm"
                    >
                      Set
                    </Button>
                    <Button
                      onClick={() => setCustomGuid(null)}
                      size="sm"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Select
                      onValueChange={(hex) =>
                        setSelections((current) => ({
                          ...current,
                          [trap.guid]: hex,
                        }))
                      }
                      value={selections[trap.guid] ?? ''}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Pick a height" />
                      </SelectTrigger>
                      <SelectContent>
                        {optionGroups.map((group) => (
                          <SelectGroup key={group.group}>
                            <SelectLabel>{group.group}</SelectLabel>
                            {group.options.map((option) => (
                              <SelectItem key={option.hex} value={option.hex}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      disabled={
                        !family.heightSupported ||
                        otherBusy ||
                        isBusy ||
                        !selections[trap.guid]
                      }
                      onClick={() => onApplyTrap(trap.guid, selections[trap.guid])}
                      size="sm"
                    >
                      {isBusy ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>

                    <Button
                      disabled={
                        !family.heightSupported || otherBusy || isBusy
                      }
                      onClick={() => {
                        setCustomGuid(trap.guid)
                        setCustomUu(
                          `${Math.round(heightHexToUu(family.defaultHeight.hex))}`
                        )
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Custom
                    </Button>

                    {isModified && (
                      <Button
                        disabled={
                          !family.heightSupported || otherBusy || isBusy
                        }
                        onClick={() => onRevertTrap(trap.guid)}
                        size="sm"
                        variant="destructive"
                      >
                        Revert
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BaseCard({
  baseBusy,
  baseUu,
  onApply,
  onRevert,
  onUuChange,
  status,
}: {
  baseBusy: boolean
  baseUu: string
  onApply: () => void
  onRevert: () => void
  onUuChange: (value: string) => void
  status: { currentHeight: string; found: boolean; isModified: boolean }
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">B.A.S.E. height</p>
        {status.isModified ? (
          <Chip tone="accent">
            {Math.round(heightHexToUu(status.currentHeight))} UU
          </Chip>
        ) : (
          <Chip>Default -61 UU</Chip>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Input
            className="w-24"
            onChange={(event) => onUuChange(event.target.value)}
            value={baseUu}
          />
          <Button disabled={baseBusy} onClick={onApply} size="sm">
            {baseBusy ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              'Apply'
            )}
          </Button>
          {status.isModified && (
            <Button
              disabled={baseBusy}
              onClick={onRevert}
              size="sm"
              variant="destructive"
            >
              Revert
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Sets the B.A.S.E. hologram projection height. The first apply scans
        pakchunk11 and can take a while.
      </p>
    </div>
  )
}

function WorkerPowerSection({
  disabled,
  mode,
  onChangeMode,
  onGenerate,
  result,
  working,
}: {
  disabled: boolean
  mode: 'high' | 'low'
  onChangeMode: (mode: 'high' | 'low') => void
  onGenerate: () => void
  result: {
    error?: string
    heroCount?: number
    json?: string
    modified?: number
    sizeMB?: string
    success: boolean
    workerCount?: number
  } | null
  working: boolean
}) {
  const download = () => {
    if (!result?.json) return

    const blob = new Blob([result.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = `campaign-${mode}power.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Zap className="size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Worker power file</p>
          <p className="text-xs text-muted-foreground">
            Exports the campaign profile with every worker and hero set to the
            same level, for use with external profile tools.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/60 p-1">
          {(['high', 'low'] as const).map((value) => (
            <button
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === value
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              key={value}
              onClick={() => onChangeMode(value)}
            >
              {value === 'high' ? 'Level 50' : 'Level 1'}
            </button>
          ))}
        </div>
      </div>

      {disabled && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <TriangleAlert className="size-3.5" />
          Select an account to generate the file.
        </p>
      )}

      {result && !result.success && (
        <p className="text-xs text-destructive">{result.error}</p>
      )}

      {result?.success && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="accent">{result.workerCount ?? 0} workers</Chip>
          <Chip tone="accent">{result.heroCount ?? 0} heroes</Chip>
          <Chip>{result.modified ?? 0} modified</Chip>
          <Chip>{result.sizeMB ?? '0'} MB</Chip>

          <Button className="ml-auto" onClick={download} size="sm">
            <Download className="size-3.5" />
            Download JSON
          </Button>
        </div>
      )}

      <div>
        <Button disabled={disabled || working} onClick={onGenerate} size="sm">
          {working ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : result?.success ? (
            <RefreshCw className="size-3.5" />
          ) : null}
          {result?.success ? 'Regenerate' : `Generate ${mode} power file`}
        </Button>
      </div>
    </Panel>
  )
}
