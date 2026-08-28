import type { PatchResult, PatchStatus } from './trap-height-types'

import { Buffer } from 'node:buffer'

import {
  findNeedle,
  patchAt,
  resolvePakchunkPath,
} from './binary'

const CHUNK_FILE = 'pakchunk30-WindowsClient.ucas'

// 8-byte float needles for the airstrike impact radius.
const NEEDLE_ORIGINAL = Buffer.from('000A0C039A99193F', 'hex')
const NEEDLE_PATCHED = Buffer.from('000A0C0300008060', 'hex')

export async function getAirStrikeStatus(): Promise<PatchStatus> {
  const filePath = await resolvePakchunkPath(CHUNK_FILE)

  if (!filePath) {
    return {
      activated: false,
      error: `${CHUNK_FILE} not found — check the game path in Settings`,
      found: false,
    }
  }

  try {
    if ((await findNeedle(filePath, NEEDLE_PATCHED)) >= 0) {
      return { activated: true, found: true }
    }

    if ((await findNeedle(filePath, NEEDLE_ORIGINAL)) >= 0) {
      return { activated: false, found: true }
    }

    return {
      activated: false,
      error: 'AirStrike target not found in the file',
      found: false,
    }
  } catch (error) {
    return {
      activated: false,
      error: error instanceof Error ? error.message : 'Scan failed',
      found: false,
    }
  }
}

export async function toggleAirStrike(): Promise<PatchResult> {
  const filePath = await resolvePakchunkPath(CHUNK_FILE)

  if (!filePath) {
    return {
      message: `${CHUNK_FILE} not found. Check the game path in Settings.`,
      success: false,
    }
  }

  try {
    const patchedOffset = await findNeedle(filePath, NEEDLE_PATCHED)

    if (patchedOffset >= 0) {
      patchAt(filePath, patchedOffset, NEEDLE_ORIGINAL)
      return {
        activated: false,
        message: 'AirStrike deactivated',
        success: true,
      }
    }

    const originalOffset = await findNeedle(filePath, NEEDLE_ORIGINAL)

    if (originalOffset >= 0) {
      patchAt(filePath, originalOffset, NEEDLE_PATCHED)
      return {
        activated: true,
        message: 'AirStrike activated',
        success: true,
      }
    }

    return {
      message:
        'AirStrike target not found in the file — the game version may differ.',
      success: false,
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
