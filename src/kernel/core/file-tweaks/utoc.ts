import * as fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

import { cityHash64Bytes } from './city-hash'

import { asFsBuffer } from './binary'

/**
 * IoStore `.utoc` repair — the missing half of every public pakchunk
 * patcher.
 *
 * Glow-style tweaks overwrite bytes inside the `.ucas` and call it a day,
 * which desynchronises the container: the `.utoc`'s chunk-meta array still
 * carries the hash of the *original* chunk data. When anything verifies
 * container integrity — startup, matchmaking, anti-cheat — that mismatch
 * reads as a tampered install, and the game kicks you for it.
 *
 * This module parses the TOC, finds the chunk whose byte range covers the
 * patched offset, recomputes the chunk hash (SHA-1 on TOC versions that
 * switched to IoHash, CityHash64 on older ones) and rewrites the meta
 * entry, so the patched container verifies as cleanly as a fresh install.
 *
 * Layout constants follow FIoStoreTocHeader / FIoStoreTocResource from
 * UE5 (CUE4Parse reference implementation).
 */

const TOC_MAGIC = Buffer.from('-==--==--==--==-', 'ascii')

// EIoStoreTocVersion values.
const VERSION_PERFECT_HASH = 4
const VERSION_PERFECT_HASH_OVERFLOW = 5
// ReplaceIoChunkHashWithIoHash switched the chunk hash from CityHash64
// (8 bytes) to SHA-1 (20 bytes).
const VERSION_REPLACE_HASH = 8

// Header field offsets (FIoStoreTocHeader, 144 bytes total).
const HEADER = {
  magic: 0,
  version: 16,
  headerSize: 20,
  entryCount: 24,
  blockEntryCount: 28,
  methodNameCount: 36,
  methodNameLength: 40,
  directoryIndexSize: 48,
  containerFlags: 80,
  encryptionMethod: 81,
  perfectHashSeedsCount: 84,
  chunksWithoutPerfectHashCount: 96,
} as const

const CONTAINER_SIGNED = 1 << 2
const CONTAINER_INDEXED = 1 << 3

export type TocPatchResult = {
  hashType: 'city64' | 'sha1' | 'none'
  message: string
  success: boolean
}

type TocLayout = {
  /** Byte range of each chunk inside the paired .ucas. */
  chunks: Array<{ length: number; offset: number }>
  /** Compression block entries: offset into .ucas, size, method index. */
  blocks: Array<{ compressedSize: number; methodIndex: number; offset: number }>
  /** Absolute offset of chunk i's meta entry inside the .utoc. */
  metaOffsetFor: (index: number) => number
  sha1Chunks: boolean
}

/**
 * Sequential-parse the .utoc far enough to locate the chunk-meta array
 * and map every chunk to its byte range in the .ucas.
 */
function parseToc(utocPath: string): TocLayout {
  const toc = fs.readFileSync(utocPath)

  if (!toc.subarray(0, 16).equals(asFsBuffer(TOC_MAGIC))) {
    throw new Error('Not a .utoc file (bad magic)')
  }

  const version = toc.readUInt8(HEADER.version)

  if (toc.readUInt8(HEADER.encryptionMethod) !== 0) {
    throw new Error('Encrypted containers are not supported')
  }

  const entryCount = toc.readUInt32LE(HEADER.entryCount)
  const blockEntryCount = toc.readUInt32LE(HEADER.blockEntryCount)
  const containerFlags = toc.readUInt8(HEADER.containerFlags)

  let position = toc.readUInt32LE(HEADER.headerSize)

  // Chunk ids — 12 bytes each, skipped.
  position += entryCount * 12

  // Chunk offsets/lengths — 10 bytes each: 40-bit offset then 40-bit
  // length, both big-endian.
  const chunks: Array<{ length: number; offset: number }> = []

  for (let index = 0; index < entryCount; index++) {
    const base = position + index * 10

    chunks.push({
      length: read40(toc, base + 5),
      offset: read40(toc, base),
    })
  }

  position += entryCount * 10

  // Perfect-hash lookup tables.
  if (version >= VERSION_PERFECT_HASH) {
    position += toc.readUInt32LE(HEADER.perfectHashSeedsCount) * 4
  }

  if (version >= VERSION_PERFECT_HASH_OVERFLOW) {
    position += toc.readUInt32LE(HEADER.chunksWithoutPerfectHashCount) * 4
  }

  // Compression block entries — 12 bytes each: 40-bit offset + 24-bit
  // compressed size, then 24-bit uncompressed size + 8-bit method index.
  const blocks: Array<{
    compressedSize: number
    methodIndex: number
    offset: number
  }> = []

  for (let index = 0; index < blockEntryCount; index++) {
    const base = position + index * 12
    const raw = toc.readBigUInt64LE(base)
    const rawMeta = toc.readUInt32LE(base + 8)

    blocks.push({
      compressedSize: Number((raw >> 40n) & 0xffffffn),
      methodIndex: rawMeta >>> 24,
      offset: Number(raw & ((1n << 40n) - 1n)),
    })
  }

  position += blockEntryCount * 12

  // Compression method names.
  position +=
    toc.readUInt32LE(HEADER.methodNameCount) *
    toc.readUInt32LE(HEADER.methodNameLength)

  // Signed containers carry block signatures — Fortnite's are not signed.
  if ((containerFlags & CONTAINER_SIGNED) !== 0) {
    const hashSize = toc.readInt32LE(position)
    position += 4 + hashSize + hashSize + 20 * blockEntryCount
  }

  // Directory index.
  if (version >= 2 && (containerFlags & CONTAINER_INDEXED) !== 0) {
    position += toc.readUInt32LE(HEADER.directoryIndexSize)
  }

  const sha1Chunks = version >= VERSION_REPLACE_HASH
  const metaEntrySize = sha1Chunks ? 24 : 9

  return {
    blocks,
    chunks,
    metaOffsetFor: (index: number) => position + index * metaEntrySize,
    sha1Chunks,
  }
}

function read40(buffer: Buffer, offset: number): number {
  return (
    buffer[offset] * 2 ** 32 +
    buffer[offset + 1] * 2 ** 24 +
    buffer[offset + 2] * 2 ** 16 +
    buffer[offset + 3] * 2 ** 8 +
    buffer[offset + 4]
  )
}

/**
 * Confirm every compression block touching the chunk is uncompressed —
 * patching raw bytes inside an Oodle stream would corrupt it, and no
 * hash fix applies to compressed data.
 */
function isChunkUncompressed(
  chunk: { length: number; offset: number },
  blocks: TocLayout['blocks']
): boolean {
  const chunkEnd = chunk.offset + chunk.length

  return blocks.every(
    (block) =>
      !(
        block.offset < chunkEnd &&
        block.offset + block.compressedSize > chunk.offset
      ) || block.methodIndex === 0
  )
}

/**
 * Rewrite the chunk-meta hash for the chunk containing `patchOffset`
 * inside the `.ucas`, after its bytes have been modified in place.
 */
export function updateTocChunkHash(
  ucasPath: string,
  patchOffset: number
): TocPatchResult {
  const utocPath = ucasPath.replace(/\.ucas$/i, '.utoc')

  if (!fs.existsSync(utocPath)) {
    return {
      hashType: 'none',
      message: `Cannot verify the patch: ${path.basename(
        utocPath
      )} not found next to the .ucas`,
      success: false,
    }
  }

  try {
    const layout = parseToc(utocPath)

    const chunkIndex = layout.chunks.findIndex(
      (chunk) =>
        patchOffset >= chunk.offset && patchOffset < chunk.offset + chunk.length
    )

    if (chunkIndex < 0) {
      return {
        hashType: 'none',
        message: 'Patched offset does not belong to any chunk in the TOC',
        success: false,
      }
    }

    const chunk = layout.chunks[chunkIndex]

    if (!isChunkUncompressed(chunk, layout.blocks)) {
      return {
        hashType: 'none',
        message:
          'The affected chunk is compressed — this tweak cannot be applied safely',
        success: false,
      }
    }

    // For an uncompressed chunk, its bytes in the .ucas are its data 1:1.
    const chunkData = Buffer.alloc(chunk.length)
    const dataFd = fs.openSync(ucasPath, 'r')

    try {
      fs.readSync(dataFd, asFsBuffer(chunkData), 0, chunk.length, chunk.offset)
    } finally {
      fs.closeSync(dataFd)
    }

    const hash = layout.sha1Chunks
      ? createHash('sha1').update(asFsBuffer(chunkData)).digest()
      : cityHash64Bytes(chunkData)

    const tocFd = fs.openSync(utocPath, 'r+')

    try {
      fs.writeSync(
        tocFd,
        asFsBuffer(hash),
        0,
        hash.length,
        layout.metaOffsetFor(chunkIndex)
      )
    } finally {
      fs.closeSync(tocFd)
    }

    return {
      hashType: layout.sha1Chunks ? 'sha1' : 'city64',
      message: `TOC hash refreshed (${layout.sha1Chunks ? 'SHA-1' : 'CityHash64'})`,
      success: true,
    }
  } catch (error) {
    return {
      hashType: 'none',
      message: `TOC repair failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      success: false,
    }
  }
}

/**
 * Patch bytes in the .ucas and repair the .utoc in the same breath,
 * restoring the original bytes if the TOC update fails so the container
 * is never left half-patched.
 */
export function patchWithTocRepair(
  ucasPath: string,
  offset: number,
  replacement: Buffer,
  original: Buffer
): TocPatchResult {
  const fd = fs.openSync(ucasPath, 'r+')

  try {
    fs.writeSync(fd, asFsBuffer(replacement), 0, replacement.length, offset)
  } finally {
    fs.closeSync(fd)
  }

  const result = updateTocChunkHash(ucasPath, offset)

  if (!result.success) {
    const restoreFd = fs.openSync(ucasPath, 'r+')

    try {
      fs.writeSync(restoreFd, asFsBuffer(original), 0, original.length, offset)
    } finally {
      fs.closeSync(restoreFd)
    }
  }

  return result
}
