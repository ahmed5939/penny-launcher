import { gzipSync } from 'node:zlib'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  assertSha256Match,
  extractNpmTarball,
  hashDirectoryTree,
  sha256Buffer,
  writeExtractedArchive,
} from './plugin-archive'

function tarChecksum(header: Uint8Array) {
  let sum = 0

  for (let index = 0; index < 512; index += 1) {
    sum += index >= 148 && index < 156 ? 32 : header[index]!
  }

  return sum
}

function writeAscii(target: Uint8Array, value: string, offset: number, length: number) {
  const bytes = new TextEncoder().encode(value)

  target.set(bytes.subarray(0, length), offset)
}

function tarHeader(name: string, size: number, type: string) {
  const header = new Uint8Array(512)

  writeAscii(header, name, 0, 99)
  writeAscii(header, '0000644\0', 100, 8)
  writeAscii(header, '0000000\0', 108, 8)
  writeAscii(header, '0000000\0', 116, 8)
  writeAscii(header, `${size.toString(8).padStart(11, '0')}\0`, 124, 12)
  writeAscii(header, '00000000000\0', 136, 12)
  writeAscii(header, '        ', 148, 8)
  writeAscii(header, type, 156, 1)
  writeAscii(header, 'ustar\0', 257, 6)
  writeAscii(header, '00', 263, 2)
  writeAscii(header, `${tarChecksum(header).toString(8).padStart(6, '0')}\0 `, 148, 8)

  return header
}

function concatBytes(chunks: Array<Uint8Array>) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }

  return output
}

function makeTar(entries: Array<{ content?: string; name: string; type?: string }>) {
  const chunks: Array<Uint8Array> = []

  for (const entry of entries) {
    const content = new TextEncoder().encode(entry.content ?? '')
    const type = entry.type ?? (entry.content === undefined ? '5' : '0')

    chunks.push(tarHeader(entry.name, content.length, type))

    if (content.length > 0) {
      const padded = new Uint8Array(Math.ceil(content.length / 512) * 512)

      padded.set(content)
      chunks.push(padded)
    }
  }

  chunks.push(new Uint8Array(1024))

  return concatBytes(chunks)
}

describe('plugin archives', () => {
  it('strips the npm package/ prefix and writes files', async () => {
    const tar = gzipSync(
      makeTar([
        { name: 'package/plugin.json', content: '{"id":"radar"}' },
        { name: 'package/main.js', content: 'module.exports = {}' },
      ])
    )
    const archive = new Uint8Array(tar)
    const digest = sha256Buffer(archive)

    expect(assertSha256Match(archive, digest)).toBe(digest)
    expect(() => assertSha256Match(archive, 'a'.repeat(64))).toThrow(/SHA-256/)

    const extracted = extractNpmTarball(archive)

    expect(extracted.files.map((file) => file.relativePath)).toEqual([
      'plugin.json',
      'main.js',
    ])

    const directory = await mkdtemp(path.join(os.tmpdir(), 'penny-plugin-'))

    try {
      await writeExtractedArchive(archive, directory)
      expect(await readFile(path.join(directory, 'plugin.json'), 'utf8')).toContain('radar')
      expect(await hashDirectoryTree(directory)).toMatch(/^[0-9a-f]{64}$/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects zip-slip paths and symlinks', () => {
    expect(() =>
      extractNpmTarball(
        makeTar([{ name: '../escape.js', content: 'nope' }])
      )
    ).toThrow(/unsafe path/)

    expect(() =>
      extractNpmTarball(
        makeTar([{ name: '/etc/passwd', content: 'nope' }])
      )
    ).toThrow(/unsafe path/)

    expect(() =>
      extractNpmTarball(
        makeTar([{ name: 'link', type: '2', content: 'target' }])
      )
    ).toThrow(/links/)
  })
})
