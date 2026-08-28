import type { PatchResult, PatchStatus } from './trap-height-types'

import { Buffer } from 'node:buffer'

import {
  findNeedle,
  patchAt,
  resolvePakchunkPath,
} from './binary'
import { getDevBuildsStatus, toggleDevBuilds } from './dev-builds'

const CHUNK_FILE = 'pakchunk30-WindowsClient.ucas'

/**
 * Needle from the NavigationLink_StairRathenaPlayerWood1 blueprint name.
 * Original carries "PBWA_W1"; the patched variant replaces those bytes
 * (plus the two before them) with nulls, exposing dev stairs.
 */
const NEEDLE_ORIGINAL = Buffer.from(
  '263C2F47616D652F4275696C64696E672F416374' +
    '6F72426C75657072696E74732F4E617669676174' +
    '696F6E4C696E6B5F53746169725241746865' +
    '6E61506C61796572576F6F64315479' +
    '70652E2E416C2E466C6F6F72537461694375' +
    '7276656444656661756C745363656E65' +
    '526F6F745F434E6F6E6553697A365374616963' +
    '4D7368436F6D706F6E656E743050425741' +
    '5F57315F5F505343535F4E6F646553696D',
  'hex'
)

const NEEDLE_PATCHED = Buffer.from(
  '263C2F47616D652F4275696C64696E672F416374' +
    '6F72426C75657072696E74732F4E617669676174' +
    '696F6E4C696E6B5F53746169725241746865' +
    '6E61506C61796572576F6F64315479' +
    '70652E2E416C2E466C6F6F72537461694375' +
    '7276656444656661756C745363656E65' +
    '526F6F745F434E6F6E6553697A365374616963' +
    '4D7368436F6D706F6E656E7430000000' +
    '000000005F5F505343535F4E6F646553696D',
  'hex'
)

export async function getDevStairsStatus(): Promise<PatchStatus> {
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
      error: 'DevStairs target not found in the file',
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

/**
 * DevStairs and plain Dev Builds fight over movement flags, so turning the
 * stairs on quietly reverts Dev Builds when they were active.
 */
export async function toggleDevStairs(): Promise<PatchResult> {
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
        message: 'DevStairs deactivated',
        success: true,
      }
    }

    const originalOffset = await findNeedle(filePath, NEEDLE_ORIGINAL)

    if (originalOffset >= 0) {
      try {
        const devBuilds = await getDevBuildsStatus()

        if (devBuilds.found && devBuilds.activated) {
          await toggleDevBuilds()
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Best effort — the stairs patch itself is what matters.
      }

      patchAt(filePath, originalOffset, NEEDLE_PATCHED)
      return {
        activated: true,
        message: 'DevStairs activated (Dev Builds deactivated)',
        success: true,
      }
    }

    return {
      message:
        'DevStairs target not found in the file — the game version may differ.',
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
