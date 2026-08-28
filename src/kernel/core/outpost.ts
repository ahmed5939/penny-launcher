import type {
  OutpostBaseData,
  OutpostDefenseRecord,
  OutpostInfoResult,
  OutpostLayout,
  OutpostPerkTally,
  OutpostTrap,
  OutpostTrapInstanceTally,
  OutpostTrapCategory,
  OutpostStructures,
  OutpostZoneInfo,
} from './outpost-types'
import type { AccountData } from '../../types/accounts'
import type { MCPQueryProfile } from '../../types/services/mcp'

import axios from 'axios'
import { Buffer } from 'node:buffer'
import * as zlib from 'node:zlib'

import { RuntimeLog } from '../runtime-log'

import { Authentication } from './authentication'

import {
  getQueryProfile,
  getQueryProfileMetadata,
} from '../../services/endpoints/mcp'
import { findUsersByAccountIds } from '../../services/endpoints/lookup'

/**
 * Outpost viewer — reads the `metadata` profile for Storm Shield state
 * (zone levels, endurance waves, amplifiers, edit permissions, cloud save
 * file) and parses the zone's `.sav` backup from user cloud storage to
 * inventory the structures and traps actually placed in the base.
 */

const CLOUD_STORAGE_USER =
  'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/cloudstorage/user'

const ZONE_MAP: Record<string, string> = {
  outpostcore_pve_04: 'Twine Peaks',
  outpostcore_pve_03: 'Canny Valley',
  outpostcore_pve_02: 'Plankerton',
  outpostcore_pve_01: 'Stonewood',
}

const ZONE_ORDER = [
  'outpostcore_pve_04',
  'outpostcore_pve_03',
  'outpostcore_pve_02',
  'outpostcore_pve_01',
]

const TRAP_NAMES: Record<string, string> = {
  Floor_Spikes_Wood: 'Wooden Floor Spikes',
  Floor_Freeze: 'Floor Freeze Trap',
  Floor_Tar: 'Tar Pit',
  Floor_Launcher: 'Floor Launcher',
  Floor_Ward_AntiAir: 'Anti-Air Trap',
  Floor_Health_First_Aid_MegaBacon: 'Healing Pad',
  Floor_Hoverboard_Speed: 'Boost Pad',
  Floor_Player_Jump_Pad: 'Jump Pad (Up)',
  Floor_Player_Jump_Free_Direction_Pad: 'Jump Pad (Directional)',
  Floor_Spikes: 'Retractable Floor Spikes',
  Floor_Campfire: 'Cozy Campfire',
  Floor_Flamegrill: 'Flame Grill Trap',
  Floor_Health: 'Healing Pad',
  Wall_Darts: 'Wall Darts',
  Wall_Electric: 'Wall Dynamo',
  Wall_Launcher: 'Wall Launcher',
  Wall_Spikes: 'Wall Spikes',
  Wall_Wood_Spikes: 'Wall Spikes',
  Wall_Light: 'Wall Lights',
  Wall_Speaker: 'Sound Wall',
  Wall_Cannons: 'Broadside',
  Wall_Mechstructor: 'Zap-o-max',
  Ceiling_Electric: 'Ceiling Electric Field',
  Ceiling_ElectricWeak: 'Ceiling Zapper',
  Ceiling_Electric_Single: 'Ceiling Zapper',
  Ceiling_Falling: 'Ceiling Drop Trap',
  Ceiling_Gas: 'Ceiling Gas Trap',
  Ceiling_Spikes: 'Ceiling Spikes',
  Ceiling_Goop: 'Vindertech Goop',
}

/**
 * Blueprint → key in the renderer's local image map (`src/images.ts`), the
 * same art the mission-alert rewards use. Blueprints without shipped art
 * (Ceiling_Spikes, Ceiling_Goop) simply have no entry.
 */
const TRAP_ICONS: Record<string, string> = {
  Floor_Spikes_Wood: 'floor_spikes_wood',
  Floor_Freeze: 'floor_freeze',
  Floor_Tar: 'floor_tar',
  Floor_Launcher: 'floor_launcher',
  Floor_Ward_AntiAir: 'floor_ward',
  Floor_Health_First_Aid_MegaBacon: 'floor_health',
  Floor_Hoverboard_Speed: 'floor_hoverboard_speed',
  Floor_Player_Jump_Pad: 'floor_player_jump_pad',
  Floor_Player_Jump_Free_Direction_Pad: 'floor_player_jump_pad_free_direction',
  Floor_Spikes: 'floor_spikes',
  Floor_Campfire: 'floor_campfire',
  Floor_Flamegrill: 'floor_flamegrill',
  Floor_Health: 'floor_health',
  Wall_Darts: 'wall_darts',
  Wall_Electric: 'wall_electric',
  Wall_Launcher: 'wall_launcher',
  Wall_Spikes: 'wall_wood_spikes',
  Wall_Wood_Spikes: 'wall_wood_spikes',
  Wall_Light: 'wall_light',
  Wall_Speaker: 'wall_speaker',
  Wall_Cannons: 'wall_cannons',
  Wall_Mechstructor: 'wall_mechstructor',
  Ceiling_Electric: 'ceiling_electric_aoe',
  Ceiling_ElectricWeak: 'ceiling_electric_single',
  Ceiling_Electric_Single: 'ceiling_electric_single',
  Ceiling_Falling: 'ceiling_falling',
  Ceiling_Gas: 'ceiling_gas',
}

/**
 * Save files spell blueprints inconsistently (`Floor_Flamegrill` vs
 * `Floor_FlameGrill`), so both lookup tables are matched case-insensitively.
 */
const TRAP_NAMES_LOWER = new Map(
  Object.entries(TRAP_NAMES).map(([key, value]) => [key.toLowerCase(), value])
)
const TRAP_ICONS_LOWER = new Map(
  Object.entries(TRAP_ICONS).map(([key, value]) => [key.toLowerCase(), value])
)

function trapCategory(blueprint: string): OutpostTrapCategory {
  const lower = blueprint.toLowerCase()

  if (lower.startsWith('floor_')) return 'floor'
  if (lower.startsWith('wall_')) return 'wall'
  if (lower.startsWith('ceiling_')) return 'ceiling'

  return 'other'
}

const MATERIAL_MAP: Record<string, keyof OutpostStructures['materials']> = {
  W: 'wood',
  S: 'stone',
  M: 'metal',
}

/** Layout material codes — kept in sync with `OutpostLayout.structures`. */
const MATERIAL_LAYOUT_CODE: Record<string, number> = {
  W: 0,
  S: 1,
  M: 2,
}

/** Layout category codes — kept in sync with `OutpostLayout.traps`. */
const TRAP_LAYOUT_CODE: Record<OutpostTrapCategory, number> = {
  floor: 0,
  wall: 1,
  ceiling: 2,
  other: 3,
}

/** Layout piece kinds — kept in sync with `OutpostLayout.structures`. */
function pieceKindCode(pieceType: string): number {
  if (PIECE_TYPES.walls.includes(pieceType)) return 1
  if (PIECE_TYPES.floors.includes(pieceType)) return 0
  if (pieceType.startsWith('Stair')) return 2
  if (pieceType.startsWith('Roof')) return 3

  return 4
}

const PIECE_TYPES: Record<string, Array<string>> = {
  walls: ['Solid'],
  floors: ['Floor', 'Floor_2'],
  stairs: ['StairW', 'StairF', 'StairT', 'StairR', 'StairSpiral'],
  cones: ['RoofC'],
}

// ── .sav parsing ─────────────────────────────────────────────

/**
 * Storm Shield `.sav` files are Unreal GVAS saves: a flat stream of
 * length-prefixed strings and typed properties. The launcher only needs a
 * handful of fields per placed actor, so rather than model the whole format
 * this walks it opportunistically — anchor on each actor's blueprint path,
 * then read the fixed transform that follows and scan a bounded window for
 * the named properties that come after it.
 */

const GRID_CELL = 512

/** An FString: int32 byte length (including the null terminator), then bytes. */
function readGvasString(
  buffer: Buffer,
  offset: number
): { next: number; value: string | null } {
  if (offset < 0 || offset + 4 > buffer.length) {
    return { next: offset + 4, value: null }
  }

  const length = buffer.readInt32LE(offset)

  if (length <= 0 || offset + 4 + length > buffer.length || length > 1024) {
    return { next: offset + 4, value: null }
  }

  return {
    next: offset + 4 + length,
    // Drop the trailing null terminator.
    value: buffer
      .subarray(offset + 4, offset + 4 + length - 1)
      .toString('latin1'),
  }
}

/**
 * The actor transform sits immediately after the blueprint path string: an
 * FQuat (X, Y, Z, W), then the XYZ translation. Saves written before the
 * UE5 move store these as 4-byte floats; newer ones as 8-byte doubles. The
 * quaternion must be unit-length and the translation must land inside a
 * plausible Storm Shield, so whichever width satisfies both is the right
 * one — a misread of the other width yields denormal garbage, not a unit
 * quaternion. Only ground-plane X/Y and yaw are kept; build pieces rotate
 * about Z in 90° steps.
 */
function readActorTransform(
  buffer: Buffer,
  afterBlueprint: number
): { x: number; y: number; yawQuadrant: number } | null {
  const attempt = (
    wordBytes: number,
    read: (offset: number) => number
  ): { x: number; y: number; yawQuadrant: number } | null => {
    if (afterBlueprint + wordBytes * 7 > buffer.length) {
      return null
    }

    const qx = read(afterBlueprint)
    const qy = read(afterBlueprint + wordBytes)
    const qz = read(afterBlueprint + wordBytes * 2)
    const qw = read(afterBlueprint + wordBytes * 3)
    const x = read(afterBlueprint + wordBytes * 4)
    const y = read(afterBlueprint + wordBytes * 5)

    const norm = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw)

    if (!Number.isFinite(norm) || Math.abs(norm - 1) > 0.05) {
      return null
    }

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > 1_000_000 ||
      Math.abs(y) > 1_000_000
    ) {
      return null
    }

    const yaw =
      (Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) *
        180) /
      Math.PI

    return { x, y, yawQuadrant: ((Math.round(yaw / 90) % 4) + 4) % 4 }
  }

  return (
    attempt(4, (offset) => buffer.readFloatLE(offset)) ??
    attempt(8, (offset) => buffer.readDoubleLE(offset))
  )
}

/**
 * Read a trap's `AppliedAlterations` — its perks. The ArrayProperty header
 * changed across save generations, but the entries themselves are stable:
 * contiguous object-reference strings of the form `.../AID_x.AID_x`. So the
 * entries are matched directly, from the array's name up to whichever trap
 * property follows it, which bounds the scan without knowing the header.
 */
const PERK_STOP_MARKERS = [
  'AttachedTo',
  'OriginalTrapLevel',
  'SavedDurabilityPct',
  'TrapData',
]

function readAppliedAlterations(
  text: string,
  from: number,
  hardEnd: number
): Array<string> {
  const at = text.indexOf('AppliedAlterations', from)

  if (at < 0 || at >= hardEnd) {
    return []
  }

  let end = hardEnd

  for (const marker of PERK_STOP_MARKERS) {
    const stop = text.indexOf(marker, at + 'AppliedAlterations'.length)

    if (stop > 0 && stop < end) end = stop
  }

  const alterations: Array<string> = []
  const entryPattern = /AID_[A-Za-z0-9_]+\.(AID_[A-Za-z0-9_]+)/g
  const window = text.slice(at, end)
  let entry: RegExpExecArray | null

  while ((entry = entryPattern.exec(window)) !== null) {
    alterations.push(entry[1].toLowerCase())
  }

  return alterations
}

/**
 * `OriginalTrapLevel` is an IntProperty holding the trap's power level
 * (40, 50, 60 …). Layout after the name: "IntProperty", int64 size, one
 * padding byte, int32 value.
 */
function readTrapLevel(
  buffer: Buffer,
  text: string,
  from: number,
  window: number
): number | null {
  const at = text.indexOf('OriginalTrapLevel', from)

  if (at < 0 || at > from + window) {
    return null
  }

  const name = readGvasString(buffer, at - 4)
  const type = readGvasString(buffer, name.next)
  const valueOffset = type.next + 9

  if (valueOffset + 4 > buffer.length) {
    return null
  }

  const level = buffer.readInt32LE(valueOffset)

  return level > 0 && level < 1000 ? level : null
}

type TrapGroup = {
  category: OutpostTrapCategory
  count: number
  displayName: string
  iconKey?: string
  level: number | null
  perks: Map<string, number>
  rarity: string | null
  templateId: string | null
  tier: number | null
}

function parseSav(raw: Buffer): {
  layout: OutpostLayout | null
  perks: Array<OutpostPerkTally>
  structures: OutpostStructures
  trapItems: Array<OutpostTrapInstanceTally>
  traps: Array<OutpostTrap>
} {
  const magic = raw.subarray(0, 4).toString('ascii')

  if (magic !== 'ECFD') {
    throw new Error(`Unknown .sav format: ${magic}`)
  }

  const buffer = zlib.inflateSync(new Uint8Array(raw.subarray(16)))
  const text = buffer.toString('latin1')

  const structures: OutpostStructures = {
    cones: 0,
    floors: 0,
    other: 0,
    stairs: 0,
    total: 0,
    walls: 0,
    materials: { metal: 0, stone: 0, wood: 0 },
    tiers: { tier1: 0, tier2: 0, tier3: 0 },
  }

  const structureLayout: Array<[number, number, number, number, number]> = []
  const trapLayout: Array<[number, number, number]> = []
  const bounds = {
    maxX: -Infinity,
    maxY: -Infinity,
    minX: Infinity,
    minY: Infinity,
  }

  const track = (x: number, y: number) => {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxY = Math.max(bounds.maxY, y)
  }

  /**
   * Cell units with sub-tile precision — walls sit on half-cell grid lines,
   * so rounding to whole cells would collapse them onto the floors.
   */
  const cellUnits = (value: number) =>
    Math.round((value / GRID_CELL) * 100) / 100

  /**
   * Structures — one record per placed PlayerBuilding actor. The class name
   * encodes material (W/S/M), upgrade tier (1–3) and piece type; the actor's
   * transform gives its tile. Counting instances (not blueprint-path string
   * hits, which repeat) is what makes the material totals equal `total`.
   */
  // eslint-disable-next-line no-control-regex
  const buildPattern = /\/Game\/Building\/ActorBlueprints\/Player\/[^/]+\/[^/]+\/PBWA_([A-Z])(\d)_([A-Za-z0-9_]+?)\.PBWA_/g
  const pieces: Record<string, number> = {}
  let match: RegExpExecArray | null

  while ((match = buildPattern.exec(text)) !== null) {
    const blueprintStart = text.lastIndexOf('/Game/Building', match.index)
    const blueprint = readGvasString(buffer, blueprintStart - 4)
    const transform = readActorTransform(buffer, blueprint.next)

    if (!transform) continue

    const [, materialCode, tierDigit, pieceType] = match

    pieces[pieceType] = (pieces[pieceType] ?? 0) + 1
    structures.total += 1

    const material = MATERIAL_MAP[materialCode]

    if (material) structures.materials[material] += 1

    if (tierDigit === '1') structures.tiers.tier1 += 1
    else if (tierDigit === '2') structures.tiers.tier2 += 1
    else if (tierDigit === '3') structures.tiers.tier3 += 1

    const cellX = cellUnits(transform.x)
    const cellY = cellUnits(transform.y)

    track(cellX, cellY)
    structureLayout.push([
      cellX,
      cellY,
      MATERIAL_LAYOUT_CODE[materialCode] ?? 3,
      pieceKindCode(pieceType),
      transform.yawQuadrant,
    ])
  }

  for (const [type, count] of Object.entries(pieces)) {
    if (PIECE_TYPES.walls.includes(type)) structures.walls += count
    else if (PIECE_TYPES.floors.includes(type)) structures.floors += count
    else if (PIECE_TYPES.stairs.includes(type)) structures.stairs += count
    else if (PIECE_TYPES.cones.includes(type)) structures.cones += count
  }

  /**
   * Everything the four plain categories missed — doors, windows, arches,
   * roof corners and other edited variants. Previously these were silently
   * dropped, which is why the material totals didn't add up to `total`.
   */
  structures.other =
    structures.total -
    (structures.walls +
      structures.floors +
      structures.stairs +
      structures.cones)

  /**
   * Traps — one record per placed trap actor, carrying its item definition
   * (rarity + tier), power level and applied perks. Grouped by display name.
   */
  const groups = new Map<string, TrapGroup>()
  const globalPerks = new Map<string, number>()
  /** Unique (trap item, level) → placed count, for power-level stats. */
  const instanceTallies = new Map<string, OutpostTrapInstanceTally>()

  const trapPattern = /\/SaveTheWorld\/Items\/Traps\/Blueprints\/Trap_([A-Za-z0-9_]+)\.Trap_[A-Za-z0-9_]+_C/g
  const trapMatches = [...text.matchAll(trapPattern)]

  for (let trapIndex = 0; trapIndex < trapMatches.length; trapIndex += 1) {
    match = trapMatches[trapIndex] as RegExpExecArray
    /** The next trap's record bounds this one's property scan. */
    const recordEnd = Math.min(
      trapIndex + 1 < trapMatches.length
        ? trapMatches[trapIndex + 1].index
        : text.length,
      match.index + 8000
    )
    const blueprintName = match[1]
    const lower = blueprintName.toLowerCase()
    const displayName =
      TRAP_NAMES_LOWER.get(lower) ?? blueprintName.replace(/_/g, ' ')

    const blueprintStart = text.lastIndexOf('/SaveTheWorld', match.index)
    const blueprint = readGvasString(buffer, blueprintStart - 4)
    const transform = readActorTransform(buffer, blueprint.next)

    const category = trapCategory(blueprintName)
    const tid = text
      .slice(match.index, match.index + 400)
      .match(/TID_[A-Za-z0-9_]+_(c|uc|r|vr|sr|ur)_T(\d\d)/i)
    const templateId = tid ? `Trap:${tid[0].toLowerCase()}` : null
    const level = readTrapLevel(buffer, text, match.index, 2500)
    const perks = readAppliedAlterations(text, match.index, recordEnd)

    let group = groups.get(displayName)

    if (!group) {
      group = {
        category,
        count: 0,
        displayName,
        iconKey: TRAP_ICONS_LOWER.get(lower),
        level: null,
        perks: new Map(),
        rarity: null,
        templateId: null,
        tier: null,
      }
      groups.set(displayName, group)
    }

    group.count += 1

    if (tid && templateId) {
      const tier = Number(tid[2])

      if (tier >= (group.tier ?? 0)) {
        group.rarity = tid[1].toLowerCase()
        group.templateId = templateId
        group.tier = tier
      }
    }

    if (level !== null) {
      group.level = Math.max(group.level ?? 0, level)
    }

    if (templateId && level !== null) {
      const key = `${templateId}|${level}`
      const tally = instanceTallies.get(key)

      if (tally) tally.count += 1
      else instanceTallies.set(key, { count: 1, level, templateId })
    }

    for (const perk of perks) {
      const perkTemplateId = `Alteration:${perk}`

      group.perks.set(
        perkTemplateId,
        (group.perks.get(perkTemplateId) ?? 0) + 1
      )
      globalPerks.set(
        perkTemplateId,
        (globalPerks.get(perkTemplateId) ?? 0) + 1
      )
    }

    if (transform) {
      const cellX = cellUnits(transform.x)
      const cellY = cellUnits(transform.y)

      track(cellX, cellY)
      trapLayout.push([cellX, cellY, TRAP_LAYOUT_CODE[category]])
    }
  }

  const traps: Array<OutpostTrap> = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .map((group) => ({
      category: group.category,
      count: group.count,
      displayName: group.displayName,
      iconKey: group.iconKey,
      level: group.level,
      perks: [...group.perks.entries()]
        .map(([templateId, count]) => ({ count, templateId }))
        .sort((a, b) => b.count - a.count),
      rarity: group.rarity,
      templateId: group.templateId,
      tier: group.tier,
    }))

  const perks: Array<OutpostPerkTally> = [...globalPerks.entries()]
    .map(([templateId, count]) => ({ count, templateId }))
    .sort((a, b) => b.count - a.count)

  const trapItems = [...instanceTallies.values()]

  const layout: OutpostLayout | null =
    structureLayout.length > 0 || trapLayout.length > 0
      ? {
          bounds: {
            maxX: Math.ceil(bounds.maxX),
            maxY: Math.ceil(bounds.maxY),
            minX: Math.floor(bounds.minX),
            minY: Math.floor(bounds.minY),
          },
          cell: GRID_CELL,
          structures: structureLayout,
          traps: trapLayout,
        }
      : null

  return { layout, perks, structures, trapItems, traps }
}

// ── Public API ───────────────────────────────────────────────

export class Outpost {
  /**
   * Zone overview for the given account: level, best endurance wave,
   * amplifier count, edit permissions (resolved to display names) and the
   * cloud save filename each zone's base is stored under.
   */
  static async requestInfo(account: AccountData): Promise<OutpostInfoResult> {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return { error: 'Could not authenticate this account', success: false, zones: [] }
      }

      /**
       * The metadata profile carries the shield state; the campaign profile
       * carries the defense quest ledger. The latter is a bonus — if it
       * fails, the page still renders without the defense dates.
       */
      const [metadataResult, campaignResult] = await Promise.allSettled([
        getQueryProfileMetadata({
          accessToken,
          accountId: account.accountId,
        }),
        getQueryProfile({
          accessToken,
          accountId: account.accountId,
        }),
      ])

      if (metadataResult.status === 'rejected') {
        throw metadataResult.reason
      }

      const defenseHistory = Outpost.parseDefenseHistory(
        campaignResult.status === 'fulfilled'
          ? campaignResult.value.data
          : null
      )

      const profile = metadataResult.value.data?.profileChanges?.[0]?.profile

      if (!profile) {
        return { error: 'Failed to read the metadata profile', success: false, zones: [] }
      }

      const items = profile.items ?? {}
      const allPermissionIds = new Set<string>()
      const zoneData = new Map<
        string,
        {
          amplifiers: number
          amplifierSlots: Array<string>
          lastSavedAt: string | null
          level: number
          permissions: Array<string>
          saveCount: number
          saveFile: string
          wave: number
        }
      >()

      for (const item of Object.values(items)) {
        const templateId: string = item?.templateId ?? ''
        const match = templateId.match(/^Outpost:(.+)$/)

        if (!match || !ZONE_MAP[match[1]]) continue

        const zoneKey = match[1]
        const attributes = item.attributes ?? {}
        const coreInfo = attributes.outpost_core_info ?? {}
        const cloudInfo = attributes.cloud_save_info ?? {}
        const records = cloudInfo.savedRecords ?? []
        const permissions: Array<string> =
          coreInfo.accountsWithEditPermission ?? []

        for (const permissionId of permissions) {
          allPermissionIds.add(permissionId)
        }

        const placedBuildings: Array<{ buildingTag?: string }> =
          coreInfo.placedBuildings ?? []
        /**
         * Building tags are undocumented gameplay-tag paths; the last
         * dotted/slashed segment is the only human-readable part.
         */
        const amplifierSlots = placedBuildings
          .map((building) => {
            const tag =
              typeof building?.buildingTag === 'string'
                ? building.buildingTag
                : ''

            return tag.split(/[./]/).filter(Boolean).pop() ?? ''
          })
          .filter(Boolean)

        zoneData.set(zoneKey, {
          amplifiers: placedBuildings.length,
          amplifierSlots,
          lastSavedAt:
            records.length > 0 ? (records[0].lastModified ?? null) : null,
          level: attributes.level ?? 0,
          permissions,
          saveCount: cloudInfo.saveCount ?? 0,
          saveFile:
            records.length > 0 ? (records[0].recordFilename ?? '') : '',
          wave: coreInfo.highestEnduranceWaveReached ?? 0,
        })
      }

      const names = await Outpost.resolveAccountNames(
        accessToken,
        [...allPermissionIds]
      )

      const zones: Array<OutpostZoneInfo> = ZONE_ORDER.map((zoneKey) => {
        const data = zoneData.get(zoneKey)
        const zoneId = zoneKey.replace('outpostcore_', '')

        return {
          amplifierCount: data?.amplifiers ?? 0,
          amplifierSlots: data?.amplifierSlots ?? [],
          defenses: defenseHistory.get(zoneId) ?? [],
          editPermissions: (data?.permissions ?? []).map((accountId) => ({
            accountId,
            displayName: names.get(accountId) ?? accountId,
          })),
          highestEnduranceWave: data?.wave ?? 0,
          lastSavedAt: data?.lastSavedAt ?? null,
          level: data?.level ?? 0,
          saveCount: data?.saveCount ?? 0,
          saveFile: data?.saveFile ?? '',
          zoneId,
          zoneName: ZONE_MAP[zoneKey],
        }
      })

      return { success: true, zones }
    } catch (error) {
      RuntimeLog.error('caught:core/outpost.ts', error)

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load outpost information',
        success: false,
        zones: [],
      }
    }
  }

  /**
   * Download and parse a zone's Storm Shield save file from user cloud
   * storage, counting placed structures and every trap in the base.
   */
  static async requestBaseData(
    account: AccountData,
    saveFile: string
  ): Promise<OutpostBaseData> {
    const empty = {
      layout: null as OutpostLayout | null,
      perks: [] as Array<OutpostPerkTally>,
      saveSizeBytes: 0,
      trapItems: [] as Array<OutpostTrapInstanceTally>,
      structures: {
        cones: 0,
        floors: 0,
        other: 0,
        stairs: 0,
        total: 0,
        walls: 0,
        materials: { metal: 0, stone: 0, wood: 0 },
        tiers: { tier1: 0, tier2: 0, tier3: 0 },
      },
      totalTraps: 0,
      traps: [] as Array<OutpostTrap>,
    }

    try {
      if (!saveFile) {
        return { ...empty, error: 'No save file available for this zone', success: false }
      }

      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return { ...empty, error: 'Could not authenticate this account', success: false }
      }

      const response = await axios.get(
        `${CLOUD_STORAGE_USER}/${account.accountId}/${saveFile}`,
        {
          headers: {
            Authorization: `bearer ${accessToken}`,
          },
          // .sav backups can be large; the stream is fully buffered anyway.
          responseType: 'arraybuffer',
          timeout: 60_000,
        }
      )

      let buffer = Buffer.from(response.data)
      const saveSizeBytes = buffer.length

      if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
        buffer = zlib.gunzipSync(new Uint8Array(buffer))
      }

      try {
        const { layout, perks, structures, trapItems, traps } =
          parseSav(buffer)

        return {
          layout,
          perks,
          saveSizeBytes,
          structures,
          trapItems,
          success: true,
          totalTraps: traps.reduce((total, trap) => total + trap.count, 0),
          traps,
        }
      } catch {
        /**
         * Unparseable data usually means an empty Storm Shield — the zone
         * has never been set up or has no structures to record.
         */
        return {
          ...empty,
          saveSizeBytes,
          success: true,
          warning:
            'No structure data recorded — this Storm Shield may not be set up yet.',
        }
      }
    } catch (error) {
      RuntimeLog.error('caught:core/outpost.ts', error)

      let message =
        error instanceof Error ? error.message : 'Failed to load the base'

      const responseData = (error as { response?: { data?: unknown } })
        ?.response?.data

      if (responseData) {
        try {
          const text =
            Buffer.from(responseData as ArrayBuffer).toString('utf8')
          message = JSON.parse(text).errorMessage ?? message
        } catch {
          // Keep the original message.
        }
      }

      return { ...empty, error: message, success: false }
    }
  }

  /**
   * Storm Shield Defenses live in the campaign profile as quest items —
   * `Quest:outpostquest_t3_l7` is Canny Valley, defense 7 — and a claimed
   * quest's state-change time is the moment that defense was beaten.
   */
  private static parseDefenseHistory(
    profile: MCPQueryProfile | null
  ): Map<string, Array<OutpostDefenseRecord>> {
    const defenses = new Map<string, Array<OutpostDefenseRecord>>()
    const items = profile?.profileChanges?.[0]?.profile?.items ?? {}

    for (const item of Object.values(items)) {
      const match = (item?.templateId ?? '').match(
        /^Quest:outpostquest_t(\d)_l(\d+)$/i
      )

      if (!match) continue

      const attributes = (item.attributes ?? {}) as {
        last_state_change_time?: string
        quest_state?: string
      }

      if (
        attributes.quest_state !== 'Claimed' &&
        attributes.quest_state !== 'Completed'
      ) {
        continue
      }

      const zoneId = `pve_0${match[1]}`
      const list = defenses.get(zoneId) ?? []

      list.push({
        completedAt: attributes.last_state_change_time ?? '',
        defense: Number(match[2]),
      })
      defenses.set(zoneId, list)
    }

    for (const list of defenses.values()) {
      list.sort((a, b) => a.defense - b.defense)
    }

    return defenses
  }

  private static async resolveAccountNames(
    accessToken: string,
    accountIds: Array<string>
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>()

    if (accountIds.length === 0) {
      return names
    }

    for (let index = 0; index < accountIds.length; index += 100) {
      try {
        const response = await findUsersByAccountIds({
          accessToken,
          accountIds: accountIds.slice(index, index + 100),
        })

        for (const entry of response.data) {
          if (entry.id && entry.displayName) {
            names.set(entry.id, entry.displayName)
          }
        }
      } catch {
        // Names stay as raw account ids.
      }
    }

    return names
  }
}
