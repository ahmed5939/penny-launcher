import { RuntimeLog } from '../runtime-log'
import type { BrowserWindow } from 'electron'

import path from 'node:path'
import { app, nativeImage } from 'electron'

/**
 * The taskbar is a surface Penny owns and was not using.
 *
 * This app runs multi-minute bulk jobs across eight accounts and is designed
 * to sit minimised in the tray while automations tick — which is exactly the
 * situation the Windows shell has affordances for and a browser tab does not.
 * Progress, a badge, buttons on the hover preview, and a jump list all work
 * while the window is hidden.
 */
export class Taskbar {
  private static window: BrowserWindow | null = null

  static attach(window: BrowserWindow) {
    Taskbar.window = window
    Taskbar.setThumbarButtons(false)
  }

  private static get target() {
    const current = Taskbar.window

    return current && !current.isDestroyed() ? current : null
  }

  /**
   * Fills the taskbar icon during a bulk run.
   *
   * Electron overloads one number with three modes: below 0 removes the bar,
   * 0–1 is a fraction, and above 1 is indeterminate. Callers get those as
   * distinct intents rather than magic numbers, and the fraction is clamped so
   * a rounding error cannot tip a 100%-complete run into "indeterminate".
   */
  static setProgress(value: number | null | 'indeterminate') {
    const target = Taskbar.target

    if (!target) {
      return
    }

    if (value === null) {
      target.setProgressBar(-1)

      return
    }

    if (value === 'indeterminate') {
      target.setProgressBar(2)

      return
    }

    target.setProgressBar(Math.min(1, Math.max(0, value)))
  }

  /**
   * Overlay badge — the small icon in the corner of the taskbar button.
   *
   * The image is drawn in the renderer and arrives as a data URL, because
   * `nativeImage` cannot rasterise vector art and shipping a PNG per possible
   * count is obviously not on.
   */
  static setBadge(dataUrl: string | null, description: string) {
    const target = Taskbar.target

    if (!target) {
      return
    }

    try {
      target.setOverlayIcon(
        dataUrl ? nativeImage.createFromDataURL(dataUrl) : null,
        description,
      )

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Overlay icons are Windows-only; elsewhere this is simply not a thing.
    }
  }

  /**
   * Buttons on the taskbar's hover preview. Deliberately only two: this strip
   * is for the thing you would otherwise restore the window to do.
   */
  static setThumbarButtons(isBusy: boolean) {
    const target = Taskbar.target

    if (!target) {
      return
    }

    const icon = (name: string) =>
      nativeImage
        .createFromPath(path.join(app.getAppPath(), name))
        .resize({ height: 16, width: 16 })

    try {
      target.setThumbarButtons([
        {
          click: () => {
            target.show()
            target.focus()
          },
          icon: icon('icon-transparent.png'),
          tooltip: isBusy ? 'Penny is working — open' : 'Open Penny',
        },
      ])

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/taskbar.ts', error)
    }
  }

  /**
   * Right-click the taskbar icon and jump straight to an account.
   *
   * Each task relaunches the executable with `--scope=<accountId>`; the
   * single-instance lock turns that into a `second-instance` event carrying
   * the argv, which `main.ts` reads to move the scope. No new window, no
   * second copy of the app.
   */
  static setJumpList(
    accounts: Array<{ accountId: string; displayName: string }>,
  ) {
    if (process.platform !== 'win32') {
      return
    }

    try {
      if (accounts.length === 0) {
        app.setJumpList(null)

        return
      }

      app.setJumpList([
        {
          type: 'custom',
          name: 'Accounts',
          items: accounts.slice(0, 6).map(({ accountId, displayName }) => ({
            type: 'task' as const,
            title: displayName,
            description: `Switch Penny to ${displayName}`,
            program: process.execPath,
            args: `--scope=${accountId}`,
          })),
        },
      ])

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // A jump list can be refused outright by group policy.
    }
  }

  /**
   * Pulls the account id out of a relaunch argv, if there is one.
   */
  static readScopeArgument(argv: Array<string>) {
    const found = argv.find((argument) => argument.startsWith('--scope='))

    return found ? (found.split('=')[1] ?? null) : null
  }
}
