import type {
  SaveWorldInfoData,
  WorldInfoFileData,
} from '../types/data/advanced-mode/world-info'
import type {
  AccountBasicInfo,
  AccountData,
  AccountDataList,
  AccountDataRecord,
  AccountList,
} from '../types/accounts'
import type { AlertsDoneSearchPlayerConfig } from '../types/alerts'
import type { FriendsActionPayload } from './core/friends-manager'
import type { ItemActionRequest } from './core/item-actions'
import type { LoadoutEditRequest } from './core/loadouts'
import type { LockerCardFilters } from './core/locker'
import type { OutpostBaseData, OutpostZoneInfo } from './core/outpost-types'
import type { LockerSlotKey } from '../config/fortnite/locker'
import type { SquadAssignment } from './core/squads'
import type { AuthenticationByDeviceProperties } from '../types/authentication'
import type { AutomationServiceActionConfig } from '../types/automation'
import type {
  FnLaunchSettings,
  GameSettings,
} from '../types/fn-launch'
import type { CustomizableMenuSettings, Settings } from '../types/settings'
import type { GameInstallOpenTarget } from '../types/game-install'
import type { EnduranceConfig } from '../types/endurance'
import type { TaxiServiceServiceActionConfig } from '../types/taxi-service'
import type { Event as ElectronEvent } from 'electron'
import type {
  XPBoostsConsumePersonalData,
  XPBoostsConsumeTeammateData,
  XPBoostsSearchUserConfig,
} from '../types/xpboosts'
import type {
  AutoLlamasAccountAddParams,
  AutoLlamasAccountUpdateParams,
} from '../state/stw-operations/auto/llamas'

import path from 'node:path'
import { app, BrowserWindow, Menu, shell } from 'electron'

import { ElectronAPIEventKeys } from '../config/constants/main-process'

import { MainWindow } from './startup/windows/main'
import { OverlayWindow } from './startup/windows/overlay'
import { PluginBridge } from './startup/plugin-api'
import { SystemTray } from './startup/system-tray'
import { Taskbar } from './startup/taskbar'
import {
  NativeNotifications,
  type NativeNotificationPayload,
} from './startup/notifications'
import {
  NativeContextMenu,
  type ContextMenuRequestItem,
} from './startup/context-menu'
import {
  titleBarHeight,
  WindowChrome,
} from './startup/window-chrome'
import { Appearance } from './startup/appearance'
import { WindowState } from './startup/window-state'
import { RuntimeLog } from './runtime-log'
import { secureIpcHandle, secureIpcOn } from './secure-ipc'
import {
  isAllowedRendererNavigation,
  parseSecureExternalUrl,
} from './security'

import { Language } from '../locales/resources'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) {
  app.quit()
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.squirrel.penny-launcher.Penny')
}

const gotTheLock = app.requestSingleInstanceLock()
const processCreatedAt = process.getCreationTime() ?? Date.now()
const markStartup = (name: string) => {
  RuntimeLog.info(`startup:${name}`, `${Date.now() - processCreatedAt}ms`)
}

const features = {
  accountHealth: () => import('./core/account-health'),
  accounts: () => import('./startup/accounts'),
  alerts: () => import('./core/alerts'),
  application: () => import('./startup/application'),
  authentication: () => import('./core/authentication'),
  autoExpeditions: () => import('./startup/auto-expeditions'),
  autoLlamas: () => import('./startup/auto-llamas'),
  autoPinUrns: () => import('./startup/auto-pin-urns'),
  automation: () => import('./startup/automation'),
  claimRewards: () => import('./core/claim-rewards'),
  customProcess: () => import('./core/custom-process'),
  dataDirectory: () => import('./startup/data-directory'),
  endurance: () => import('./core/endurance'),
  eula: () => import('./core/eula-tracking'),
  expeditions: () => import('./core/expeditions'),
  fnLaunch: () => import('./core/fn-launch'),
  friends: () => import('./core/friends-manager'),
  gameInstall: () => import('./startup/game-install'),
  gifts: () => import('./core/gifts-information'),
  inventory: () => import('./core/inventory'),
  itemActions: () => import('./core/item-actions'),
  itemDatabase: () => import('./core/item-database'),
  launcher: () => import('./core/launcher'),
  leaderboard: () => import('./core/leaderboard'),
  loadouts: () => import('./core/loadouts'),
  locker: () => import('./core/locker'),
  sprites: () => import('./core/sprites'),
  manifest: () => import('./core/manifest'),
  matchmaking: () => import('./core/matchmaking-track'),
  mcp: () => import('./core/mcp'),
  party: () => import('./core/party'),
  pennyDb: () => import('./core/pennydb-missions'),
  quests: () => import('./core/quests'),
  redeemCodes: () => import('./core/redeem-codes'),
  serverStatus: () => import('./core/server-status'),
  settings: () => import('./startup/settings'),
  shop: () => import('./core/shop'),
  squads: () => import('./core/squads'),
  taxi: () => import('./startup/taxi-service'),
  timeline: () => import('./core/timeline'),
  vbucks: () => import('./core/vbucks-information'),
  worldInfo: () => import('./core/world-info'),
  xpBoosts: () => import('./core/xpboosts'),
} as const

process.on('unhandledRejection', (error) => {
  RuntimeLog.error('unhandled-rejection', error)
})

process.on('uncaughtExceptionMonitor', (error) => {
  RuntimeLog.error('uncaught-exception', error)
})

;(() => {
  if (!gotTheLock) {
    return app.quit()
  }

  const createWindow = async () => {
    await Appearance.restore()
    const savedState = await WindowState.restore()
    const appearance = Appearance.resolvedTheme

    // Create the browser window.
    const mainWindow = new BrowserWindow({
      center: true,
      /**
       * `frame: false` used to mean two hand-drawn buttons and no maximize at
       * all — which also cost Snap Layouts, since Windows only attaches that
       * flyout to caption buttons it drew itself. `hidden` + an overlay keeps
       * Penny's wordmark and search in the strip while handing the buttons
       * back to the OS.
       */
      titleBarStyle: 'hidden',
      titleBarOverlay: WindowChrome.overlay(appearance),
      height: savedState.bounds.height,
      width: savedState.bounds.width,
      minHeight: 400,
      minWidth: 600,
      // Packaging sets the executable icon, but only this makes the taskbar
      // and Alt-Tab show Penny when running unpackaged.
      icon: path.join(app.getAppPath(), 'icon-transparent.ico'),
      // Avoid a white flash on launch: keep the window hidden until the
      // renderer has painted its first frame, and paint a backdrop underneath
      // in the meantime so the reveal is seamless.
      show: false,
      backgroundColor: WindowChrome.backgroundColor(appearance),
      ...(WindowChrome.supportsMica
        ? { backgroundMaterial: 'mica' as const }
        : {}),
      webPreferences: {
        contextIsolation: true,
        devTools: !app.isPackaged,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: true,
        spellcheck: false,
        webSecurity: true,
        additionalArguments: [
          `--penny-theme-source=${Appearance.themeSource}`,
          `--penny-theme=${appearance}`,
        ],
      },
    })

    Appearance.attach(mainWindow)
    markStartup('window-created')

    const openExternal = async (rawUrl: string) => {
      const url = parseSecureExternalUrl(rawUrl)

      if (url) await shell.openExternal(url.toString())
    }

    const rendererFilePath = path.join(
      __dirname,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
    )
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      void openExternal(url)
      return { action: 'deny' }
    })

    const guardNavigation = (event: ElectronEvent, url: string) => {
      if (
        !isAllowedRendererNavigation(url, {
          devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
          rendererFilePath,
        })
      ) {
        event.preventDefault()
        void openExternal(url)
      }
    }

    mainWindow.webContents.on('will-navigate', guardNavigation)
    mainWindow.webContents.on('will-redirect', guardNavigation)
    mainWindow.webContents.on('context-menu', (_event, params) => {
      NativeContextMenu.popupEditable(mainWindow.webContents, params)
    })

    WindowState.apply(mainWindow, savedState)
    WindowState.track(mainWindow)

    /**
     * The caption buttons are now the system's, so the tray behaviour can no
     * longer live in IPC handlers behind our own buttons — it has to intercept
     * the window's events instead. Both branches keep exactly the semantics
     * the hand-drawn buttons had: minimise hides to tray, close quits.
     */
    mainWindow.on('minimize', () => {
      if (SystemTray.isActive) {
        mainWindow.hide()
      }
    })

    mainWindow.on('close', () => {
      if (SystemTray.isActive) {
        MainWindow.closeApp()
      }
    })

    /**
     * Tells the renderer which chrome it is sitting in, so the shell can go
     * translucent for Mica and reflect maximised state in its own layout.
     */
    const sendChromeState = () => {
      if (mainWindow.isDestroyed()) {
        return
      }

      mainWindow.webContents.send(ElectronAPIEventKeys.WindowChromeState, {
        maximized: mainWindow.isMaximized(),
        mica: WindowChrome.supportsMica,
        titleBarHeight,
      })
    }

    mainWindow.on('maximize', sendChromeState)
    mainWindow.on('unmaximize', sendChromeState)

    let rendererRecoveryAttempts = 0
    let rendererRecoveryReset: NodeJS.Timeout | null = null
    const recoverRenderer = () => {
      if (rendererRecoveryAttempts >= 2 || mainWindow.isDestroyed()) return

      rendererRecoveryAttempts += 1
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.reload()
      }, rendererRecoveryAttempts * 1_000)
    }

    mainWindow.webContents.on('did-finish-load', () => {
      markStartup('renderer-loaded')
      if (rendererRecoveryReset) clearTimeout(rendererRecoveryReset)
      rendererRecoveryReset = setTimeout(() => {
        rendererRecoveryAttempts = 0
      }, 60_000)
      sendChromeState()
    })
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      RuntimeLog.error('renderer-process-gone', new Error(details.reason))
      recoverRenderer()
    })
    mainWindow.webContents.on(
      'did-fail-load',
      (_event, code, description, validatedURL, isMainFrame) => {
        if (isMainFrame) {
          RuntimeLog.error(
            'renderer-load-failed',
            new Error(`${code} ${description} ${validatedURL}`)
          )
          recoverRenderer()
        }
      }
    )
    mainWindow.on('unresponsive', () => {
      RuntimeLog.error(
        'renderer-unresponsive',
        new Error('Window stopped responding.')
      )
    })

    Taskbar.attach(mainWindow)

    mainWindow.once('ready-to-show', () => {
      markStartup('first-frame')
      mainWindow.show()
    })

    // Manifest discovery can touch many files under ProgramData. Never keep
    // it on the first-paint path; apply it when available instead.
    void features.manifest()
      .then(({ Manifest }) => Manifest.getData())
      .then((manifest) => {
        if (manifest && !mainWindow.isDestroyed()) {
          mainWindow.webContents.setUserAgent(manifest.UserAgent)
        }
      })
      .catch((error) => {
        RuntimeLog.error('startup:manifest', error)
      })

    // and load the index.html of the app.
    // Loading continues while the ready handler registers IPC. Waiting for a
    // full renderer load here made startup serial and allowed early renderer
    // effects to race handlers that had not been registered yet.
    void (async () => {
      try {
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
          await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)

          mainWindow.webContents.openDevTools({ mode: 'undocked' })
        } else {
          await mainWindow.loadFile(rendererFilePath)
        }
      } catch (error) {
        if ((error as { errno?: number })?.errno !== -3) {
          RuntimeLog.error('startup:renderer-load', error)
          return
        }

        RuntimeLog.error('startup:renderer-load-superseded', error)
      }
    })()

    return mainWindow
  }

  Menu.setApplicationMenu(null)

  app.on('second-instance', (_event, argv) => {
    // Someone tried to run a second instance, we should focus our window.
    if (MainWindow.instance) {
      /**
       * Jump-list entries relaunch the executable with `--scope=<accountId>`,
       * which the single-instance lock turns into this event. Forwarding it to
       * the renderer is what makes "right-click the taskbar icon, land on
       * Vexbolt" work without opening a second copy of the app.
       */
      const requestedScope = Taskbar.readScopeArgument(argv)

      if (requestedScope) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ScopeRequest,
          requestedScope
        )
      }

      MainWindow.showAndFocus()
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', async () => {
    markStartup('app-ready')
    MainWindow.setInstance(await createWindow())
    void OverlayWindow.start().catch((error) => {
      RuntimeLog.error('overlay:start', error)
    })

    void import('./startup/power-lifecycle').then(({ PowerLifecycle }) =>
      PowerLifecycle.start()
    )
    void import('./startup/updater').then(({ AppUpdater }) =>
      AppUpdater.schedule()
    )

    void features.dataDirectory()
      .then(({ DataDirectory }) => DataDirectory.createDataResources())
      .catch((error) => {
        RuntimeLog.error('startup:data-resources', error)
      })

    /**
     * Plugins
     */

    import('./startup/plugins').then(({ PluginManager }) => PluginManager.load()).catch((error) => {
      RuntimeLog.error('startup:plugins', error)
    })

    let dailyQuestsRun: Promise<void> | null = null
    const runAutoDailyQuests = () => {
      dailyQuestsRun ??= (async () => {
        const [
          { SettingsManager },
          { AccountsManager },
          { MCPClientQuestLogin },
        ] = await Promise.all([
          features.settings(),
          features.accounts(),
          features.mcp(),
        ])
        const settings = await SettingsManager.getData()

        if (!settings.autoDailyQuests) return

        const accounts = AccountsManager.getAccounts()

        if (accounts.size > 0) {
          await MCPClientQuestLogin.save([...accounts.values()])
        }
      })().finally(() => {
        dailyQuestsRun = null
      })

      return dailyQuestsRun
    }

    secureIpcHandle(ElectronAPIEventKeys.PluginsList, () =>
      import('./startup/plugins').then(({ PluginManager }) => PluginManager.list())
    )

    secureIpcHandle(ElectronAPIEventKeys.PluginsMarketplaceList, () =>
      import('./startup/plugins').then(({ PluginManager }) => PluginManager.marketplace())
    )

    secureIpcHandle(ElectronAPIEventKeys.PluginInstall, (_, pluginId: string) =>
      import('./startup/plugins').then(({ PluginManager }) => PluginManager.install(pluginId))
    )

    secureIpcHandle(ElectronAPIEventKeys.PluginRemove, (_, pluginId: string) =>
      import('./startup/plugins').then(({ PluginManager }) => PluginManager.remove(pluginId))
    )

    secureIpcHandle(ElectronAPIEventKeys.PluginReadme, (_, pluginId: string) =>
      import('./startup/plugins').then(({ PluginManager }) => PluginManager.readme(pluginId))
    )

    secureIpcHandle(ElectronAPIEventKeys.PluginsDirectoryOpen, () =>
      import('./startup/plugins').then(({ PluginManager }) => PluginManager.openDirectory())
    )

    secureIpcHandle(ElectronAPIEventKeys.PluginOpen, (_, pluginId: string) =>
      import('./startup/plugins').then(({ PluginManager }) => PluginManager.open(pluginId))
    )

    secureIpcOn(
      ElectronAPIEventKeys.PluginAccountScopeSync,
      (_, scope: unknown) => {
        PluginBridge.setAccountScope(scope)
        OverlayWindow.setAccountScope(scope)
      }
    )

    /**
     * Endurance
     */

    secureIpcHandle(ElectronAPIEventKeys.EnduranceStatusRequest, async () => {
      const [
        { EnduranceAutomation },
        { endurancePointDefinitions, enduranceZones },
      ] = await Promise.all([
        features.endurance(),
        import('./core/endurance/config'),
      ])

      return {
        config: await EnduranceAutomation.getConfig(),
        pointDefinitions: endurancePointDefinitions,
        status: EnduranceAutomation.getStatus(),
        zones: enduranceZones,
      }
    })

    secureIpcOn(
      ElectronAPIEventKeys.EnduranceStart,
      async (_, account: AccountData) => {
        const { EnduranceAutomation } = await features.endurance()
        EnduranceAutomation.start(account).catch((error) => {
          RuntimeLog.error('endurance:start', error)
        })
      }
    )

    secureIpcOn(ElectronAPIEventKeys.EnduranceStop, async () => {
      const { EnduranceAutomation } = await features.endurance()
      EnduranceAutomation.stop()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.EnduranceConfigUpdate,
      async (_, partial: Partial<EnduranceConfig>) => {
        const { EnduranceAutomation } = await features.endurance()
        return EnduranceAutomation.updateConfig(partial)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.EnduranceCalibrateStart,
      async (_, pointId: string) => {
        const { EnduranceAutomation } = await features.endurance()
        EnduranceAutomation.startCalibration(pointId).catch((error) => {
          RuntimeLog.error('endurance:calibration', error)
        })
      }
    )

    secureIpcOn(ElectronAPIEventKeys.EnduranceCalibrateCancel, async () => {
      const { EnduranceAutomation } = await features.endurance()
      EnduranceAutomation.cancelCalibration()
    })

    /**
     * Settings
     */

    secureIpcOn(ElectronAPIEventKeys.AppLanguageRequest, async () => {
      const { AppLanguage } = await features.settings()
      await AppLanguage.load()
    })

    secureIpcOn(
      ElectronAPIEventKeys.AppLanguageUpdate,
      async (_, language: Language) => {
        const { AppLanguage } = await features.settings()
        await AppLanguage.update(language)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.RequestAccounts, async () => {
      const { AccountsManager } = await features.accounts()
      await AccountsManager.load()

      // Accounts are visible now. Background account services can hydrate
      // afterward instead of delaying the renderer's account list.
      void features.autoExpeditions()
        .then(({ AutoExpeditions }) =>
          AutoExpeditions.ensureStarted([
            ...AccountsManager.getAccounts().keys(),
          ])
        )
        .catch((error) =>
          RuntimeLog.error('startup:auto-expeditions', error)
        )
      void runAutoDailyQuests().catch((error) =>
        RuntimeLog.error('startup:auto-daily-quests', error)
      )
    })

    secureIpcOn(ElectronAPIEventKeys.RequestSettings, async () => {
      const { SettingsManager } = await features.settings()
      await SettingsManager.load()
    })

    secureIpcOn(ElectronAPIEventKeys.DevSettingsRequest, async () => {
      const { DevSettingsManager } = await features.settings()
      await DevSettingsManager.load()
    })

    secureIpcOn(
      ElectronAPIEventKeys.CustomizableMenuSettingsRequest,
      async () => {
        const { CustomizableMenuSettingsManager } = await features.settings()
        await CustomizableMenuSettingsManager.load()
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.UpdateSettings,
      async (_, settings: Settings) => {
        const { SettingsManager } = await features.settings()
        await SettingsManager.update(settings)
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.SettingsDetectPath, async () => {
      const { GameInstallManager } = await features.gameInstall()
      return GameInstallManager.detectAndApply()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.GameInstallStatus,
      async (_, forceLatest?: boolean) => {
        const { GameInstallManager } = await features.gameInstall()
        return GameInstallManager.getStatus(forceLatest === true)
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.GameInstallDetect, async () => {
      const { GameInstallManager } = await features.gameInstall()
      return GameInstallManager.detectAndApply()
    })

    secureIpcHandle(ElectronAPIEventKeys.GameInstallChooseFolder, async () => {
      const { GameInstallManager } = await features.gameInstall()
      return GameInstallManager.chooseFolder()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.GameInstallOpenOfficial,
      async (_, target: GameInstallOpenTarget) => {
        if (target !== 'updater' && target !== 'egl' && target !== 'xbox') {
          return { ok: false, method: 'none' }
        }

        const { GameInstallManager } = await features.gameInstall()
        return GameInstallManager.openOfficialApp(target)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AccountsOrderingSync,
      async (_, accounts: AccountDataRecord) => {
        const { AccountsManager } = await features.accounts()
        await AccountsManager.reorder(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.CustomizableMenuSettingsUpdate,
      async (_, key: keyof CustomizableMenuSettings, visibility: boolean) => {
        const { CustomizableMenuSettingsManager } = await features.settings()
        await CustomizableMenuSettingsManager.update(key, visibility)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.CustomProcessKill, async () => {
      const { CustomProcess } = await features.customProcess()
      await CustomProcess.kill()
    })

    /**
     * General Methods
     */

    secureIpcOn(ElectronAPIEventKeys.OpenExternalURL, (_, url: string) => {
      if (typeof url !== 'string' || url.length > 2_048) {
        return
      }

      try {
        const parsed = new URL(url)

        if (
          parsed.protocol !== 'https:' ||
          parsed.username ||
          parsed.password
        ) {
          return
        }

        void shell.openExternal(parsed.toString())
      } catch {
        // Ignore malformed URLs from the renderer.
      }
    })

    secureIpcOn(ElectronAPIEventKeys.CloseWindow, () => {
      if (SystemTray.isActive) {
        MainWindow.closeApp()
      } else {
        MainWindow.instance.close()
      }
    })

    secureIpcOn(ElectronAPIEventKeys.MinimizeWindow, () => {
      if (SystemTray.isActive) {
        MainWindow.instance.hide()
      } else {
        MainWindow.instance.minimize()
      }
    })

    /**
     * Windows shell surfaces
     */

    secureIpcOn(
      ElectronAPIEventKeys.TaskbarProgress,
      (_, value: number | null | 'indeterminate') => {
        Taskbar.setProgress(value)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaskbarBadge,
      (_, dataUrl: string | null, description: string) => {
        Taskbar.setBadge(dataUrl, description)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaskbarJumpList,
      (_, accounts: Array<{ accountId: string; displayName: string }>) => {
        Taskbar.setJumpList(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.NativeNotify,
      (_, payload: NativeNotificationPayload) => {
        NativeNotifications.send(payload)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TraySummary,
      (
        _,
        summary: {
          gameRunning: boolean
          primaryId: string | null
          primaryName: string | null
          running: Array<string>
          total: number
        }
      ) => {
        SystemTray.updateSummary(summary)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ContextMenuPopup,
      (event, requestId: string, items: Array<ContextMenuRequestItem>) => {
        NativeContextMenu.popup(event.sender, requestId, items)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.MaximizeWindow, () => {
      if (MainWindow.instance.isMaximized()) {
        MainWindow.instance.unmaximize()
      } else {
        MainWindow.instance.maximize()
      }
    })

    /**
     * The caption buttons are drawn by Windows, so their colours do not follow
     * the renderer's theme class — they have to be repainted explicitly.
     */
    secureIpcOn(ElectronAPIEventKeys.AppearanceSet, (_, theme) => {
      Appearance.set(theme)
    })

    /**
     * Events
     */

    secureIpcOn(
      ElectronAPIEventKeys.OnRemoveAccount,
      async (_, accountId: string) => {
        const { AccountsManager } = await features.accounts()
        await AccountsManager.remove(accountId)
      }
    )

    /**
     * Requests
     */

    // secureIpcOn(
    //   ElectronAPIEventKeys.RequestProviderAndAccessTokenOnStartup,
    //   async (_, account: AccountData) => {
    //     const response = await AntiCheatProvider.request(account)

    //     MainWindow.instance.webContents.send(
    //       ElectronAPIEventKeys.ResponseProviderAndAccessTokenOnStartup,
    //       response
    //     )
    //   }
    // )

    /**
     * Authentication
     */

    secureIpcOn(
      ElectronAPIEventKeys.CreateAuthWithExchange,
      async (_, code: string) => {
        const { Authentication } = await features.authentication()
        await Authentication.exchange(code)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.CreateAuthWithAuthorization,
      async (_, code: string) => {
        const { Authentication } = await features.authentication()
        await Authentication.authorization(code)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.CreateAuthWithDevice,
      async (_, data: AuthenticationByDeviceProperties) => {
        const { Authentication } = await features.authentication()
        await Authentication.device(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ImportAccountsFromAerial,
      async () => {
        const { AccountsManager } = await features.accounts()
        await AccountsManager.importFromAerial()
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.OpenEpicGamesSettings,
      async (_, account: AccountData) => {
        const { Authentication } = await features.authentication()
        await Authentication.openEpicGamesSettings(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.GenerateExchangeCode,
      async (_, account: AccountData) => {
        const { Authentication } = await features.authentication()
        await Authentication.generateExchangeCode(account)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.CheckAllAccountStatuses, async () => {
      const { Authentication } = await features.authentication()
      await Authentication.checkAllAccounts()
    })

    secureIpcOn(ElectronAPIEventKeys.RequestNewVersionStatus, async () => {
      const { Application } = await features.application()
      await Application.checkVersion()
    })

    /**
     * Launcher
     */

    secureIpcOn(
      ElectronAPIEventKeys.LauncherStart,
      async (_, account: AccountData) => {
        const { FortniteLauncher } = await features.launcher()
        await FortniteLauncher.start(account)
      }
    )

    /**
     * STW Operations
     */

    secureIpcOn(ElectronAPIEventKeys.ServerStatusRequest, async () => {
      const { ServerStatus } = await features.serverStatus()
      await ServerStatus.request()
    })

    /**
     * FN Launch
     */

    secureIpcHandle(ElectronAPIEventKeys.FnLaunchSettingsRequest, async () => {
      const { getLaunchSettings } = await features.fnLaunch()
      return getLaunchSettings()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.FnLaunchSettingsUpdate,
      async (_, settings: FnLaunchSettings) => {
        const { saveLaunchSettings } = await features.fnLaunch()
        await saveLaunchSettings(settings)

        return { success: true }
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FnLaunchGameSettingsRequest,
      async () => {
        const { getGameSettings } = await features.fnLaunch()
        return getGameSettings()
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FnLaunchGameSettingsUpdate,
      async (_, partial: Partial<GameSettings>) => {
        const { saveGameSettings } = await features.fnLaunch()
        return saveGameSettings(partial)
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FnLaunchGameSettingsRestore,
      async () => {
        const { restoreGameSettingsBackup } = await features.fnLaunch()
        return restoreGameSettingsBackup()
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AccountHealthRequest,
      async (_, accounts: Array<AccountData>) => {
        const { AccountHealth } = await features.accountHealth()
        await AccountHealth.request(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ExpeditionsRequest,
      async (_, accounts: Array<AccountData>) => {
        const { Expeditions } = await features.expeditions()
        await Expeditions.request(accounts)
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.AutoExpeditionsStatus, async () => {
      const { AutoExpeditions } = await features.autoExpeditions()
      return AutoExpeditions.getData()
    })
    secureIpcHandle(
      ElectronAPIEventKeys.AutoExpeditionsUpdate,
      async (
        _,
        accountId: string,
        partial: Partial<import('./startup/auto-expeditions').AutoExpeditionConfig>
      ) => {
        const { AutoExpeditions } = await features.autoExpeditions()
        return AutoExpeditions.update(accountId, partial)
      }
    )
    secureIpcHandle(
      ElectronAPIEventKeys.AutoExpeditionsEnsureStarted,
      async (_, accountIds: Array<string>) => {
        const { AutoExpeditions } = await features.autoExpeditions()
        return AutoExpeditions.ensureStarted(accountIds)
      }
    )
    secureIpcOn(ElectronAPIEventKeys.ItemDatabaseRequest, async () => {
      const { ItemDatabase } = await features.itemDatabase()
      await ItemDatabase.request()
    })

    secureIpcOn(ElectronAPIEventKeys.ItemDatabaseRefresh, async () => {
      const { ItemDatabase } = await features.itemDatabase()
      await ItemDatabase.request(true)
    })

    secureIpcOn(ElectronAPIEventKeys.TimelineRequest, async () => {
      const { Timeline } = await features.timeline()
      await Timeline.request()
    })

    secureIpcOn(
      ElectronAPIEventKeys.LeaderboardRequest,
      async (_, metric: string, force?: boolean) => {
        const { Leaderboard } = await features.leaderboard()
        await Leaderboard.request(metric, Boolean(force))
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LoadoutsRequest,
      async (_, account: AccountData) => {
        const { Loadouts } = await features.loadouts()
        await Loadouts.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LoadoutEdit,
      async (_, account: AccountData, request: LoadoutEditRequest) => {
        const { Loadouts } = await features.loadouts()
        await Loadouts.edit(account, request)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ItemAction,
      async (_, account: AccountData, request: ItemActionRequest) => {
        const { ItemActions } = await features.itemActions()
        await ItemActions.perform(account, request)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.QuestsRequest,
      async (_, account: AccountData) => {
        const { Quests } = await features.quests()
        await Quests.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.QuestsPin,
      async (_, account: AccountData, pinnedQuestIds: Array<string>) => {
        const { Quests } = await features.quests()
        await Quests.pin(account, pinnedQuestIds)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.InventoryRequest,
      async (_, accounts: Array<AccountData>) => {
        const { Inventory } = await features.inventory()
        await Inventory.request(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.InventoryRecycle,
      async (
        _,
        accounts: Array<AccountData>,
        selection: Record<string, Array<string>>
      ) => {
        const { Inventory } = await features.inventory()
        await Inventory.recycle(accounts, selection)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ShopRequest,
      async (_, accounts: Array<AccountData>) => {
        const { Shop } = await features.shop()
        await Shop.request(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ShopPurchase,
      async (
        _,
        account: AccountData,
        offer: {
          offerId: string
          title: string
          currency: string
          currencySubType: string
          finalPrice: number
          quantity: number
        }
      ) => {
        const { Shop } = await features.shop()
        await Shop.purchase(account, offer)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ShopOpen,
      async (_, accounts: Array<AccountData>) => {
        const { Shop } = await features.shop()
        await Shop.openLlamas(accounts)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.ShopCatalogRequest, async () => {
      const { Shop } = await features.shop()
      await Shop.requestCatalog()
    })

    secureIpcOn(
      ElectronAPIEventKeys.LockerRequest,
      async (_, account: AccountData) => {
        const { Locker } = await features.locker()
        await Locker.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerOwnedRequest,
      async (_, account: AccountData, refresh: boolean) => {
        const { Locker } = await features.locker()
        await Locker.requestOwned(account, refresh)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerCompanionsRequest,
      async (_, account: AccountData, refresh: boolean) => {
        const { Locker } = await features.locker()
        await Locker.requestCompanions(account, refresh)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.SpritesRequest,
      async (_, account: AccountData, refresh: boolean) => {
        const { Sprites } = await features.sprites()
        await Sprites.request(account, refresh)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerEquip,
      async (
        _,
        account: AccountData,
        slotKey: LockerSlotKey,
        templateId: string | null,
        itemName: string
      ) => {
        const { Locker } = await features.locker()
        await Locker.equip(account, slotKey, templateId, itemName)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerCardGenerate,
      async (_, account: AccountData, filters: LockerCardFilters) => {
        const { Locker } = await features.locker()
        await Locker.generateCard(account, filters)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerCardOpen,
      async (_, filePath: string) => {
        const { Locker } = await features.locker()
        await Locker.openCard(filePath)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerCardExport,
      async (_, filePath: string, fileName: string) => {
        const { Locker } = await features.locker()
        await Locker.exportCard(filePath, fileName)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.SquadsRequest,
      async (_, account: AccountData) => {
        const { Squads } = await features.squads()
        await Squads.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.SquadsAssign,
      async (_, account: AccountData, assignments: Array<SquadAssignment>) => {
        const { Squads } = await features.squads()
        await Squads.assign(account, assignments)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.FriendsManagerRequest,
      async (_, account: AccountData) => {
        const { FriendsManager } = await features.friends()
        await FriendsManager.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.FriendsManagerSearch,
      async (_, account: AccountData, query: string) => {
        const { FriendsManager } = await features.friends()
        await FriendsManager.search(account, query)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.FriendsManagerAction,
      async (
        _,
        account: AccountData,
        targetAccountId: string,
        action: FriendsActionPayload['action']
      ) => {
        const { FriendsManager } = await features.friends()
        await FriendsManager.action(account, targetAccountId, action)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.FriendsManagerBulkAction,
      async (
        _,
        account: AccountData,
        targetAccountIds: Array<string>,
        action: 'add' | 'remove'
      ) => {
        const { FriendsManager } = await features.friends()
        await FriendsManager.bulkAction(account, targetAccountIds, action)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsAccountProfileRequest,
      async (_, accounts: Array<AccountData>) => {
        const { XPBoostsManager } = await features.xpBoosts()
        await XPBoostsManager.requestAccounts(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsConsumePersonal,
      async (_, data: XPBoostsConsumePersonalData) => {
        const { XPBoostsManager } = await features.xpBoosts()
        await XPBoostsManager.consumePersonal(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsConsumeTeammate,
      async (_, data: XPBoostsConsumeTeammateData) => {
        const { XPBoostsManager } = await features.xpBoosts()
        await XPBoostsManager.consumeTeammate(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsSearchUser,
      async (_, config: XPBoostsSearchUserConfig) => {
        const { XPBoostsManager } = await features.xpBoosts()
        await XPBoostsManager.searchUser(
          ElectronAPIEventKeys.XPBoostsSearchUserNotification,
          config
        )
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsGeneralSearchUser,
      async (_, config: XPBoostsSearchUserConfig) => {
        const { XPBoostsManager } = await features.xpBoosts()
        await XPBoostsManager.generalSearchUser(config)
      }
    )

    /**
     * Party
     */

    secureIpcOn(
      ElectronAPIEventKeys.PartyClaimAction,
      async (_, selectedAccount: Array<AccountData>) => {
        const { ClaimRewards } = await features.claimRewards()
        await ClaimRewards.start(selectedAccount)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.PartyKickAction,
      async (
        _,
        selectedAccount: AccountData,
        accounts: AccountDataList,
        claimState: boolean
      ) => {
        const { Party } = await features.party()
        await Party.kickPartyMembers(selectedAccount, accounts, claimState, {
          force: true,
        })
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.PartyLeaveAction,
      async (
        _,
        selectedAccounts: AccountList,
        accounts: AccountDataList,
        claimState: boolean
      ) => {
        const { Party } = await features.party()
        await Party.leaveParty(selectedAccounts, accounts, claimState)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.PartyLoadFriends, async () => {
      const { Party } = await features.party()
      await Party.loadFriends()
    })

    secureIpcOn(
      ElectronAPIEventKeys.PartyAddNewFriendAction,
      async (_, account: AccountData, displayName: string) => {
        const { Party } = await features.party()
        await Party.addNewFriend(account, displayName)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.PartyInviteAction,
      async (_, account: AccountData, accountIds: Array<string>) => {
        const { Party } = await features.party()
        await Party.invite(account, accountIds)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.PartyRemoveFriendAction,
      async (
        _,
        data: {
          accountId: string
          displayName: string
        }
      ) => {
        const { Party } = await features.party()
        await Party.removeFriend(data)
      }
    )

    /**
     * Advanced Mode
     */

    secureIpcOn(
      ElectronAPIEventKeys.HomeFetchPlayerRequest,
      async (_, config: AlertsDoneSearchPlayerConfig) => {
        const { AlertsDone } = await features.alerts()
        await AlertsDone.fetchPlayerData(config)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.HomeWorldInfoRequest,
      async (_, accountId?: string) => {
        const { WorldInfoManager } = await features.worldInfo()
        await WorldInfoManager.requestForHome(accountId)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.HomePennyDBMissionsRequest, async () => {
      const { PennyDBMissions } = await features.pennyDb()
      await PennyDBMissions.request()
    })

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoRequestData,
      async (_, accountId?: string) => {
        const { WorldInfoManager } = await features.worldInfo()
        await WorldInfoManager.requestForAdvanceSection(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoSaveFile,
      async (_, data: SaveWorldInfoData) => {
        const { WorldInfoManager } = await features.worldInfo()
        await WorldInfoManager.saveFile(data)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.WorldInfoRequestFiles, async () => {
      const { WorldInfoManager } = await features.worldInfo()
      await WorldInfoManager.requestFiles()
    })

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoDeleteFile,
      async (_, data: WorldInfoFileData) => {
        const { WorldInfoManager } = await features.worldInfo()
        await WorldInfoManager.deleteFile(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoExportFile,
      async (_, data: WorldInfoFileData) => {
        const { WorldInfoManager } = await features.worldInfo()
        await WorldInfoManager.exportWorldInfoFile(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoOpenFile,
      async (_, data: WorldInfoFileData) => {
        const { WorldInfoManager } = await features.worldInfo()
        await WorldInfoManager.openWorldInfoFile(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoRenameFile,
      async (_, data: WorldInfoFileData, newFilename: string) => {
        const { WorldInfoManager } = await features.worldInfo()
        await WorldInfoManager.renameFile(data, newFilename)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.MatchmakingTrackStatus,
      async (_, account: AccountData, accountId: string) => {
        const { MatchmakingTrack } = await features.matchmaking()
        await MatchmakingTrack.status(account, accountId)
      }
    )

    /**
     * Outpost
     */

    secureIpcHandle(
      ElectronAPIEventKeys.OutpostInfoRequest,
      async (_, account: AccountData) => {
        const { Outpost } = await import('./core/outpost')

        return Outpost.requestInfo(account)
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.OutpostBaseRequest,
      async (_, account: AccountData, saveFile: string) => {
        const { Outpost } = await import('./core/outpost')

        return Outpost.requestBaseData(account, saveFile)
      }
    )

    /**
     * File Tweaks — hidden behind a personal key; every handler refuses
     * work until the gate is unlocked (session memory only).
     */

    secureIpcHandle(ElectronAPIEventKeys.FileTweaksUnlock, (_, key: string) => {
      return import('./core/file-tweaks/gate').then((module) =>
        module.fileTweaksUnlock(key)
      )
    })

    secureIpcHandle(ElectronAPIEventKeys.FileTweaksLockStatus, async () => {
      const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

      return fileTweaksIsUnlocked()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksDevBuildsStatus,
      async () => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { found: false, activated: false, error: 'locked' }
        }

        const { getDevBuildsStatus } = await import(
          './core/file-tweaks/dev-builds'
        )

        return getDevBuildsStatus()
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksDevBuildsToggle,
      async () => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { success: false, message: 'locked' }
        }

        const { toggleDevBuilds } = await import(
          './core/file-tweaks/dev-builds'
        )

        return toggleDevBuilds()
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksDevStairsStatus,
      async () => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { found: false, activated: false, error: 'locked' }
        }

        const { getDevStairsStatus } = await import(
          './core/file-tweaks/dev-stairs'
        )

        return getDevStairsStatus()
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksDevStairsToggle,
      async () => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { success: false, message: 'locked' }
        }

        const { toggleDevStairs } = await import(
          './core/file-tweaks/dev-stairs'
        )

        return toggleDevStairs()
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksAirStrikeStatus,
      async () => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { found: false, activated: false, error: 'locked' }
        }

        const { getAirStrikeStatus } = await import(
          './core/file-tweaks/airstrike'
        )

        return getAirStrikeStatus()
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksAirStrikeToggle,
      async () => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { success: false, message: 'locked' }
        }

        const { toggleAirStrike } = await import(
          './core/file-tweaks/airstrike'
        )

        return toggleAirStrike()
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.FileTweaksTrapsData, async () => {
      const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

      if (!fileTweaksIsUnlocked()) {
        return { base: null, families: {}, heightScale: [], modified: [], namedConfigs: [], traps: [] }
      }

      const {
        getBaseStatus,
        getModifiedTraps,
        getTrapFamilyInfo,
        getTrapHeightScale,
        getTrapList,
        getTrapNamedConfigs,
      } = await import('./core/file-tweaks/trap-height')

      return {
        base: await getBaseStatus(),
        families: getTrapFamilyInfo(),
        heightScale: getTrapHeightScale(),
        modified: getModifiedTraps(),
        namedConfigs: getTrapNamedConfigs(),
        traps: getTrapList(),
      }
    })

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksTrapStatus,
      async (_, guid: string) => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { currentHeight: null, found: false, isModified: false }
        }

        const { getTrapStatus } = await import('./core/file-tweaks/trap-height')

        return getTrapStatus(guid)
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksTrapApply,
      async (_, guid: string, heightHex: string) => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { success: false, message: 'locked' }
        }

        const { applyTrapHeight } = await import(
          './core/file-tweaks/trap-height'
        )

        return applyTrapHeight(guid, heightHex)
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksTrapRevert,
      async (_, guid: string) => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { success: false, message: 'locked' }
        }

        const { revertTrapHeight } = await import(
          './core/file-tweaks/trap-height'
        )

        return revertTrapHeight(guid)
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksTrapsRevertAll,
      async () => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { success: false, message: 'locked' }
        }

        const { revertAllTrapHeights } = await import(
          './core/file-tweaks/trap-height'
        )

        return revertAllTrapHeights()
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.FileTweaksBaseStatus, async () => {
      const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

      if (!fileTweaksIsUnlocked()) {
        return { currentHeight: '', found: false, isModified: false }
      }

      const { getBaseStatus } = await import('./core/file-tweaks/trap-height')

      return getBaseStatus()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksBaseApply,
      async (_, uuValue: number) => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { success: false, message: 'locked' }
        }

        const { applyBaseHeight } = await import(
          './core/file-tweaks/trap-height'
        )

        return applyBaseHeight(uuValue)
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.FileTweaksBaseRevert, async () => {
      const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

      if (!fileTweaksIsUnlocked()) {
        return { success: false, message: 'locked' }
      }

      const { revertBaseHeight } = await import(
        './core/file-tweaks/trap-height'
      )

      return revertBaseHeight()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.FileTweaksWorkerPower,
      async (_, account: AccountData, mode: 'high' | 'low') => {
        const { fileTweaksIsUnlocked } = await import('./core/file-tweaks/gate')

        if (!fileTweaksIsUnlocked()) {
          return { success: false, error: 'locked' }
        }

        const { generateWorkerPower } = await import(
          './core/file-tweaks/worker-power'
        )

        return generateWorkerPower(account, mode)
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.OutpostReportExport,
      async (
        _,
        displayName: string,
        zone: OutpostZoneInfo,
        baseData: OutpostBaseData
      ) => {
        const { Outpost } = await import('./core/outpost')

        return Outpost.exportReadableReport(displayName, zone, baseData)
      }
    )

    /**
     * Automation
     */

    secureIpcOn(ElectronAPIEventKeys.AutomationServiceRequestData, async () => {
      const { Automation } = await features.automation()
      await Automation.load()
    })

    secureIpcOn(
      ElectronAPIEventKeys.AutomationServiceStart,
      async (_, accountId: string) => {
        const { Automation } = await features.automation()
        await Automation.addAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutomationServiceReload,
      async (_, accountId: string) => {
        const { Automation } = await features.automation()
        await Automation.reload(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutomationServiceRemove,
      async (_, accountId: string) => {
        const { Automation } = await features.automation()
        await Automation.removeAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutomationServiceActionUpdate,
      async (_, accountId: string, config: AutomationServiceActionConfig) => {
        const { Automation } = await features.automation()
        await Automation.updateAction(accountId, config)
      }
    )

    /**
     * Taxi Service
     */

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceAddAccounts,
      async (_, origin: Array<string>, destination: Array<string>) => {
        const { TaxiService } = await features.taxi()
        await TaxiService.sendRequests(origin, destination)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceRequestData,
      async () => {
        const { TaxiService } = await features.taxi()
        await TaxiService.load()
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceStart,
      async (_, accountId: string) => {
        const { TaxiService } = await features.taxi()
        await TaxiService.addAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceReload,
      async (_, ids: Array<string>) => {
        const { TaxiService } = await features.taxi()
        await TaxiService.reload(ids)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceRemove,
      async (_, accountId: string) => {
        const { TaxiService } = await features.taxi()
        await TaxiService.removeAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceActionUpdate,
      async (_, accountId: string, config: TaxiServiceServiceActionConfig) => {
        const { TaxiService } = await features.taxi()
        await TaxiService.updateAction(accountId, config)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceWhitelistAdd,
      async (_, accountId: string, displayName: string) => {
        const { TaxiService } = await features.taxi()
        await TaxiService.addWhitelist(accountId, displayName)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceWhitelistRemove,
      async (_, accountId: string, targetId: string) => {
        const { TaxiService } = await features.taxi()
        await TaxiService.removeWhitelist(accountId, targetId)
      }
    )

    /**
     * Urns
     */

    secureIpcOn(ElectronAPIEventKeys.UrnsServiceRequestData, async () => {
      const { AutoPinUrns } = await features.autoPinUrns()
      await AutoPinUrns.load()
    })

    secureIpcOn(
      ElectronAPIEventKeys.UrnsServiceAdd,
      async (_, accountId: string) => {
        const { AutoPinUrns } = await features.autoPinUrns()
        await AutoPinUrns.addAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.UrnsServiceUpdate,
      async (
        _,
        accountId: string,
        templateId: string,
        value: boolean
      ) => {
        const { AutoPinUrns } = await features.autoPinUrns()
        await AutoPinUrns.updateAccount(accountId, templateId, value)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.UrnsServiceRemove,
      async (_, accountId: string) => {
        const { AutoPinUrns } = await features.autoPinUrns()
        await AutoPinUrns.removeAccount(accountId)
      }
    )

    /**
     * Auto-llamas
     */

    secureIpcOn(
      ElectronAPIEventKeys.AutoLlamasLoadAccountsRequest,
      async () => {
        const {
          AutoLlamas,
          ProcessAutoLlamas,
          ProcessLlamaType,
        } = await features.autoLlamas()
        await AutoLlamas.load()

        ProcessAutoLlamas.start({
          selected: AutoLlamas.getAccounts({
            type: ProcessLlamaType.FreeUpgrade,
          }),
          type: ProcessLlamaType.FreeUpgrade,
        })

        ProcessAutoLlamas.start({
          selected: AutoLlamas.getAccounts({
            type: ProcessLlamaType.Survivor,
          }),
          type: ProcessLlamaType.Survivor,
        })
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutoLlamasAccountAdd,
      async (_, accounts: AutoLlamasAccountAddParams) => {
        const { AutoLlamas } = await features.autoLlamas()
        await AutoLlamas.addAccount(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutoLlamasAccountUpdate,
      async (_, data: AutoLlamasAccountUpdateParams) => {
        const { AutoLlamas } = await features.autoLlamas()
        await AutoLlamas.updateAccounts(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutoLlamasAccountRemove,
      async (_, data: Array<string> | null) => {
        const { AutoLlamas } = await features.autoLlamas()
        await AutoLlamas.removeAccounts(data)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.AutoLlamasAccountCheck, async () => {
      const { AutoLlamas } = await features.autoLlamas()
      await AutoLlamas.check()
    })

    /**
     * V-Bucks Information
     */

    secureIpcOn(
      ElectronAPIEventKeys.VBucksInformationRequest,
      async (_, accounts: Array<AccountData>) => {
        const { VBucksInformation } = await features.vbucks()
        await VBucksInformation.requestBulkInfo(accounts)
      }
    )

    /**
     * Gifts Information
     */

    secureIpcOn(
      ElectronAPIEventKeys.GiftsInformationRequest,
      async (_, accounts: Array<AccountData>) => {
        const { GiftsInformation } = await features.gifts()
        await GiftsInformation.requestBulkInfo(accounts)
      }
    )

    /**
     * Redeem Codes
     */

    secureIpcOn(
      ElectronAPIEventKeys.RedeemCodesRedeem,
      async (_, accounts: Array<AccountData>, codes: Array<string>) => {
        const { RedeemCodes } = await features.redeemCodes()
        await RedeemCodes.redeem(accounts, codes)
      }
    )

    /**
     * Accounts
     */

    secureIpcOn(
      ElectronAPIEventKeys.UpdateAccountBasicInfo,
      async (_, account: AccountBasicInfo) => {
        const { AccountsManager } = await features.accounts()
        await AccountsManager.add(account)
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ResponseUpdateAccountBasicInfo
        )
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.EULAVerificationRequest,
      async (_, accountIds: Array<string>) => {
        const { EULATracking } = await features.eula()
        await EULATracking.verify(accountIds)
      }
    )

    /**
     * Schedules
     */

    // Scheduling is intentionally loaded after the first frame. It is useful
    // background work, but it should never compete with the launch path.
    setTimeout(() => {
      void import('node-schedule').then(({ default: schedule }) => {
        schedule.scheduleJob({ rule: '10 0 0 * * *', tz: 'UTC' }, () => {
          void features.worldInfo().then(({ WorldInfoManager }) => {
            WorldInfoManager.requestForHome().catch((error) => {
              RuntimeLog.error('schedule:world-info-home', error)
            })
            WorldInfoManager.requestForAdvanceSection().catch((error) => {
              RuntimeLog.error('schedule:world-info-advanced', error)
            })
          })
        })

        const processLlamas = async (type: 'free-upgrade' | 'survivor') => {
          const {
            AutoLlamas,
            ProcessAutoLlamas,
            ProcessLlamaType,
          } = await features.autoLlamas()
          const processType =
            type === 'survivor'
              ? ProcessLlamaType.Survivor
              : ProcessLlamaType.FreeUpgrade

          ProcessAutoLlamas.start({
            selected: AutoLlamas.getAccounts({ type: processType }),
            type: processType,
          })
        }

        schedule.scheduleJob({ rule: '1 * * * *', tz: 'UTC' }, () => {
          void processLlamas('free-upgrade')
        })
        schedule.scheduleJob({ rule: '1 0 * * *', tz: 'UTC' }, () => {
          void processLlamas('survivor')
        })
        schedule.scheduleJob(
          { rule: '0 1 0 * * *', tz: 'UTC' },
          runAutoDailyQuests
        )
      })
    }, 2_500)
  })

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (!SystemTray.isActive) {
      MainWindow.closeApp()
    }
  })

  app.on('activate', async () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      MainWindow.setInstance(await createWindow())
      const { AutoExpeditions } = await features.autoExpeditions()
      AutoExpeditions.start()
    }
  })

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and import them here.
})()
