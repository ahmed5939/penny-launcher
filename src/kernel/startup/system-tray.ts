import { RuntimeLog } from '../runtime-log'
import { app, Menu, nativeImage, Tray } from 'electron'
import path from 'node:path'

import type { TrayLaunchSummary } from '../core/discord-presence'

function trayLaunchLabels(summary: TrayLaunchSummary) {
  const hasAccount = Boolean(summary.primaryId)

  return {
    launchEnabled: hasAccount && !summary.gameRunning,
    launchLabel: !hasAccount
      ? 'Launch Fortnite'
      : summary.gameRunning
        ? 'Fortnite is running'
        : `Launch Fortnite — ${summary.primaryName ?? 'selected account'}`,
  }
}

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
      RuntimeLog.error('caught:startup/system-tray.ts', error)
    }
  }

  /**
   * The tray menu is where this app actually lives — with the window hidden,
   * it is the whole UI. Launching Fortnite for the selected account is the
   * one action that should not require restoring the window.
   */
  private static buildMenu(onOpen: () => Promise<void>) {
    if (!SystemTray.current) {
      return
    }

    const { primaryName, running, total } = SystemTray.summary
    const { launchEnabled, launchLabel } = trayLaunchLabels(
      SystemTray.summary
    )

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
          label: launchLabel,
          type: 'normal',
          enabled: launchEnabled,
          click: () => {
            void SystemTray.launchSelected().catch((error) => {
              RuntimeLog.error('tray:launch', error)
            })
          },
        },
        {
          label: 'Toggle quest overlay  Ctrl+Shift+Q',
          type: 'normal',
          click: () => {
            void import('./windows/overlay').then(({ OverlayWindow }) =>
              OverlayWindow.toggle()
            )
          },
        },
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
            void import('./windows/main').then(({ MainWindow }) =>
              MainWindow.closeApp()
            )
          },
        },
      ])
    )

    SystemTray.onOpenHandler = onOpen
  }

  /**
   * Official FortniteLauncher.exe only, same path Settings already stores.
   * Looks the account up in main so the tray never carries device secrets.
   */
  private static async launchSelected() {
    const accountId = SystemTray.summary.primaryId

    if (!accountId) {
      return
    }

    const [{ AccountsManager }, { FortniteLauncher }] = await Promise.all([
      import('./accounts'),
      import('../core/launcher'),
    ])
    const account = AccountsManager.getAccountById(accountId)

    if (!account) {
      return
    }

    FortniteLauncher.start(account).catch((error) => {
      RuntimeLog.error('caught:startup/system-tray.ts', error)
    })
  }

  private static onOpenHandler: (() => Promise<void>) | null = null

  private static summary: TrayLaunchSummary = {
    gameRunning: false,
    primaryId: null,
    primaryName: null,
    running: [],
    total: 0,
  }

  /**
   * Called by the renderer whenever the scope or a running service changes.
   */
  static updateSummary(summary: TrayLaunchSummary) {
    SystemTray.summary = summary
    void import('../core/discord-presence')
      .then(({ DiscordPresence }) =>
        DiscordPresence.setAccountName(summary.primaryName)
      )
      .catch((error) => RuntimeLog.error('tray:presence', error))

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
