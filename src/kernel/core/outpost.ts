import type {
  OutpostBaseData,
  OutpostDefenseRecord,
  OutpostInfoResult,
  OutpostLayout,
  OutpostPerkTally,
  OutpostReportExportResult,
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
import { writeFile } from 'node:fs/promises'
import * as zlib from 'node:zlib'
import { dialog } from 'electron'

import { RuntimeLog } from '../runtime-log'

import { Authentication } from './authentication'
import {
  readableOutpostFileName,
  serializeReadableOutpostReport,
} from './outpost-report'

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
  if (pieceType.startsWith('Stair')) return 2
  if (pieceType.startsWith('Roof')) return 3
  if (/^(?:Solid|.*Wall|Door|Window|Arch|Brace)/i.test(pieceType)) return 1
  if (/^(?:Floor|Balcony)/i.test(pieceType)) return 0

  return 4
}

/**
 * World actors recorded in the save, by class name and folder — kept in sync
 * with `OutpostLayout.props`. 0 tree, 1 rock, 2 container/plant, 3 world
 * structure, 4 other.
 */
export function propKindCode(path: string, className: string): number {
  const lower = className.toLowerCase()

  if (/(?:^|_)(?:tree|pine|palm|joshuatree|cactus)(?!_log)/.test(lower)) {
    return 0
  }
  if (/rock|boulder|stone|resourcevein|cliff|shelf|ore/.test(lower)) return 1
  if (
    path.includes('/Containers/') ||
    /shrub|plant|bush|crate|cart|barrel|chest|box|tiered_short/.test(lower)
  ) {
    return 2
  }
  if (
    /\/(?:Wall|Floor|Stairs|Roof)\//.test(path) ||
    /fence|pole|tower|_solid|door|_floor|stair|archway|balcony|wall/.test(lower)
  ) {
    return 3
  }

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
 * The actor transform sits immediately after the blueprint path string.
 * FortActorRecord commonly stores a three-value compressed rotation followed
 * by translation and scale; a few generations use a full four-value FQuat.
 * Scalars may be 4-byte floats or 8-byte doubles. The transform is followed
 * by `bSpawnedActor` and the ActorData byte count, which are also validated so
 * an asset reference elsewhere in a property cannot masquerade as an actor.
 */
type ActorTransform = {
  /** End of this actor's serialized property bytes. */
  actorDataEnd: number
  /** `EFortBuildingPersistentState`; 3 means the actor was destroyed. */
  actorState: number
  /** Uniform scale from the FTransform's Scale3D (|X|); 1 when absent. */
  scale: number
  /** True when the game must spawn this actor rather than find it in the map. */
  spawned: boolean
  x: number
  y: number
  yawDegrees: number
  yawQuadrant: number
  z: number
}

function readActorTransform(
  buffer: Buffer,
  blueprintStart: number,
  afterBlueprint: number
): ActorTransform | null {
  const attempt = (
    rotationWords: 3 | 4,
    wordBytes: number,
    read: (offset: number) => number
  ): ActorTransform | null => {
    const scalarWords = rotationWords + 6
    const spawnedOffset = afterBlueprint + wordBytes * scalarWords
    const actorDataSizeOffset = spawnedOffset + 4

    if (
      blueprintStart < 5 ||
      actorDataSizeOffset + 4 > buffer.length
    ) {
      return null
    }

    const rotation = Array.from({ length: rotationWords }, (_, index) =>
      read(afterBlueprint + wordBytes * index)
    )
    const x = read(afterBlueprint + wordBytes * rotationWords)
    const y = read(afterBlueprint + wordBytes * (rotationWords + 1))
    const z = read(afterBlueprint + wordBytes * (rotationWords + 2))

    const norm = Math.sqrt(
      rotation.reduce((total, value) => total + value * value, 0)
    )

    if (!Number.isFinite(norm) || Math.abs(norm - 1) > 0.05) {
      return null
    }

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z) ||
      Math.abs(x) > 1_000_000 ||
      Math.abs(y) > 1_000_000 ||
      Math.abs(z) > 1_000_000
    ) {
      return null
    }

    const spawned = buffer.readUInt32LE(spawnedOffset)
    const actorDataSize = buffer.readUInt32LE(actorDataSizeOffset)
    const actorDataEnd = actorDataSizeOffset + 4 + actorDataSize
    const actorState = buffer.readUInt8(blueprintStart - 5)

    if (
      spawned > 1 ||
      actorState > 5 ||
      actorDataEnd > buffer.length
    ) {
      return null
    }

    let yaw: number

    if (rotationWords === 3) {
      /**
       * FortActorRecord uses FVector_NetQuantizeNormal for rotation in these
       * saves: the last two components are sin/cos of half the upright yaw.
       */
      yaw = (2 * Math.atan2(rotation[1], rotation[2]) * 180) / Math.PI
    } else {
      const [qx, qy, qz, qw] = rotation

      yaw =
        (Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) *
          180) /
        Math.PI
    }

    /**
     * Scale3D follows the translation. Build pieces are always 1; world
     * props vary (and mirrored pieces go negative, hence the |X|).
     */
    let scale = 1

    if (spawnedOffset <= buffer.length) {
      const scaleX = Math.abs(
        read(afterBlueprint + wordBytes * (rotationWords + 3))
      )

      if (Number.isFinite(scaleX) && scaleX > 0.05 && scaleX < 20) {
        scale = Math.round(scaleX * 100) / 100
      }
    }

    return {
      actorDataEnd,
      actorState,
      scale,
      spawned: spawned === 1,
      x,
      y,
      yawDegrees: Math.round(yaw * 10) / 10,
      yawQuadrant: ((Math.round(yaw / 90) % 4) + 4) % 4,
      z,
    }
  }

  return (
    attempt(3, 4, (offset) => buffer.readFloatLE(offset)) ??
    attempt(4, 4, (offset) => buffer.readFloatLE(offset)) ??
    attempt(3, 8, (offset) => buffer.readDoubleLE(offset)) ??
    attempt(4, 8, (offset) => buffer.readDoubleLE(offset))
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

export function parseSav(raw: Buffer): {
  layout: OutpostLayout | null
  perks: Array<OutpostPerkTally>
  structures: OutpostStructures
  trapItems: Array<OutpostTrapInstanceTally>
  traps: Array<OutpostTrap>
} {
  const magic = raw.subarray(0, 4).toString('ascii')

  /**
   * Two container generations: current records are ECFD-wrapped zlib;
   * pre-ECFD records (up to ~Fortnite 15.x) are the same GVAS property
   * stream stored uncompressed, and old zones keep such records in cloud
   * storage forever. The markers identify the latter — the actor stream is
   * plain text in the raw bytes.
   */
  let buffer: Buffer

  if (magic === 'ECFD') {
    buffer = zlib.inflateSync(new Uint8Array(raw.subarray(16)))
  } else if (
    raw.includes('SavedActors') ||
    raw.includes('++Fortnite+Release')
  ) {
    buffer = raw
  } else {
    throw new Error(`Unknown .sav format: ${magic}`)
  }

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

  const structureLayout: OutpostLayout['structures'] = []
  const trapLayout: OutpostLayout['traps'] = []
  const propLayout: OutpostLayout['props'] = []
  /** Dot identity for the minimap — display names, deduped by index. */
  const layoutTrapNames: Array<string> = []
  const layoutTrapNameIndex = new Map<string, number>()
  const layoutShapes: Array<string> = []
  const layoutShapeIndex = new Map<string, number>()
  const layoutPropNames: Array<string> = []
  const layoutPropNameIndex = new Map<string, number>()
  /** Intern a name into its list, returning its index. */
  const intern = (
    names: Array<string>,
    indexes: Map<string, number>,
    name: string
  ) => {
    let index = indexes.get(name)

    if (index === undefined) {
      index = names.length
      names.push(name)
      indexes.set(name, index)
    }

    return index
  }
  const bounds = {
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
  }

  const track = (x: number, y: number, z: number) => {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxY = Math.max(bounds.maxY, y)
    bounds.minZ = Math.min(bounds.minZ, z)
    bounds.maxZ = Math.max(bounds.maxZ, z)
  }

  /**
   * Cell units with sub-tile precision — walls sit on half-cell grid lines,
   * so rounding to whole cells would collapse them onto the floors.
   */
  const cellUnits = (value: number) =>
    Math.round((value / GRID_CELL) * 10_000) / 10_000

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
    const transform = readActorTransform(
      buffer,
      blueprintStart,
      blueprint.next
    )

    if (!transform) continue

    /**
     * The save also records pre-built map actors that use PBWA classes. The
     * game finds those in the level instead of spawning them, and some no
     * longer exist in the currently shipped map. Only spawned, non-destroyed
     * PBWA actors are player-built pieces that the game will load into the
     * base. Reading the record field avoids guessing from nearby property
     * names and crossing into the next actor.
     */
    if (!transform.spawned || transform.actorState === 3) {
      continue
    }

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
    const cellZ = cellUnits(transform.z)

    track(cellX, cellY, cellZ)
    structureLayout.push([
      cellX,
      cellY,
      cellZ,
      MATERIAL_LAYOUT_CODE[materialCode] ?? 3,
      pieceKindCode(pieceType),
      transform.yawQuadrant,
      intern(layoutShapes, layoutShapeIndex, pieceType),
      Number(tierDigit) || 0,
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

  /** Old saves keep traps under `/Game/Items/`, new ones `/SaveTheWorld/Items/`. */
  const trapPattern = /\/(?:SaveTheWorld|Game)\/Items\/Traps\/Blueprints\/Trap_([A-Za-z0-9_]+)\.Trap_[A-Za-z0-9_]+_C/g
  const trapMatches = [...text.matchAll(trapPattern)]

  for (let trapIndex = 0; trapIndex < trapMatches.length; trapIndex += 1) {
    match = trapMatches[trapIndex] as RegExpExecArray
    /** The next trap's record bounds this one's property scan. */
    const fallbackRecordEnd = Math.min(
      trapIndex + 1 < trapMatches.length
        ? trapMatches[trapIndex + 1].index
        : text.length,
      match.index + 8000
    )
    const blueprintName = match[1]
    const lower = blueprintName.toLowerCase()
    const displayName =
      TRAP_NAMES_LOWER.get(lower) ?? blueprintName.replace(/_/g, ' ')

    /* The regex match starts exactly at the blueprint path string. */
    const blueprint = readGvasString(buffer, match.index - 4)
    const transform = readActorTransform(buffer, match.index, blueprint.next)

    if (transform && (!transform.spawned || transform.actorState === 3)) {
      continue
    }

    const recordEnd = transform?.actorDataEnd ?? fallbackRecordEnd

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
      const cellZ = cellUnits(transform.z)

      track(cellX, cellY, cellZ)
      trapLayout.push([
        cellX,
        cellY,
        cellZ,
        TRAP_LAYOUT_CODE[category],
        intern(layoutTrapNames, layoutTrapNameIndex, displayName),
        transform.yawQuadrant,
      ])
    }
  }

  /**
   * World actors — everything else the save tracks with a transform: the
   * zone's trees, rocks, loot containers and pre-built structures. They are
   * matched by class path outside the player folder; the path must read
   * back as a standalone FString so that a mention inside some other
   * property (texture data, loot keys) is not mistaken for an actor record.
   * They do not widen the build's bounds — a lone tree at the zone edge
   * would otherwise dwarf the base.
   */
  const propPattern =
    /\/Game\/(?:Building\/ActorBlueprints\/(?!Player\/)[A-Za-z0-9_/]+|Environments\/[A-Za-z0-9_/]+)\.([A-Za-z0-9_]+)_C/g

  while ((match = propPattern.exec(text)) !== null) {
    const blueprint = readGvasString(buffer, match.index - 4)

    if (blueprint.value !== match[0]) continue

    const transform = readActorTransform(buffer, match.index, blueprint.next)

    if (!transform || transform.actorState === 3) continue

    const className = match[1]

    propLayout.push([
      cellUnits(transform.x),
      cellUnits(transform.y),
      cellUnits(transform.z),
      propKindCode(match[0], className),
      transform.yawDegrees,
      transform.scale,
      intern(layoutPropNames, layoutPropNameIndex, className),
    ])
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
            maxZ: Math.ceil(bounds.maxZ),
            minX: Math.floor(bounds.minX),
            minY: Math.floor(bounds.minY),
            minZ: Math.floor(bounds.minZ),
          },
          cell: GRID_CELL,
          propNames: layoutPropNames,
          props: propLayout,
          shapes: layoutShapes,
          structures: structureLayout,
          trapNames: layoutTrapNames,
          traps: trapLayout,
        }
      : null

  return { layout, perks, structures, trapItems, traps }
}

// ── Public API ───────────────────────────────────────────────

export class Outpost {
  /** Save the parsed cloud backup as formatted, human-readable JSON. */
  static async exportReadableReport(
    displayName: string,
    zone: OutpostZoneInfo,
    baseData: OutpostBaseData
  ): Promise<OutpostReportExportResult> {
    try {
      const response = await dialog.showSaveDialog({
        defaultPath: readableOutpostFileName(zone.zoneName),
        filters: [{ extensions: ['json'], name: 'Readable outpost report' }],
      })

      if (response.canceled || !response.filePath) {
        return { status: 'cancelled' }
      }

      await writeFile(
        response.filePath,
        serializeReadableOutpostReport({ baseData, displayName, zone }),
        'utf8'
      )

      return { status: 'saved' }
    } catch (error) {
      RuntimeLog.error('caught:core/outpost.ts', error)

      return {
        error:
          error instanceof Error ? error.message : 'Failed to save the report',
        status: 'error',
      }
    }
  }

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

        /**
         * Epic keeps several rolling cloud records per zone and does not
         * promise an order. Take the newest by timestamp — the first entry
         * can be a years-old backup, and scanning that shows a historical
         * base full of pieces the player has long since replaced.
         */
        const newestRecord = records.reduce<
          { lastModified?: string; recordFilename?: string } | null
        >(
          (best, record) =>
            !best ||
            (record.lastModified ?? '') > (best.lastModified ?? '')
              ? record
              : best,
          null
        )

        zoneData.set(zoneKey, {
          amplifiers: placedBuildings.length,
          amplifierSlots,
          lastSavedAt: newestRecord?.lastModified ?? null,
          level: attributes.level ?? 0,
          permissions,
          saveCount: cloudInfo.saveCount ?? 0,
          saveFile: newestRecord?.recordFilename ?? '',
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
