import * as fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { patchAt } from './binary'
import { describeFileError } from './errors'

const mocks = vi.hoisted(() => ({ lockUtoc: false }))

vi.mock('electron', () => ({ app: { getPath: () => process.cwd() } }))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>()
  const openSync = (file: fs.PathLike, flags: fs.OpenMode, mode?: fs.Mode) => {
    if (mocks.lockUtoc && String(file).endsWith('.utoc') && flags === 'r+') {
      throw Object.assign(
        new Error(`EBUSY: resource busy or locked, open '${String(file)}'`),
        { code: 'EBUSY' }
      )
    }

    return actual.openSync(file, flags, mode)
  }

  return { ...actual, openSync }
})

let dir = ''

beforeEach(() => {
  mocks.lockUtoc = false
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-tweaks-'))
})

afterEach(() => {
  mocks.lockUtoc = false
  fs.rmSync(dir, { force: true, recursive: true })
})

/**
 * A one-chunk container: 16 bytes at offset 0 in the .ucas, described by a
 * version-7 .utoc with no compression blocks, so the TOC repair runs end to
 * end on real files.
 */
function writeContainer(): string {
  const ucasPath = path.join(dir, 'pakchunk10-WindowsClient.ucas')
  const utocPath = path.join(dir, 'pakchunk10-WindowsClient.utoc')
  const toc = Buffer.alloc(144 + 12 + 10 + 9)

  Buffer.from('-==--==--==--==-', 'ascii').copy(toc, 0)
  toc.writeUInt8(7, 16)
  toc.writeUInt32LE(144, 20)
  toc.writeUInt32LE(1, 24)
  toc.writeUInt8(16, 144 + 12 + 9)

  fs.writeFileSync(ucasPath, Buffer.alloc(64, 0x11))
  fs.writeFileSync(utocPath, toc)

  return ucasPath
}

it('repairs the container when the .utoc is free', async () => {
  const ucasPath = writeContainer()

  await expect(
    patchAt(ucasPath, 0, Buffer.from([0xaa, 0xbb]), Buffer.from([0x11, 0x11]))
  ).resolves.toBeUndefined()
  expect(fs.readFileSync(ucasPath)[0]).toBe(0xaa)
})

it('keeps the close-Fortnite advice when a locked .utoc fails the patch', async () => {
  const ucasPath = writeContainer()

  mocks.lockUtoc = true

  const error = await patchAt(
    ucasPath,
    0,
    Buffer.from([0xaa, 0xbb]),
    Buffer.from([0x11, 0x11])
  ).then(
    () => null,
    (failure: unknown) => failure
  )

  expect(describeFileError(error, 'patch the game file')).toBe(
    'Could not repair the game file index: the file is in use. Close Fortnite and try again.'
  )
  expect(fs.readFileSync(ucasPath)[0]).toBe(0x11)
})
