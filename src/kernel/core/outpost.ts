import type {
  OutpostBaseData,
  OutpostInfoResult,
  OutpostTrap,
  OutpostStructures,
  OutpostZoneInfo,
} from './outpost-types'
import type { AccountData } from '../../types/accounts'

import axios from 'axios'
import { Buffer } from 'node:buffer'
import * as zlib from 'node:zlib'

import { RuntimeLog } from '../runtime-log'

import { Authentication } from './authentication'

import { getQueryProfileMetadata } from '../../services/endpoints/mcp'
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

const PIECE_TYPES: Record<string, Array<string>> = {
  walls: ['Solid'],
  floors: ['Floor', 'Floor_2'],
  stairs: ['StairW', 'StairF', 'StairT', 'StairR', 'StairSpiral'],
  cones: ['RoofC'],
}

// ── .sav parsing ─────────────────────────────────────────────

function parseSav(raw: Buffer): {
  structures: OutpostStructures
  traps: Array<OutpostTrap>
} {
  const magic = raw.subarray(0, 4).toString('ascii')

  if (magic !== 'ECFD') {
    throw new Error(`Unknown .sav format: ${magic}`)
  }

  const decompressed = zlib
    .inflateSync(new Uint8Array(raw.subarray(16)))
    .toString('latin1')

  // Structures — PlayerBuilding actor class names, e.g. PBWA_W1_Solid.
  // eslint-disable-next-line no-control-regex
  const buildPattern = /\/Game\/Building\/ActorBlueprints\/Player\/[^/]+\/[^/]+\/PBWA_[A-Z]\d_([^._\s\x00]+)/g
  const pieces: Record<string, number> = {}
  let match: RegExpExecArray | null

  while ((match = buildPattern.exec(decompressed)) !== null) {
    pieces[match[1]] = (pieces[match[1]] ?? 0) + 1
  }

  const structures: OutpostStructures = {
    cones: 0,
    floors: 0,
    stairs: 0,
    total: 0,
    walls: 0,
  }

  for (const [type, count] of Object.entries(pieces)) {
    if (PIECE_TYPES.walls.includes(type)) structures.walls += count
    else if (PIECE_TYPES.floors.includes(type)) structures.floors += count
    else if (PIECE_TYPES.stairs.includes(type)) structures.stairs += count
    else if (PIECE_TYPES.cones.includes(type)) structures.cones += count
  }

  structures.total =
    structures.walls + structures.floors + structures.stairs + structures.cones

  // Traps — SaveTheWorld trap blueprint names, merged by display name.
  // eslint-disable-next-line no-control-regex
  const trapPattern = /\/SaveTheWorld\/Items\/Traps\/Blueprints\/Trap_([^.\s\x00]+)/g
  const trapCounts: Record<string, number> = {}

  while ((match = trapPattern.exec(decompressed)) !== null) {
    trapCounts[match[1]] = (trapCounts[match[1]] ?? 0) + 1
  }

  const merged: Record<string, { count: number; name: string }> = {}

  for (const [blueprint, count] of Object.entries(trapCounts)) {
    const name = TRAP_NAMES[blueprint] ?? blueprint.replace(/_/g, ' ')

    merged[name] = {
      count: (merged[name]?.count ?? 0) + count,
      name,
    }
  }

  const traps = Object.values(merged)
    .sort((a, b) => b.count - a.count)
    .map(({ count, name }) => ({ count, displayName: name }))

  return { structures, traps }
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

      const response = await getQueryProfileMetadata({
        accessToken,
        accountId: account.accountId,
      })

      const profile = response.data?.profileChanges?.[0]?.profile

      if (!profile) {
        return { error: 'Failed to read the metadata profile', success: false, zones: [] }
      }

      const items = profile.items ?? {}
      const allPermissionIds = new Set<string>()
      const zoneData = new Map<
        string,
        {
          amplifiers: number
          level: number
          permissions: Array<string>
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

        zoneData.set(zoneKey, {
          amplifiers: (coreInfo.placedBuildings ?? []).length,
          level: attributes.level ?? 0,
          permissions,
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

        return {
          amplifierCount: data?.amplifiers ?? 0,
          editPermissions: (data?.permissions ?? []).map((accountId) => ({
            accountId,
            displayName: names.get(accountId) ?? accountId,
          })),
          highestEnduranceWave: data?.wave ?? 0,
          level: data?.level ?? 0,
          saveFile: data?.saveFile ?? '',
          zoneId: zoneKey.replace('outpostcore_', ''),
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
      structures: { cones: 0, floors: 0, stairs: 0, total: 0, walls: 0 },
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

      if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
        buffer = zlib.gunzipSync(new Uint8Array(buffer))
      }

      try {
        const { structures, traps } = parseSav(buffer)

        return {
          structures,
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
