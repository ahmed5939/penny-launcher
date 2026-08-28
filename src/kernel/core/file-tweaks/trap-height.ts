import type {
  BasePatchStatus,
  ModifiedTrap,
  TrapActionResult,
  TrapFamilyInfo,
  TrapHeightScaleEntry,
  TrapListItem,
  TrapNamedConfig,
  TrapPatchState,
  TrapStatus,
} from './trap-height-types'

import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import trapsJson from './traps.json'

import {
  asFsBuffer,
  findNeedle,
  resolvePakchunkPath,
} from './binary'

/**
 * Trap height modifier — patches the Z component of every trap blueprint's
 * GridPlacementOffset inside pakchunk11-WindowsClient.ucas.
 *
 * The height lives 13–24 bytes before the trap's ASCII GUID as the upper
 * two bytes of a little-endian float32 (the lower two are always 00 00).
 * Which offset applies differs per trap family, so traps.json carries the
 * per-family hint and a backwards scan double-checks it against the trap's
 * default height bytes.
 */

const CHUNK_FILE = 'pakchunk11-WindowsClient.ucas'
const FALLBACK_HEIGHT_OFFSET = 21
const SEARCH_RADIUS = 32

type RawTrap = {
  defaultHeight: string
  guid: string
  name: string
}

type RawFamily = {
  category: string
  defaultHeight: { hex: string; uu: number }
  desc: string
  heightOffset?: number
  heightSupported?: boolean
  insideFloor?: { hex: string; uu: number } | null
  traps: Array<RawTrap>
}

type TrapPatchFile = {
  base: {
    currentHeight: string
    originalHeight: string
    patternPos: number
  } | null
  patches: Record<string, TrapPatchState>
}

const RAW_FAMILIES = trapsJson.families as unknown as Record<string, RawFamily>
const RAW_HEIGHT_SCALE = trapsJson.heightScale as unknown as Record<
  string,
  { hex: string; uu: number }
>
const RAW_NAMED_CONFIGS = trapsJson.namedConfigs as unknown as Record<
  string,
  { hex: string; label: string; uu: number }
>

// ── Trap catalogue ───────────────────────────────────────────

const TRAP_LIST: Array<
  TrapListItem & { defaultHeightHex: string }
> = Object.entries(RAW_FAMILIES).flatMap(([familyKey, family]) =>
  family.traps.map((trap) => {
    const parsed = parseTrapName(trap.name)

    return {
      defaultHeight: trap.defaultHeight,
      defaultHeightHex: trap.defaultHeight,
      desc: family.desc,
      family: familyKey,
      guid: trap.guid,
      heightSupported: family.heightSupported ?? false,
      name: trap.name,
      rarity: parsed.rarity,
      tier: parsed.tier,
    }
  })
)

export function getTrapList(): Array<TrapListItem> {
  return TRAP_LIST.map((trap) => ({
    defaultHeight: trap.defaultHeight,
    desc: trap.desc,
    family: trap.family,
    guid: trap.guid,
    heightSupported: trap.heightSupported,
    name: trap.name,
    rarity: trap.rarity,
    tier: trap.tier,
  }))
}

export function getTrapFamilyInfo(): Record<string, TrapFamilyInfo> {
  const result: Record<string, TrapFamilyInfo> = {}

  for (const [key, family] of Object.entries(RAW_FAMILIES)) {
    result[family.desc] = {
      category: family.category,
      defaultHeight: family.defaultHeight,
      heightOffset: family.heightOffset ?? FALLBACK_HEIGHT_OFFSET,
      heightSupported: family.heightSupported ?? false,
      insideFloor: family.insideFloor ?? null,
      key,
    }
  }

  return result
}

export function getTrapHeightScale(): Array<TrapHeightScaleEntry> {
  return Object.entries(RAW_HEIGHT_SCALE).map(([blocks, data]) => ({
    blocks,
    hex: data.hex,
    uu: data.uu,
  }))
}

export function getTrapNamedConfigs(): Array<TrapNamedConfig> {
  return Object.entries(RAW_NAMED_CONFIGS).map(([key, config]) => ({
    hex: config.hex,
    key,
    label: config.label,
    uu: config.uu,
  }))
}

// ── Hex / float helpers ──────────────────────────────────────

function parseHex(hex: string): [number, number] {
  const parts = hex.trim().split(/\s+/)
  return [parseInt(parts[0], 16), parseInt(parts[1], 16)]
}

function parseTrapName(name: string): { rarity: string; tier: string } {
  const match = name.match(/_(C|UC|R|VR|SR)_(T\d+)$/)

  if (match) {
    return { rarity: match[1], tier: match[2] }
  }

  return { rarity: '-', tier: '-' }
}

function heightHexToFloat(hex: string): number {
  const [b2, b3] = parseHex(hex)
  const buf = Buffer.from([0, 0, b2, b3])
  return buf.readFloatLE(0)
}

function toHeightHex(bytes: Buffer): string {
  return `${bytes[0].toString(16).padStart(2, '0').toUpperCase()} ${bytes[1]
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()}`
}

// ── Patch-state persistence ──────────────────────────────────

function getStateFilePath(): string {
  return path.join(
    app.getPath('appData'),
    'penny-launcher-data',
    'file-tweaks-traps.json'
  )
}

function readStateFile(): TrapPatchFile {
  try {
    return JSON.parse(
      fs.readFileSync(getStateFilePath(), { encoding: 'utf8' })
    ) as TrapPatchFile
  } catch {
    return { base: null, patches: {} }
  }
}

function writeStateFile(state: TrapPatchFile): void {
  try {
    fs.writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2), {
      encoding: 'utf8',
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // Losing the patch bookkeeping only costs the revert shortcuts.
  }
}

// ── File scanning / patching ─────────────────────────────────

function readBytesAt(
  filePath: string,
  position: number,
  length: number
): Buffer {
  const fd = fs.openSync(filePath, 'r')

  try {
    const buf = Buffer.alloc(length)
    fs.readSync(fd, asFsBuffer(buf), 0, length, position)
    return buf
  } finally {
    fs.closeSync(fd)
  }
}

function patchBytes(
  filePath: string,
  position: number,
  b0: number,
  b1: number
): void {
  const fd = fs.openSync(filePath, 'r+')

  try {
    fs.writeSync(fd, asFsBuffer(Buffer.from([b0, b1])), 0, 2, position)
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * Decide where the height bytes sit relative to the GUID. The per-family
 * offset from traps.json is the primary hint; when the default height bytes
 * are distinctive they are searched backwards from the GUID as a fallback.
 */
function discoverHeightOffset(
  filePath: string,
  guidPos: number,
  defaultHeight: string,
  familyOffset: number
): number {
  const before = readBytesAt(filePath, guidPos - SEARCH_RADIUS, SEARCH_RADIUS)

  if (defaultHeight === '00 00') {
    return familyOffset
  }

  const [h0, h1] = parseHex(defaultHeight)
  const expectedIndex = SEARCH_RADIUS - familyOffset

  if (expectedIndex >= 0 && expectedIndex + 1 < SEARCH_RADIUS) {
    if (before[expectedIndex] === h0 && before[expectedIndex + 1] === h1) {
      return familyOffset
    }
  }

  for (let i = SEARCH_RADIUS - 2; i >= 0; i--) {
    if (before[i] === h0 && before[i + 1] === h1) {
      return SEARCH_RADIUS - i
    }
  }

  return familyOffset
}

async function resolveTrapFile(): Promise<string | null> {
  return resolvePakchunkPath(CHUNK_FILE)
}

// ── Public API ───────────────────────────────────────────────

export async function getTrapStatus(guid: string): Promise<TrapStatus> {
  const filePath = await resolveTrapFile()

  if (!filePath) {
    return {
      currentHeight: null,
      error: `${CHUNK_FILE} not found — check the game path in Settings`,
      found: false,
      isModified: false,
    }
  }

  const trap = TRAP_LIST.find((item) => item.guid === guid)

  if (!trap) {
    return {
      currentHeight: null,
      error: 'Unknown trap GUID',
      found: false,
      isModified: false,
    }
  }

  const state = readStateFile()
  const patch = state.patches[guid]

  if (patch) {
    try {
      const currentHex = toHeightHex(
        readBytesAt(filePath, patch.guidFilePos - patch.heightOffset, 2)
      )

      return {
        currentHeight: currentHex,
        found: true,
        isModified: currentHex !== patch.originalHeight,
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Stale bookkeeping — fall through to a fresh scan.
    }
  }

  try {
    const guidPos = await findNeedle(filePath, Buffer.from(guid, 'ascii'))

    if (guidPos < 0) {
      return {
        currentHeight: null,
        error:
          'GUID not found in the file — trap data may live in a compressed block',
        found: false,
        isModified: false,
      }
    }

    const family = RAW_FAMILIES[trap.family]
    const offset = discoverHeightOffset(
      filePath,
      guidPos,
      trap.defaultHeightHex,
      family?.heightOffset ?? FALLBACK_HEIGHT_OFFSET
    )

    const currentHex = toHeightHex(readBytesAt(filePath, guidPos - offset, 2))

    state.patches[guid] = {
      currentHeight: currentHex,
      guidFilePos: guidPos,
      heightOffset: offset,
      originalHeight: currentHex,
      trapName: trap.name,
    }
    writeStateFile(state)

    return {
      currentHeight: currentHex,
      found: true,
      isModified: false,
    }
  } catch (error) {
    return {
      currentHeight: null,
      error: error instanceof Error ? error.message : 'Scan failed',
      found: false,
      isModified: false,
    }
  }
}

export async function applyTrapHeight(
  guid: string,
  newHeight: string
): Promise<TrapActionResult> {
  const filePath = await resolveTrapFile()

  if (!filePath) {
    return {
      message: `${CHUNK_FILE} not found. Check the game path in Settings.`,
      success: false,
    }
  }

  const trap = TRAP_LIST.find((item) => item.guid === guid)

  if (!trap) {
    return { message: 'Unknown trap GUID.', success: false }
  }

  const family = RAW_FAMILIES[trap.family]

  if (family && family.heightSupported === false) {
    return {
      message: `${trap.desc} has no modifiable height offset.`,
      success: false,
    }
  }

  const state = readStateFile()
  let patch = state.patches[guid]

  try {
    if (!patch) {
      const guidPos = await findNeedle(filePath, Buffer.from(guid, 'ascii'))

      if (guidPos < 0) {
        return {
          message:
            'GUID not found in the file — the trap data may be in a compressed block.',
          success: false,
        }
      }

      const offset = discoverHeightOffset(
        filePath,
        guidPos,
        trap.defaultHeightHex,
        family?.heightOffset ?? FALLBACK_HEIGHT_OFFSET
      )

      const originalHex = toHeightHex(
        readBytesAt(filePath, guidPos - offset, 2)
      )

      patch = {
        currentHeight: originalHex,
        guidFilePos: guidPos,
        heightOffset: offset,
        originalHeight: originalHex,
        trapName: trap.name,
      }
    }

    const [h0, h1] = parseHex(newHeight)
    patchBytes(filePath, patch.guidFilePos - patch.heightOffset, h0, h1)

    patch.currentHeight = newHeight
    state.patches[guid] = patch
    writeStateFile(state)

    const uu = Math.round(heightHexToFloat(newHeight))

    return {
      currentHeight: newHeight,
      isModified: true,
      message: `${trap.desc} height set to ${uu} UU (${newHeight})`,
      success: true,
    }
  } catch (error) {
    return {
      message: `Patch failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      success: false,
    }
  }
}

export async function revertTrapHeight(
  guid: string
): Promise<TrapActionResult> {
  const filePath = await resolveTrapFile()

  if (!filePath) {
    return {
      message: `${CHUNK_FILE} not found. Check the game path in Settings.`,
      success: false,
    }
  }

  const trap = TRAP_LIST.find((item) => item.guid === guid)

  if (!trap) {
    return { message: 'Unknown trap GUID.', success: false }
  }

  const state = readStateFile()
  const patch = state.patches[guid]

  if (!patch) {
    return {
      message: 'No modification found for this trap.',
      success: false,
    }
  }

  try {
    const [h0, h1] = parseHex(patch.originalHeight)
    patchBytes(filePath, patch.guidFilePos - patch.heightOffset, h0, h1)

    delete state.patches[guid]
    writeStateFile(state)

    return {
      currentHeight: patch.originalHeight,
      isModified: false,
      message: `${trap.desc} height restored (${patch.originalHeight})`,
      success: true,
    }
  } catch (error) {
    return {
      message: `Revert failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      success: false,
    }
  }
}

export async function revertAllTrapHeights(): Promise<TrapActionResult> {
  const filePath = await resolveTrapFile()

  if (!filePath) {
    return {
      message: `${CHUNK_FILE} not found. Check the game path in Settings.`,
      success: false,
    }
  }

  const state = readStateFile()
  const guids = Object.keys(state.patches)

  if (guids.length === 0) {
    return { message: 'No trap modifications to revert.', success: true }
  }

  let restored = 0
  let errors = 0

  for (const guid of guids) {
    const patch = state.patches[guid]

    try {
      const [h0, h1] = parseHex(patch.originalHeight)
      patchBytes(filePath, patch.guidFilePos - patch.heightOffset, h0, h1)
      delete state.patches[guid]
      restored++
    } catch {
      errors++
    }
  }

  writeStateFile(state)

  return {
    message: `Restored ${restored} trap(s)${
      errors > 0 ? `, ${errors} error(s)` : ''
    }`,
    success: errors === 0,
  }
}

export function getModifiedTraps(): Array<ModifiedTrap> {
  const state = readStateFile()

  return Object.entries(state.patches).map(([guid, patch]) => {
    const entry = TRAP_LIST.find((item) => item.guid === guid)
    const parsed = parseTrapName(patch.trapName)

    return {
      currentHeight: patch.currentHeight,
      desc: entry?.desc ?? '',
      guid,
      name: patch.trapName,
      rarity: parsed.rarity,
      tier: parsed.tier,
    }
  })
}

// ── B.A.S.E. ─────────────────────────────────────────────────

const BASE_PREFIX = Buffer.from([0x05, 0x30, 0x00, 0x12])
const BASE_SUFFIX = Buffer.from([
  0x0f, 0x00, 0x42, 0x01, 0x01, 0x1f, 0x00, 0x00, 0x5f, 0x00, 0xf2, 0x06,
  0x00, 0xb1, 0xf0, 0x05, 0x18, 0x00, 0x31, 0x03, 0x23,
])
const BASE_PATTERN_LEN = BASE_PREFIX.length + 2 + BASE_SUFFIX.length
const BASE_DEFAULT_HEIGHT = '74 C2'

function findBasePatternInFile(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(64 * 1024 * 1024 + BASE_PATTERN_LEN)
    let fileOffset = 0
    let carry = 0

    const matchesAt = (offset: number, haystack: Buffer): boolean => {
      for (let i = 0; i < BASE_PREFIX.length; i++) {
        if (haystack[offset + i] !== BASE_PREFIX[i]) return false
      }

      const suffixStart = offset + BASE_PREFIX.length + 2

      for (let i = 0; i < BASE_SUFFIX.length; i++) {
        if (haystack[suffixStart + i] !== BASE_SUFFIX[i]) return false
      }

      return true
    }

    const read = () => {
      try {
        const bytesRead = fs.readSync(
          fd,
          asFsBuffer(buf),
          carry,
          64 * 1024 * 1024,
          fileOffset
        )

        if (bytesRead === 0) {
          if (carry >= BASE_PATTERN_LEN) {
            for (let i = 0; i <= carry - BASE_PATTERN_LEN; i++) {
              if (matchesAt(i, buf)) {
                fs.closeSync(fd)
                return resolve(fileOffset - carry + i)
              }
            }
          }

          fs.closeSync(fd)
          return resolve(-1)
        }

        const total = carry + bytesRead

        for (let i = 0; i <= total - BASE_PATTERN_LEN; i++) {
          if (matchesAt(i, buf)) {
            fs.closeSync(fd)
            return resolve(fileOffset - carry + i)
          }
        }

        if (total > BASE_PATTERN_LEN) {
          buf.copy(asFsBuffer(buf), 0, total - BASE_PATTERN_LEN, total)
          carry = BASE_PATTERN_LEN
        } else {
          carry = total
        }

        fileOffset += bytesRead
        setImmediate(read)
      } catch (error) {
        try {
          fs.closeSync(fd)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (closeError) {
          //
        }

        reject(error)
      }
    }

    read()
  })
}

export async function getBaseStatus(): Promise<BasePatchStatus> {
  const state = readStateFile()

  if (state.base) {
    return {
      currentHeight: state.base.currentHeight,
      found: true,
      isModified: state.base.currentHeight !== state.base.originalHeight,
    }
  }

  return {
    currentHeight: BASE_DEFAULT_HEIGHT,
    found: false,
    isModified: false,
  }
}

export async function applyBaseHeight(
  uuValue: number
): Promise<TrapActionResult> {
  const filePath = await resolveTrapFile()

  if (!filePath) {
    return {
      message: `${CHUNK_FILE} not found. Check the game path in Settings.`,
      success: false,
    }
  }

  const state = readStateFile()

  try {
    if (!state.base) {
      const patternPos = await findBasePatternInFile(filePath)

      if (patternPos < 0) {
        return {
          message: 'B.A.S.E. pattern not found in pakchunk11.',
          success: false,
        }
      }

      const originalHex = toHeightHex(
        readBytesAt(filePath, patternPos + BASE_PREFIX.length, 2)
      )

      state.base = {
        currentHeight: originalHex,
        originalHeight: originalHex,
        patternPos,
      }
    }

    const floatBuf = Buffer.alloc(4)
    floatBuf.writeFloatLE(uuValue, 0)

    patchBytes(
      filePath,
      state.base.patternPos + BASE_PREFIX.length,
      floatBuf[2],
      floatBuf[3]
    )

    const newHex = toHeightHex(Buffer.from([floatBuf[2], floatBuf[3]]))
    state.base.currentHeight = newHex
    writeStateFile(state)

    return {
      currentHeight: newHex,
      isModified: true,
      message: `B.A.S.E. height set to ${Math.round(uuValue)} UU (${newHex})`,
      success: true,
    }
  } catch (error) {
    return {
      message: `B.A.S.E. patch failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      success: false,
    }
  }
}

export async function revertBaseHeight(): Promise<TrapActionResult> {
  const filePath = await resolveTrapFile()

  if (!filePath) {
    return {
      message: `${CHUNK_FILE} not found. Check the game path in Settings.`,
      success: false,
    }
  }

  const state = readStateFile()

  if (!state.base) {
    return { message: 'No B.A.S.E. modification found.', success: false }
  }

  try {
    const [h0, h1] = parseHex(state.base.originalHeight)
    patchBytes(filePath, state.base.patternPos + BASE_PREFIX.length, h0, h1)

    state.base = null
    writeStateFile(state)

    return {
      isModified: false,
      message: 'B.A.S.E. height restored',
      success: true,
    }
  } catch (error) {
    return {
      message: `B.A.S.E. revert failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      success: false,
    }
  }
}
