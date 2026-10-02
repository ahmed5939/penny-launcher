import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DataDirectory } from '../startup/data-directory'

/**
 * The Islands page's small JSON files: the player-count history behind the
 * hourly trend, the watchlist, the last Discover read (shown at once on the
 * next visit while a fresh one loads) and the discovery token per branch.
 *
 * Both are rewritten while the app runs (a refresh, a ten-minute check), so
 * writes go to a temporary file and are renamed into place — a crash
 * mid-write leaves the previous file, not half of one — and are queued per
 * file so two writers can never interleave.
 */

export type IslandsFile =
  | 'islands-history.json'
  | 'islands-watchlist.json'
  | 'islands-last.json'
  | 'islands-discovery-token.json'

const queues = new Map<IslandsFile, Promise<unknown>>()

export function islandsFilePath(name: IslandsFile) {
  return path.join(DataDirectory.getDataDirectoryPath(), name)
}

/** `null` when the file is missing or unreadable; callers start empty. */
export async function readIslandsFile(name: IslandsFile): Promise<unknown> {
  try {
    return JSON.parse(await readFile(islandsFilePath(name), 'utf8')) as unknown
  } catch {
    return null
  }
}

export function writeIslandsFile(name: IslandsFile, data: unknown) {
  const previous = queues.get(name) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const file = islandsFilePath(name)
      const temporary = `${file}.${randomUUID()}.tmp`

      await mkdir(path.dirname(file), { recursive: true })

      try {
        await writeFile(temporary, JSON.stringify(data), { encoding: 'utf8' })
        await rename(temporary, file)
      } finally {
        await rm(temporary, { force: true })
      }
    })

  queues.set(name, next)

  return next
}
