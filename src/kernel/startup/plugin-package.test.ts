import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { inspectPlugin } from './plugin-package'
let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'penny-package-'))
  await writeFile(path.join(root, 'plugin.json'), JSON.stringify({ id: 'sample', name: 'Sample', runtime: 'sandbox', apiVersion: 4 }))
  await writeFile(path.join(root, 'main.js'), 'module.exports = {}')
})
afterEach(() => rm(root, { recursive: true, force: true }))
it('hashes all contents and refuses symbolic links', async () => {
  const original = await inspectPlugin(root)
  await writeFile(path.join(root, 'README.md'), 'Updated docs')
  expect((await inspectPlugin(root)).digest).not.toBe(original.digest)
  await symlink(path.join(root, 'main.js'), path.join(root, 'linked.js'))
  await expect(inspectPlugin(root)).rejects.toThrow('symlinks')
})
it('rejects oversized executable entries', async () => {
  await writeFile(path.join(root, 'main.js'), 'x'.repeat(1024 * 1024 + 1))
  await expect(inspectPlugin(root)).rejects.toThrow('1 MiB')
})
