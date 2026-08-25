import { app, Menu, nativeImage, Tray } from 'electron'
import path from 'node:path'

import { MainWindow } from './windows/main'

export class SystemTray {
  private static current: Tray | null = null
  private static active = false

  static get isActive() {
    return SystemTray.active
  }

  static setIsActive(value: boolean) {
    SystemTray.active = value
  }

  static async create({ onOpen }: { onOpen: () => Promise<void> }) {
    if (SystemTray.current !== null) {
      return
    }

    try {
      /**
       * Ships with the app rather than being fetched from GitHub at startup:
       * the old remote fetch pulled the upstream Aerial mark and, because the
       * whole method swallows errors, left users with no tray icon at all
       * when offline. The .ico carries proper 16/24/32px frames, so Windows
       * does not have to downscale a 256px source.
       */
      const iconPath = path.join(app.getAppPath(), 'icon-transparent.ico')
      const icon = nativeImage.createFromPath(iconPath)

      SystemTray.current = new Tray(
        icon.isEmpty()
          ? nativeImage.createFromPath(
              path.join(app.getAppPath(), 'icon-transparent.png')
            )
          : icon
      )

      SystemTray.buildMenu(onOpen)
      SystemTray.current.setToolTip('Penny')
      SystemTray.current.setTitle('Penny')

      SystemTray.current.addListener('click', () => {
        onOpen()
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }
  }

  /**
   * The tray menu is where this app actually lives — with the window hidden,
   * it is the whole UI. "Open" and "Exit" was not a menu, it was a shortcut.
   * This one answers what is in scope and what is running without restoring
   * the window at all.
   */
  private static buildMenu(onOpen: () => Promise<void>) {
    if (!SystemTray.current) {
      return
    }

    const { primaryName, running, total } = SystemTray.summary

    SystemTray.current.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: primaryName ? `Scope: ${primaryName}` : 'No account in scope',
          type: 'normal',
          enabled: false,
        },
        ...(total > 1
          ? [
              {
                label: `and ${total - 1} more account${total - 1 === 1 ? '' : 's'}`,
                type: 'normal' as const,
                enabled: false,
              },
            ]
          : []),
        { type: 'separator' },
        {
          label:
            running.length > 0
              ? `Running: ${running.join(', ')}`
              : 'Nothing running',
          type: 'normal',
          enabled: false,
        },
        { type: 'separator' },
        {
          label: 'Open Penny',
          type: 'normal',
          click: () => {
            onOpen()
          },
        },
        {
          label: 'Exit',
          type: 'normal',
          click: () => {
            MainWindow.closeApp()
          },
        },
      ])
    )

    SystemTray.onOpenHandler = onOpen
  }

  private static onOpenHandler: (() => Promise<void>) | null = null

  private static summary: {
    primaryName: string | null
    running: Array<string>
    total: number
  } = { primaryName: null, running: [], total: 0 }

  /**
   * Called by the renderer whenever the scope or a running service changes.
   */
  static updateSummary(summary: {
    primaryName: string | null
    running: Array<string>
    total: number
  }) {
    SystemTray.summary = summary

    if (SystemTray.current && SystemTray.onOpenHandler) {
      SystemTray.buildMenu(SystemTray.onOpenHandler)
    }
  }

  static destroy() {
    SystemTray.current?.removeAllListeners()
    SystemTray.current?.destroy()
    SystemTray.current = null
  }
}
