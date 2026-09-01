import type { PatchResult, PatchStatus } from './trap-height-types'

import { Buffer } from 'node:buffer'

import {
  findNeedle,
  patchAt,
  resolvePakchunkPath,
} from './binary'

const CHUNK_FILE = 'pakchunk10-WindowsClient.ucas'

// "PBWA_BG_ArchwayLargeSu" → "@@@@_BG_ArchwayLargeSu". With the asset name
// broken the game treats the build as a developer build and unlocks the
// editor-only movement tools.
const NEEDLE_ORIGINAL = Buffer.from('PBWA_BG_ArchwayLargeSu', 'utf8')
const NEEDLE_PATCHED = Buffer.from('@@@@_BG_ArchwayLargeSu', 'utf8')

export async function getDevBuildsStatus(): Promise<PatchStatus> {
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
      error: 'Target string not found in the file',
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

export async function toggleDevBuilds(): Promise<PatchResult> {
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
      await patchAt(filePath, patchedOffset, NEEDLE_ORIGINAL, NEEDLE_PATCHED)
      return {
        activated: false,
        message: 'Dev Builds deactivated',
        success: true,
      }
    }

    const originalOffset = await findNeedle(filePath, NEEDLE_ORIGINAL)

    if (originalOffset >= 0) {
      await patchAt(filePath, originalOffset, NEEDLE_PATCHED, NEEDLE_ORIGINAL)
      return {
        activated: true,
        message: 'Dev Builds activated',
        success: true,
      }
    }

    return {
      message:
        'Target string not found in the file — the game version may differ.',
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
