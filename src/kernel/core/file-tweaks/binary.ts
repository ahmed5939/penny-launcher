import * as fs from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

/**
 * Binary pakchunk patching — the engine behind the File Tweaks page.
 *
 * Every tweak is the same trick: find a byte needle inside an Unreal
 * `.ucas` package and rewrite it in place. The files are several GB, so
 * searches stream through 64 MB chunks instead of reading the file whole.
 */

const CHUNK_SIZE = 64 * 1024 * 1024

/**
 * lib.dom's `ArrayBufferView` is stricter than Node's `Buffer` type, and the
 * two disagree on every fs call that takes a byte sink. One cast here keeps
 * every call site in the patch modules clean.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asFsBuffer(buffer: Buffer): any {
  return buffer
}

/**
 * The configured game path, read straight from the settings file so this
 * module stays decoupled from the startup layer. Resolves `app.getPath`
 * lazily — always after Electron is ready, since only IPC handlers call in.
 */
function readConfiguredGamePath(): string {
  try {
    const settingsPath = path.join(
      app.getPath('appData'),
      'penny-launcher-data',
      'settings.json'
    )
    const settings = JSON.parse(
      fs.readFileSync(settingsPath, { encoding: 'utf8' })
    ) as { path?: string }

    return settings.path || 'C:\\Program Files\\Epic Games\\Fortnite'
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return 'C:\\Program Files\\Epic Games\\Fortnite'
  }
}

/**
 * Users configure the game path as the Win64 binaries folder, but some may
 * point at the Fortnite root, FortniteGame, Content or Paks directly. Walk
 * the plausible relatives until a pakchunk answers.
 */
export async function resolvePakchunkPath(
  chunkFile: string
): Promise<string | null> {
  const rawPath = readConfiguredGamePath()
  const norm = path.resolve(rawPath)

  const candidates = [
    path.join(norm, 'FortniteGame', 'Content', 'Paks', chunkFile),
    path.join(norm, 'Content', 'Paks', chunkFile),
    path.join(norm, 'Paks', chunkFile),
    path.join(norm, chunkFile),
    // Win64 → Binaries → FortniteGame
    path.join(norm, '..', '..', 'Content', 'Paks', chunkFile),
    path.join(norm, '..', 'Content', 'Paks', chunkFile),
    path.join(
      norm,
      '..',
      '..',
      '..',
      'FortniteGame',
      'Content',
      'Paks',
      chunkFile
    ),
  ]

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate)

    if (fs.existsSync(resolved)) {
      return resolved
    }
  }

  return null
}

/**
 * Stream-search a large file for an exact byte needle. Returns the byte
 * offset, or -1 when the needle never shows up.
 */
export function findNeedle(
  filePath: string,
  needle: Buffer
): Promise<number> {
  return new Promise((resolve, reject) => {
    const overlap = needle.length
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(CHUNK_SIZE + overlap)
    let fileOffset = 0
    let carry = 0

    const read = () => {
      try {
        const bytesRead = fs.readSync(
          fd,
          asFsBuffer(buf),
          carry,
          CHUNK_SIZE,
          fileOffset
        )

        if (bytesRead === 0) {
          if (carry > 0) {
            const tailIndex = buf
              .subarray(0, carry)
              .indexOf(asFsBuffer(needle))

            if (tailIndex >= 0) {
              fs.closeSync(fd)
              return resolve(fileOffset - carry + tailIndex)
            }
          }

          fs.closeSync(fd)
          return resolve(-1)
        }

        const total = carry + bytesRead
        const index = buf.subarray(0, total).indexOf(asFsBuffer(needle))

        if (index >= 0) {
          fs.closeSync(fd)
          return resolve(fileOffset - carry + index)
        }

        // Keep the tail bytes so needles spanning chunk boundaries survive.
        if (total > overlap) {
          buf.copy(asFsBuffer(buf), 0, total - overlap, total)
          carry = overlap
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

/**
 * Overwrite `replacement.length` bytes at an absolute offset, then repair
 * the `.utoc` chunk hash so the container stays internally consistent.
 * When the TOC repair fails, the original bytes are restored — a
 * desynchronised container is exactly what anti-cheat looks for.
 */
export async function patchAt(
  filePath: string,
  offset: number,
  replacement: Buffer,
  original: Buffer
): Promise<void> {
  const { patchWithTocRepair } = await import('./utoc')

  const result = patchWithTocRepair(filePath, offset, replacement, original)

  if (!result.success) {
    throw new Error(result.message)
  }
}

export function readBytesAt(
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

export function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase()
}
