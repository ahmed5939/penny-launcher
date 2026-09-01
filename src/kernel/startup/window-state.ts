import { RuntimeLog } from '../runtime-log'
import type { BrowserWindow, Rectangle } from 'electron'

import { writeFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app, screen } from 'electron'

import { resolveLauncherDataDirectory } from '../launcher-paths'

type WindowStateData = {
  bounds: Rectangle
  maximized: boolean
  /**
   * False when we fell back to defaults. Without it, a window legitimately
   * parked at 0,0 — which is where snapping to the left half puts it — would
   * be indistinguishable from "never saved" and silently re-centre.
   */
  restored: boolean
}

const defaultBounds: Rectangle = {
  // Wide enough for the rail plus a content pane at its intended density,
  // rather than the pane collapsing on first run.
  height: 719,
  width: 1188,
  x: 0,
  y: 0,
}

/**
 * Remembers where the window was.
 *
 * Reopening at the same size and position on the same monitor is something
 * people only notice by its absence — every other desktop app does it, and
 * Penny previously re-centred at a fixed 1188x719 on every launch.
 *
 * Deliberately its own tiny JSON file rather than a field on settings: it is
 * written on every move and resize, and settings is validated, broadcast to
 * the renderer and read by half the app on each save.
 */
export class WindowState {
  private static filePath = path.join(
    resolveLauncherDataDirectory(app.getPath('appData')),
    'window-state.json',
  )

  private static saveTimer: NodeJS.Timeout | null = null

  /**
   * Reads the saved bounds, discarding them if they no longer land on a
   * connected display — unplugging a second monitor should not leave the
   * window stranded off-screen with no way to get it back.
   */
  static async restore(): Promise<WindowStateData> {
    try {
      const raw = await readFile(WindowState.filePath, {
        encoding: 'utf8',
      })
      const parsed = JSON.parse(raw) as Partial<WindowStateData>
      const bounds = parsed.bounds

      if (
        !bounds ||
        typeof bounds.width !== 'number' ||
        typeof bounds.height !== 'number' ||
        typeof bounds.x !== 'number' ||
        typeof bounds.y !== 'number'
      ) {
        return { bounds: defaultBounds, maximized: false, restored: false }
      }

      if (!WindowState.isOnSomeDisplay(bounds)) {
        return {
          bounds: { ...defaultBounds },
          maximized: parsed.maximized === true,
          restored: false,
        }
      }

      return {
        bounds,
        maximized: parsed.maximized === true,
        restored: true,
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return { bounds: defaultBounds, maximized: false, restored: false }
    }
  }

  /**
   * True when enough of the window overlaps a work area to be grabbable.
   */
  private static isOnSomeDisplay(bounds: Rectangle) {
    return screen.getAllDisplays().some(({ workArea }) => {
      const overlapX =
        Math.min(bounds.x + bounds.width, workArea.x + workArea.width) -
        Math.max(bounds.x, workArea.x)
      const overlapY =
        Math.min(bounds.y + bounds.height, workArea.y + workArea.height) -
        Math.max(bounds.y, workArea.y)

      return overlapX > 96 && overlapY > 48
    })
  }

  /**
   * Applies saved geometry to a window that has not been shown yet.
   */
  static apply(window: BrowserWindow, state: WindowStateData) {
    if (state.restored) {
      window.setBounds(state.bounds)
    }

    if (state.maximized) {
      window.maximize()
    }
  }

  /**
   * Starts persisting geometry. Writes are debounced because `resize` and
   * `move` fire continuously while a window is being dragged.
   */
  static track(window: BrowserWindow) {
    const save = () => {
      if (WindowState.saveTimer) {
        clearTimeout(WindowState.saveTimer)
      }

      WindowState.saveTimer = setTimeout(() => {
        WindowState.write(window).catch(() => {})
      }, 400)
    }

    window.on('resize', save)
    window.on('move', save)
    window.on('maximize', save)
    window.on('unmaximize', save)

    /**
     * Written synchronously here on purpose: with the tray enabled, closing
     * the window also quits the app, and an awaited write loses the race
     * against `app.quit()`.
     */
    window.on('close', () => {
      if (WindowState.saveTimer) {
        clearTimeout(WindowState.saveTimer)
        WindowState.saveTimer = null
      }

      const payload = WindowState.serialize(window)

      if (!payload) {
        return
      }

      try {
        writeFileSync(WindowState.filePath, payload, { encoding: 'utf8' })

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        RuntimeLog.error('caught:startup/window-state.ts', error)
      }
    })
  }

  private static serialize(window: BrowserWindow) {
    if (window.isDestroyed()) {
      return null
    }

    return JSON.stringify(
      {
        // `getNormalBounds` is the restored geometry, so maximising does not
        // overwrite the size the window should return to.
        bounds: window.getNormalBounds(),
        maximized: window.isMaximized(),
        restored: true,
      } satisfies WindowStateData,
      null,
      2,
    )
  }

  private static async write(window: BrowserWindow) {
    const payload = WindowState.serialize(window)

    if (!payload) {
      return
    }

    try {
      await writeFile(WindowState.filePath, payload, { encoding: 'utf8' })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/window-state.ts', error)
    }
  }
}
