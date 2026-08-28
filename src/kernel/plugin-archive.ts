import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  marketplaceArchiveMaxBytes,
  marketplaceArchiveMaxFiles,
  marketplaceArchiveMaxUncompressedBytes,
} from '../config/constants/marketplace'

const tarBlock = 512
const utf8 = new TextDecoder()

function toUint8(value: ArrayLike<number>) {
  const copy = new Uint8Array(value.length)
  copy.set(value as unknown as ArrayLike<number>)
  return copy
}

export function sha256Buffer(buffer: Uint8Array) {
  return createHash('sha256').update(toUint8(buffer)).digest('hex')
}

export function assertSha256Match(buffer: Uint8Array, expected: string) {
  const actual = sha256Buffer(buffer)

  if (actual !== expected.toLowerCase()) {
    throw new Error('Downloaded add-on did not match the catalog SHA-256.')
  }

  return actual
}

function parseOctal(value: Uint8Array) {
  const text = utf8.decode(value).replace(/\0/g, '').trim()

  if (!text) return 0

  const parsed = Number.parseInt(text, 8)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Archive header is not a valid tar.')
  }

  return parsed
}

function tarChecksum(header: Uint8Array) {
  let sum = 0

  for (let index = 0; index < tarBlock; index += 1) {
    sum += index >= 148 && index < 156 ? 32 : header[index]!
  }

  return sum
}

function sanitizeTarPath(name: string) {
  const normalized = name.replace(/\\/g, '/').replace(/^\.\/+/, '')

  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return null
  }

  const parts = normalized.split('/').filter((part) => part && part !== '.')

  if (parts.some((part) => part === '..' || part.includes('\0'))) {
    return null
  }

  if (parts[0] === 'package') parts.shift()
  if (parts.length === 0) return null

  return parts.join('/')
}

function readTarString(header: Uint8Array, start: number, length: number) {
  const window = header.subarray(start, start + length)
  const end = window.indexOf(0)

  return utf8.decode(end === -1 ? window : window.subarray(0, end)).trim()
}

/**
 * Minimal gzip/ustar extractor for npm-style tarballs.
 *
 * Symlinks, absolute paths and `..` entries are refused so a listing cannot
 * write outside its install folder. This is admission control for the
 * archive, not a general-purpose tar implementation.
 */
export function extractNpmTarball(archive: Uint8Array) {
  if (archive.byteLength > marketplaceArchiveMaxBytes) {
    throw new Error('Add-on archive is larger than the 25 MB limit.')
  }

  const tar: Uint8Array =
    archive.length >= 2 && archive[0] === 0x1f && archive[1] === 0x8b
      ? toUint8(gunzipSync(toUint8(archive)))
      : archive

  if (tar.byteLength > marketplaceArchiveMaxUncompressedBytes) {
    throw new Error('Add-on archive unpacks larger than the 80 MB limit.')
  }

  const files: Array<{ content: Uint8Array; relativePath: string }> = []
  const directories = new Set<string>()
  let offset = 0
  let pendingLongName: string | null = null
  let fileCount = 0

  while (offset + tarBlock <= tar.length) {
    const header = tar.subarray(offset, offset + tarBlock)
    offset += tarBlock

    if (header.every((byte) => byte === 0)) break

    const checksum = parseOctal(header.subarray(148, 156))

    if (checksum !== tarChecksum(header)) {
      throw new Error('Add-on archive header checksum failed.')
    }

    const size = parseOctal(header.subarray(124, 136))
    const type = String.fromCharCode(header[156] ?? 0)
    const prefix = readTarString(header, 345, 155)
    const name = pendingLongName ?? (prefix
      ? `${prefix}/${readTarString(header, 0, 100)}`
      : readTarString(header, 0, 100))
    pendingLongName = null

    const dataEnd = offset + Math.ceil(size / tarBlock) * tarBlock
    const content = tar.subarray(offset, offset + size)
    offset = dataEnd

    if (type === 'L') {
      pendingLongName = utf8.decode(content).replace(/\0/g, '')
      continue
    }

    if (type === 'x' || type === 'g') continue

    if (type === '2' || type === '1') {
      throw new Error('Add-on archives may not contain links.')
    }

    if (type !== '0' && type !== '\0' && type !== '5') continue

    const relativePath = sanitizeTarPath(name)

    if (!relativePath) {
      throw new Error('Add-on archive contained an unsafe path.')
    }

    fileCount += 1

    if (fileCount > marketplaceArchiveMaxFiles) {
      throw new Error('Add-on archive contains too many files.')
    }

    if (type === '5') {
      directories.add(relativePath)
      continue
    }

    files.push({ content: new Uint8Array(content), relativePath })
  }

  if (files.length === 0) {
    throw new Error('Add-on archive did not contain any files.')
  }

  return { directories: [...directories], files }
}

export async function writeExtractedArchive(
  archive: Uint8Array,
  destination: string
) {
  const extracted = extractNpmTarball(archive)

  await mkdir(destination, { recursive: true })

  for (const directory of extracted.directories) {
    await mkdir(path.join(destination, directory), { recursive: true })
  }

  for (const file of extracted.files) {
    const target = path.join(destination, file.relativePath)

    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.content)
  }
}

export async function hashDirectoryTree(directory: string) {
  const files: Array<string> = []

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (!entry.isFile()) continue

      files.push(path.relative(directory, fullPath).split(path.sep).join('/'))
    }
  }

  await walk(directory)

  files.sort()

  const hash = createHash('sha256')

  for (const relativePath of files) {
    if (relativePath === '.penny-origin.json') continue

    hash.update(relativePath)
    hash.update('\0')
    hash.update(toUint8(await readFile(path.join(directory, relativePath))))
    hash.update('\0')
  }

  return hash.digest('hex')
}
