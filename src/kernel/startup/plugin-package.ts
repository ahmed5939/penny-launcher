import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { pluginManifestSchema } from './plugin-manifest'

export async function inspectPlugin(directory: string) {
  const root = await realpath(directory)
  const files: Array<{ name: string; content: Buffer }> = []
  let bytes = 0
  let nodes = 0
  const visit = async (folder: string, depth: number) => {
    if (depth > 12) throw new Error('Plugin folders are nested too deeply.')
    for (const name of (await readdir(folder)).sort()) {
      if (++nodes > 1000) throw new Error('Plugin contains too many filesystem entries.')
      const filename = path.join(folder, name)
      const stat = await lstat(filename)
      if (stat.isSymbolicLink()) throw new Error('Plugin symlinks are not allowed.')
      if (stat.isDirectory()) await visit(filename, depth + 1)
      else {
        if (!stat.isFile()) throw new Error('Only regular plugin files are allowed.')
        if (files.length >= 500 || (bytes += stat.size) > 10 * 1024 * 1024) throw new Error('Plugin exceeds 500 files or 10 MiB.')
        files.push({ name: path.relative(root, filename).split(path.sep).join('/'), content: await readFile(filename) })
      }
    }
  }
  await visit(root, 0)
  const manifestFile = files.find((file) => file.name === 'plugin.json')
  if (!manifestFile || manifestFile.content.length > 64 * 1024) throw new Error('Missing or oversized plugin.json.')
  const manifest = pluginManifestSchema.parse(JSON.parse(manifestFile.content.toString('utf8')))
  const entry = files.find((file) => file.name === (manifest.entry ?? 'main.js'))
  if (!entry || entry.content.length > 1024 * 1024) throw new Error('Missing entry file or entry exceeds 1 MiB.')
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(JSON.stringify([file.name, file.content.length]))
    hash.update(new Uint8Array(file.content))
  }
  return {
    directory: root, manifest, digest: hash.digest('hex'), source: entry.content.toString('utf8'),
    readme: files.find((file) => file.name === (manifest.readme ?? 'README.md'))?.content.toString('utf8').slice(0, 100_000) ?? 'No README included.',
  }
}
export type InspectedPlugin = Awaited<ReturnType<typeof inspectPlugin>>
