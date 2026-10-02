import type { SpriteCollection } from './sprite-collection'
import type {
  CatalogueStatus,
  SpriteEvent,
  SpriteHistoryFile,
  SpriteHistoryPayload,
} from './sprite-history-model'

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { spriteModuleVersion } from '../../services/config/sprites'

import { AccountsManager } from '../startup/accounts'
import { DataDirectory } from '../startup/data-directory'
import { NativeNotifications } from '../startup/notifications'
import { MainWindow } from '../startup/windows/main'
import { RuntimeLog } from '../runtime-log'
import {
  buildHistoryPayload,
  catalogueStatus,
  clampWatchInterval,
  emptySpriteHistory,
  normaliseSpriteHistory,
  observeCatalogue,
  recordSnapshot,
  snapshotFromCollection,
  summariseBatch,
} from './sprite-history-model'

/**
 * The sprite collection over time, on disk, and the background watch.
 *
 * `sprite-history.json` holds the last snapshot of every account, the change
 * log between snapshots and the relic ids the catalogue has listed. The
 * arithmetic is `sprite-history-model.ts`; this owns the file, the timer and
 * the pushes to the renderer.
 *
 * The watch is opt-in and costs nothing until switched on: at startup the
 * file is read once and, unless it says the watch is on, no timer is armed.
 */

export type {
  CatalogueStatus,
  SpriteAccountSummary,
  SpriteEvent,
  SpriteEventKind,
  SpriteHistoryPayload,
  SpriteWatchSettings,
} from './sprite-history-model'

/**
 * How soon the first sweep after startup may run. Long enough that the
 * sweep never competes with the app's own start-up requests.
 */
const warmUpMs = 90 * 1000

export class SpriteHistory {
  private static file: SpriteHistoryFile | null = null
  private static loading: Promise<SpriteHistoryFile> | null = null
  private static queue: Promise<unknown> = Promise.resolve()
  private static timer: NodeJS.Timeout | null = null
  private static lastSweepAt: number | null = null

  /**
   * The catalogue version this session reads, and why it is not the
   * configured one. Session state, not file state: the probe is redone on
   * every launch so an app update that follows Epic clears the note.
   */
  private static catalogueVersion = Number(spriteModuleVersion)
  private static versionNote: string | null = null

  private static get filePath() {
    return path.join(
      DataDirectory.getDataDirectoryPath(),
      'sprite-history.json'
    )
  }

  /** Every successful inventory read goes through here — never a failed one. */
  static async record(
    account: { accountId: string; displayName: string },
    collection: SpriteCollection,
    { notify = false }: { notify?: boolean } = {}
  ) {
    let events: Array<SpriteEvent> = []

    await SpriteHistory.mutate((file) => {
      const result = recordSnapshot(
        file,
        account.accountId,
        snapshotFromCollection(collection)
      )

      events = result.events

      return result.file
    })

    /*
     * Only the background watch toasts. A read the user asked for is on
     * screen already, and a toast about what they are looking at is noise.
     */
    if (notify && events.length > 0) {
      const body = summariseBatch(events, account.displayName)

      if (body) {
        NativeNotifications.send({ title: 'Sprites', body })
      }
    }

    return events
  }

  /** Fold a fresh catalogue read in; a no-op unless a relic is new. */
  static async observeCatalogue(relicIds: Array<string>) {
    await SpriteHistory.mutate((file) => {
      const catalogue = observeCatalogue(file.catalogue, relicIds)

      return catalogue === file.catalogue ? file : { ...file, catalogue }
    })
  }

  static setCatalogueVersion(version: number, note: string | null) {
    if (
      version === SpriteHistory.catalogueVersion &&
      note === SpriteHistory.versionNote
    ) {
      return
    }

    SpriteHistory.catalogueVersion = version
    SpriteHistory.versionNote = note
    void SpriteHistory.request()
  }

  static async catalogueStatus(): Promise<CatalogueStatus> {
    const file = await SpriteHistory.load()

    return catalogueStatus(file.catalogue, {
      version: SpriteHistory.catalogueVersion,
      versionNote: SpriteHistory.versionNote,
    })
  }

  static async payload(): Promise<SpriteHistoryPayload> {
    const file = await SpriteHistory.load()

    return buildHistoryPayload(file, await SpriteHistory.catalogueStatus())
  }

  /** Answer a renderer request, and every change, on the same channel. */
  static async request() {
    SpriteHistory.send(await SpriteHistory.payload())
  }

  static async setWatch(enabled: boolean, intervalMinutes?: unknown) {
    await SpriteHistory.mutate((file) => ({
      ...file,
      watch: {
        enabled,
        intervalMinutes:
          intervalMinutes === undefined
            ? file.watch.intervalMinutes
            : clampWatchInterval(intervalMinutes),
      },
    }))

    RuntimeLog.info(
      'core/sprite-history.ts',
      `watch ${enabled ? 'on' : 'off'}`
    )

    await SpriteHistory.schedule()
  }

  /** Called once accounts are loaded. Safe to call again. */
  static async startWatch() {
    if (SpriteHistory.timer) {
      return
    }

    await SpriteHistory.schedule()
  }

  /**
   * One timer, re-armed after each sweep finishes rather than on a fixed
   * interval, so a slow sweep can never run into the next one.
   *
   * The first sweep of a session is due one interval after the stalest
   * account was last read — a launch after a night off sweeps soon, a
   * restart a minute after a sweep waits. After that it is simply one
   * interval after the last sweep, which keeps an account that fails every
   * time from pulling the next sweep forward.
   */
  private static async schedule() {
    if (SpriteHistory.timer) {
      clearTimeout(SpriteHistory.timer)
      SpriteHistory.timer = null
    }

    const file = await SpriteHistory.load()

    if (!file.watch.enabled) {
      return
    }

    const intervalMs = file.watch.intervalMinutes * 60 * 1000
    const stalest = Math.min(
      ...[...AccountsManager.getAccounts().keys()].map(
        (accountId) => Date.parse(file.accounts[accountId]?.updatedAt ?? '') || 0
      ),
      Date.now()
    )
    const last = SpriteHistory.lastSweepAt ?? stalest
    const delay = Math.min(
      intervalMs,
      Math.max(warmUpMs, last + intervalMs - Date.now())
    )

    SpriteHistory.timer = setTimeout(() => {
      SpriteHistory.timer = null
      void SpriteHistory.sweep()
    }, delay)
    SpriteHistory.timer.unref()
  }

  private static async sweep() {
    try {
      /*
       * Imported here, not at the top: `sprites.ts` imports this module, and
       * the watch is the only reason this one ever needs that one.
       */
      const { Sprites } = await import('./sprites')

      await Sprites.requestAll(false, { background: true })
    } catch (error) {
      RuntimeLog.error('caught:core/sprite-history.ts (watch)', error)
    } finally {
      SpriteHistory.lastSweepAt = Date.now()
      await SpriteHistory.schedule().catch((error: unknown) => {
        RuntimeLog.error('caught:core/sprite-history.ts (schedule)', error)
      })
    }
  }

  private static load() {
    if (SpriteHistory.file) {
      return Promise.resolve(SpriteHistory.file)
    }

    SpriteHistory.loading ??= SpriteHistory.read().then((file) => {
      SpriteHistory.file = file

      return file
    })

    return SpriteHistory.loading
  }

  private static async read(): Promise<SpriteHistoryFile> {
    try {
      return normaliseSpriteHistory(
        JSON.parse(await readFile(SpriteHistory.filePath, 'utf8'))
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        RuntimeLog.error('caught:core/sprite-history.ts (read)', error)

        // Set aside rather than overwritten by the next write, in case the
        // history is worth recovering by hand.
        await rename(
          SpriteHistory.filePath,
          `${SpriteHistory.filePath}.unreadable`
        ).catch(() => undefined)
      }

      return emptySpriteHistory()
    }
  }

  /**
   * Changes are applied one at a time, in order, so a sweep recording seven
   * accounts and a catalogue read landing in between cannot overwrite each
   * other. The renderer is told after each change that made one.
   */
  private static mutate(
    change: (file: SpriteHistoryFile) => SpriteHistoryFile
  ) {
    const run = SpriteHistory.queue.then(async () => {
      const current = await SpriteHistory.load()
      const next = change(current)

      if (next === current) {
        return current
      }

      SpriteHistory.file = next
      await SpriteHistory.write(next)
      SpriteHistory.send(
        buildHistoryPayload(next, await SpriteHistory.catalogueStatus())
      )

      return next
    })

    SpriteHistory.queue = run.catch(() => undefined)

    return run
  }

  /** Write-then-rename, so a crash mid-write leaves the old file whole. */
  private static async write(file: SpriteHistoryFile) {
    const target = SpriteHistory.filePath
    const temporary = `${target}.${randomUUID()}.tmp`

    try {
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(temporary, JSON.stringify(file), { encoding: 'utf8' })
      await rename(temporary, target)
    } catch (error) {
      RuntimeLog.error('caught:core/sprite-history.ts (write)', error)
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  }

  private static send(payload: SpriteHistoryPayload) {
    const window = MainWindow.instance

    if (window && !window.isDestroyed()) {
      window.webContents.send(
        ElectronAPIEventKeys.SpritesHistoryResponse,
        payload
      )
    }
  }
}
