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

import path from 'node:path'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import dayjs from 'dayjs'
import { app, BrowserWindow, Menu, shell } from 'electron'
import schedule from 'node-schedule'

import { ElectronAPIEventKeys } from '../config/constants/main-process'

import { AccountHealth } from './core/account-health'
import { AlertsDone } from './core/alerts'
// import { AntiCheatProvider } from './core/anti-cheat-provider'
import { Authentication } from './core/authentication'
import { ClaimRewards } from './core/claim-rewards'
import {
  endurancePointDefinitions,
  enduranceZones,
} from './core/endurance/config'
import { EULATracking } from './core/eula-tracking'
import { Expeditions } from './core/expeditions'
import { AutoExpeditions } from './startup/auto-expeditions'
import { FortniteLauncher } from './core/launcher'
import { FriendsManager } from './core/friends-manager'
import {
  getGameSettings,
  getLaunchSettings,
  restoreGameSettingsBackup,
  saveGameSettings,
  saveLaunchSettings as saveFnLaunchSettings,
} from './core/fn-launch'
import { GiftsInformation } from './core/gifts-information'
import { Inventory } from './core/inventory'
import { ItemActions } from './core/item-actions'
import { Leaderboard } from './core/leaderboard'
import { Loadouts } from './core/loadouts'
import { Locker } from './core/locker'
import { MCPClientQuestLogin } from './core/mcp'
import { MatchmakingTrack } from './core/matchmaking-track'
import { Manifest } from './core/manifest'
import { Party } from './core/party'
import { PennyDBMissions } from './core/pennydb-missions'
import { Quests } from './core/quests'
import { RedeemCodes } from './core/redeem-codes'
import { ServerStatus } from './core/server-status'
import { Shop } from './core/shop'
import { Squads } from './core/squads'
import { Timeline } from './core/timeline'
import { VBucksInformation } from './core/vbucks-information'
import { WorldInfoManager } from './core/world-info'
import { XPBoostsManager } from './core/xpboosts'
import { MainWindow } from './startup/windows/main'
import { AccountsManager } from './startup/accounts'
import { Application } from './startup/application'
import {
  AutoLlamas,
  ProcessAutoLlamas,
  ProcessLlamaType,
} from './startup/auto-llamas'
import { AutoPinUrns } from './startup/auto-pin-urns'
import { Automation } from './startup/automation'
import { DataDirectory } from './startup/data-directory'
import { GameInstallManager } from './startup/game-install'
import { PluginBridge } from './startup/plugin-api'
import {
  AppLanguage,
  CustomizableMenuSettingsManager,
  DevSettingsManager,
  SettingsManager,
} from './startup/settings'
import { SystemTray } from './startup/system-tray'
import { TaxiService } from './startup/taxi-service'
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
  type WindowChromeTheme,
} from './startup/window-chrome'
import { WindowState } from './startup/window-state'
import { RuntimeLog } from './runtime-log'
import { secureIpcHandle, secureIpcOn } from './secure-ipc'
import {
  isAllowedRendererNavigation,
  parseSecureExternalUrl,
} from './security'

import {
  AutoLlamasAccountAddParams,
  AutoLlamasAccountUpdateParams,
} from '../state/stw-operations/auto/llamas'

import { Language } from '../locales/resources'
import { CustomProcess } from './core/custom-process'

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(timezone)
dayjs.extend(utc)

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) {
  app.quit()
}

const gotTheLock = app.requestSingleInstanceLock()

const loadEndurance = () => import('./core/endurance')
const loadItemDatabase = () => import('./core/item-database')

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
    const savedState = await WindowState.restore()

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
      titleBarOverlay: WindowChrome.overlay('dark'),
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
      backgroundColor: WindowChrome.backgroundColor,
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
      },
    })

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
      mainWindow.show()
    })

    // Manifest discovery can touch many files under ProgramData. Never keep
    // it on the first-paint path; apply it when available instead.
    void Manifest.getData().then((manifest) => {
      if (manifest && !mainWindow.isDestroyed()) {
        mainWindow.webContents.setUserAgent(manifest.UserAgent)
      }
    })

    // and load the index.html of the app.
    try {
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)

        // Open DevTools only once the first navigation has settled. Opening an
        // undocked window beforehand aborts the in-flight load, and that
        // rejection used to escape createWindow() and abort app.on('ready')
        // before a single IPC channel was registered.
        mainWindow.webContents.openDevTools({
          mode: 'undocked',
        })
      } else {
        await mainWindow.loadFile(rendererFilePath)
      }
    } catch (error) {
      // ERR_ABORTED (-3) only means a newer navigation superseded this one, so
      // the window still ends up loaded. Startup must survive it either way:
      // everything registered after this point depends on it.
      if ((error as { errno?: number })?.errno !== -3) {
        throw error
      }

      RuntimeLog.error('startup:renderer-load-superseded', error)
    }

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

      if (SystemTray.isActive) {
        if (!MainWindow.instance.isVisible()) {
          MainWindow.instance.show()
        }
      } else {
        if (MainWindow.instance.isMinimized()) {
          MainWindow.instance.restore()
        }
      }

      MainWindow.instance.focus()
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', async () => {
    DataDirectory.createDataResources().catch((error) => {
      RuntimeLog.error('startup:data-resources', error)
    })

    MainWindow.setInstance(await createWindow())

    /**
     * Plugins
     */

    import('./startup/plugins').then(({ PluginManager }) => PluginManager.load()).catch((error) => {
      RuntimeLog.error('startup:plugins', error)
    })

    let dailyQuestsRun: Promise<void> | null = null
    const runAutoDailyQuests = () => {
      dailyQuestsRun ??= (async () => {
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
      }
    )

    /**
     * Endurance
     */

    secureIpcHandle(ElectronAPIEventKeys.EnduranceStatusRequest, async () => {
      const { EnduranceAutomation } = await loadEndurance()

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
        const { EnduranceAutomation } = await loadEndurance()
        EnduranceAutomation.start(account).catch((error) => {
          RuntimeLog.error('endurance:start', error)
        })
      }
    )

    secureIpcOn(ElectronAPIEventKeys.EnduranceStop, async () => {
      const { EnduranceAutomation } = await loadEndurance()
      EnduranceAutomation.stop()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.EnduranceConfigUpdate,
      async (_, partial: Partial<EnduranceConfig>) => {
        const { EnduranceAutomation } = await loadEndurance()
        return EnduranceAutomation.updateConfig(partial)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.EnduranceCalibrateStart,
      async (_, pointId: string) => {
        const { EnduranceAutomation } = await loadEndurance()
        EnduranceAutomation.startCalibration(pointId).catch((error) => {
          RuntimeLog.error('endurance:calibration', error)
        })
      }
    )

    secureIpcOn(ElectronAPIEventKeys.EnduranceCalibrateCancel, async () => {
      const { EnduranceAutomation } = await loadEndurance()
      EnduranceAutomation.cancelCalibration()
    })

    /**
     * Settings
     */

    secureIpcOn(ElectronAPIEventKeys.AppLanguageRequest, async () => {
      await AppLanguage.load()
    })

    secureIpcOn(
      ElectronAPIEventKeys.AppLanguageUpdate,
      async (_, language: Language) => {
        await AppLanguage.update(language)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.RequestAccounts, async () => {
      await AccountsManager.load()
      await AutoExpeditions.ensureStarted([
        ...AccountsManager.getAccounts().keys(),
      ])
      await runAutoDailyQuests()
    })

    secureIpcOn(ElectronAPIEventKeys.RequestSettings, async () => {
      await SettingsManager.load()
    })

    secureIpcOn(ElectronAPIEventKeys.DevSettingsRequest, async () => {
      await DevSettingsManager.load()
    })

    secureIpcOn(
      ElectronAPIEventKeys.CustomizableMenuSettingsRequest,
      async () => {
        await CustomizableMenuSettingsManager.load()
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.UpdateSettings,
      async (_, settings: Settings) => {
        await SettingsManager.update(settings)
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.SettingsDetectPath, () => {
      return GameInstallManager.detectAndApply()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.GameInstallStatus,
      (_, forceLatest?: boolean) => {
        return GameInstallManager.getStatus(forceLatest === true)
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.GameInstallDetect, () => {
      return GameInstallManager.detectAndApply()
    })

    secureIpcHandle(ElectronAPIEventKeys.GameInstallChooseFolder, () => {
      return GameInstallManager.chooseFolder()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.GameInstallOpenOfficial,
      (_, target: GameInstallOpenTarget) => {
        if (target !== 'updater' && target !== 'egl' && target !== 'xbox') {
          return { ok: false, method: 'none' }
        }

        return GameInstallManager.openOfficialApp(target)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AccountsOrderingSync,
      async (_, accounts: AccountDataRecord) => {
        await AccountsManager.reorder(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.CustomizableMenuSettingsUpdate,
      async (_, key: keyof CustomizableMenuSettings, visibility: boolean) => {
        await CustomizableMenuSettingsManager.update(key, visibility)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.CustomProcessKill, () => {
      CustomProcess.kill()
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
    secureIpcOn(
      ElectronAPIEventKeys.WindowChromeTheme,
      (_, theme: WindowChromeTheme) => {
        try {
          MainWindow.instance.setTitleBarOverlay(
            WindowChrome.overlay(theme === 'light' ? 'light' : 'dark')
          )

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          // Not every platform has an overlay to repaint.
        }
      }
    )

    /**
     * Events
     */

    secureIpcOn(
      ElectronAPIEventKeys.OnRemoveAccount,
      async (_, accountId: string) => {
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
        await Authentication.exchange(code)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.CreateAuthWithAuthorization,
      async (_, code: string) => {
        await Authentication.authorization(code)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.CreateAuthWithDevice,
      async (_, data: AuthenticationByDeviceProperties) => {
        await Authentication.device(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ImportAccountsFromAerial,
      async () => {
        await AccountsManager.importFromAerial()
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.OpenEpicGamesSettings,
      async (_, account: AccountData) => {
        await Authentication.openEpicGamesSettings(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.GenerateExchangeCode,
      async (_, account: AccountData) => {
        await Authentication.generateExchangeCode(account)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.RequestNewVersionStatus, async () => {
      await Application.checkVersion()
    })

    /**
     * Launcher
     */

    secureIpcOn(
      ElectronAPIEventKeys.LauncherStart,
      async (_, account: AccountData) => {
        await FortniteLauncher.start(account)
      }
    )

    /**
     * STW Operations
     */

    secureIpcOn(ElectronAPIEventKeys.ServerStatusRequest, async () => {
      await ServerStatus.request()
    })

    /**
     * FN Launch
     */

    secureIpcHandle(ElectronAPIEventKeys.FnLaunchSettingsRequest, async () => {
      return getLaunchSettings()
    })

    secureIpcHandle(
      ElectronAPIEventKeys.FnLaunchSettingsUpdate,
      async (_, settings: FnLaunchSettings) => {
        await saveFnLaunchSettings(settings)

        return { success: true }
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FnLaunchGameSettingsRequest,
      async () => {
        return getGameSettings()
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FnLaunchGameSettingsUpdate,
      async (_, partial: Partial<GameSettings>) => {
        return saveGameSettings(partial)
      }
    )

    secureIpcHandle(
      ElectronAPIEventKeys.FnLaunchGameSettingsRestore,
      async () => {
        return restoreGameSettingsBackup()
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AccountHealthRequest,
      async (_, accounts: Array<AccountData>) => {
        await AccountHealth.request(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ExpeditionsRequest,
      async (_, accounts: Array<AccountData>) => {
        await Expeditions.request(accounts)
      }
    )

    secureIpcHandle(ElectronAPIEventKeys.AutoExpeditionsStatus, async () =>
      AutoExpeditions.getData()
    )
    secureIpcHandle(
      ElectronAPIEventKeys.AutoExpeditionsUpdate,
      async (
        _,
        accountId: string,
        partial: Partial<import('./startup/auto-expeditions').AutoExpeditionConfig>
      ) =>
        AutoExpeditions.update(accountId, partial)
    )
    secureIpcHandle(
      ElectronAPIEventKeys.AutoExpeditionsEnsureStarted,
      async (_, accountIds: Array<string>) =>
        AutoExpeditions.ensureStarted(accountIds)
    )
    secureIpcOn(ElectronAPIEventKeys.ItemDatabaseRequest, async () => {
      const { ItemDatabase } = await loadItemDatabase()
      await ItemDatabase.request()
    })

    secureIpcOn(ElectronAPIEventKeys.ItemDatabaseRefresh, async () => {
      const { ItemDatabase } = await loadItemDatabase()
      await ItemDatabase.request(true)
    })

    secureIpcOn(ElectronAPIEventKeys.TimelineRequest, async () => {
      await Timeline.request()
    })

    secureIpcOn(
      ElectronAPIEventKeys.LeaderboardRequest,
      async (_, metric: string, force?: boolean) => {
        await Leaderboard.request(metric, Boolean(force))
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LoadoutsRequest,
      async (_, account: AccountData) => {
        await Loadouts.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LoadoutEdit,
      async (_, account: AccountData, request: LoadoutEditRequest) => {
        await Loadouts.edit(account, request)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ItemAction,
      async (_, account: AccountData, request: ItemActionRequest) => {
        await ItemActions.perform(account, request)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.QuestsRequest,
      async (_, account: AccountData) => {
        await Quests.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.QuestsPin,
      async (_, account: AccountData, pinnedQuestIds: Array<string>) => {
        await Quests.pin(account, pinnedQuestIds)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.InventoryRequest,
      async (_, accounts: Array<AccountData>) => {
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
        await Inventory.recycle(accounts, selection)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ShopRequest,
      async (_, accounts: Array<AccountData>) => {
        await Shop.request(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ShopPurchase,
      async (
        _,
        account: AccountData,
        offer: Parameters<typeof Shop.purchase>[1]
      ) => {
        await Shop.purchase(account, offer)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.ShopOpen,
      async (_, accounts: Array<AccountData>) => {
        await Shop.openLlamas(accounts)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.ShopCatalogRequest, async () => {
      await Shop.requestCatalog()
    })

    secureIpcOn(
      ElectronAPIEventKeys.LockerRequest,
      async (_, account: AccountData) => {
        await Locker.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerOwnedRequest,
      async (_, account: AccountData, refresh: boolean) => {
        await Locker.requestOwned(account, refresh)
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
        await Locker.equip(account, slotKey, templateId, itemName)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerCardGenerate,
      async (_, account: AccountData, filters: LockerCardFilters) => {
        await Locker.generateCard(account, filters)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerCardOpen,
      async (_, filePath: string) => {
        await Locker.openCard(filePath)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.LockerCardExport,
      async (_, filePath: string, fileName: string) => {
        await Locker.exportCard(filePath, fileName)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.SquadsRequest,
      async (_, account: AccountData) => {
        await Squads.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.SquadsAssign,
      async (_, account: AccountData, assignments: Array<SquadAssignment>) => {
        await Squads.assign(account, assignments)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.FriendsManagerRequest,
      async (_, account: AccountData) => {
        await FriendsManager.request(account)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.FriendsManagerSearch,
      async (_, account: AccountData, query: string) => {
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
        await FriendsManager.bulkAction(account, targetAccountIds, action)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsAccountProfileRequest,
      async (_, accounts: Array<AccountData>) => {
        await XPBoostsManager.requestAccounts(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsConsumePersonal,
      async (_, data: XPBoostsConsumePersonalData) => {
        await XPBoostsManager.consumePersonal(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsConsumeTeammate,
      async (_, data: XPBoostsConsumeTeammateData) => {
        await XPBoostsManager.consumeTeammate(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsSearchUser,
      async (_, config: XPBoostsSearchUserConfig) => {
        await XPBoostsManager.searchUser(
          ElectronAPIEventKeys.XPBoostsSearchUserNotification,
          config
        )
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.XPBoostsGeneralSearchUser,
      async (_, config: XPBoostsSearchUserConfig) => {
        await XPBoostsManager.generalSearchUser(config)
      }
    )

    /**
     * Party
     */

    secureIpcOn(
      ElectronAPIEventKeys.PartyClaimAction,
      async (_, selectedAccount: Array<AccountData>) => {
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
        await Party.leaveParty(selectedAccounts, accounts, claimState)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.PartyLoadFriends, async () => {
      await Party.loadFriends()
    })

    secureIpcOn(
      ElectronAPIEventKeys.PartyAddNewFriendAction,
      async (_, account: AccountData, displayName: string) => {
        await Party.addNewFriend(account, displayName)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.PartyInviteAction,
      async (_, account: AccountData, accountIds: Array<string>) => {
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
        await Party.removeFriend(data)
      }
    )

    /**
     * Advanced Mode
     */

    secureIpcOn(
      ElectronAPIEventKeys.HomeFetchPlayerRequest,
      async (_, config: AlertsDoneSearchPlayerConfig) => {
        await AlertsDone.fetchPlayerData(config)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.HomeWorldInfoRequest,
      async (_, accountId?: string) => {
        await WorldInfoManager.requestForHome(accountId)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.HomePennyDBMissionsRequest, async () => {
      await PennyDBMissions.request()
    })

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoRequestData,
      async (_, accountId?: string) => {
        await WorldInfoManager.requestForAdvanceSection(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoSaveFile,
      async (_, data: SaveWorldInfoData) => {
        await WorldInfoManager.saveFile(data)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.WorldInfoRequestFiles, async () => {
      await WorldInfoManager.requestFiles()
    })

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoDeleteFile,
      async (_, data: WorldInfoFileData) => {
        await WorldInfoManager.deleteFile(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoExportFile,
      async (_, data: WorldInfoFileData) => {
        await WorldInfoManager.exportWorldInfoFile(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoOpenFile,
      async (_, data: WorldInfoFileData) => {
        await WorldInfoManager.openWorldInfoFile(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.WorldInfoRenameFile,
      async (_, data: WorldInfoFileData, newFilename: string) => {
        await WorldInfoManager.renameFile(data, newFilename)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.MatchmakingTrackStatus,
      async (_, account: AccountData, accountId: string) => {
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
     * Automation
     */

    secureIpcOn(ElectronAPIEventKeys.AutomationServiceRequestData, async () => {
      await Automation.load()
    })

    secureIpcOn(
      ElectronAPIEventKeys.AutomationServiceStart,
      async (_, accountId: string) => {
        await Automation.addAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutomationServiceReload,
      async (_, accountId: string) => {
        await Automation.reload(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutomationServiceRemove,
      async (_, accountId: string) => {
        await Automation.removeAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutomationServiceActionUpdate,
      async (_, accountId: string, config: AutomationServiceActionConfig) => {
        await Automation.updateAction(accountId, config)
      }
    )

    /**
     * Taxi Service
     */

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceAddAccounts,
      async (_, origin: Array<string>, destination: Array<string>) => {
        await TaxiService.sendRequests(origin, destination)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceRequestData,
      async () => {
        await TaxiService.load()
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceStart,
      async (_, accountId: string) => {
        await TaxiService.addAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceReload,
      async (_, ids: Array<string>) => {
        await TaxiService.reload(ids)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceRemove,
      async (_, accountId: string) => {
        await TaxiService.removeAccount(accountId)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceServiceActionUpdate,
      async (_, accountId: string, config: TaxiServiceServiceActionConfig) => {
        await TaxiService.updateAction(accountId, config)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceWhitelistAdd,
      async (_, accountId: string, displayName: string) => {
        await TaxiService.addWhitelist(accountId, displayName)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.TaxiServiceWhitelistRemove,
      async (_, accountId: string, targetId: string) => {
        await TaxiService.removeWhitelist(accountId, targetId)
      }
    )

    /**
     * Urns
     */

    secureIpcOn(ElectronAPIEventKeys.UrnsServiceRequestData, async () => {
      await AutoPinUrns.load()
    })

    secureIpcOn(
      ElectronAPIEventKeys.UrnsServiceAdd,
      async (_, accountId: string) => {
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
        await AutoPinUrns.updateAccount(accountId, templateId, value)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.UrnsServiceRemove,
      async (_, accountId: string) => {
        await AutoPinUrns.removeAccount(accountId)
      }
    )

    /**
     * Auto-llamas
     */

    secureIpcOn(
      ElectronAPIEventKeys.AutoLlamasLoadAccountsRequest,
      async () => {
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
        await AutoLlamas.addAccount(accounts)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutoLlamasAccountUpdate,
      async (_, data: AutoLlamasAccountUpdateParams) => {
        await AutoLlamas.updateAccounts(data)
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.AutoLlamasAccountRemove,
      async (_, data: Array<string> | null) => {
        await AutoLlamas.removeAccounts(data)
      }
    )

    secureIpcOn(ElectronAPIEventKeys.AutoLlamasAccountCheck, async () => {
      await AutoLlamas.check()
    })

    /**
     * V-Bucks Information
     */

    secureIpcOn(
      ElectronAPIEventKeys.VBucksInformationRequest,
      async (_, accounts: Array<AccountData>) => {
        await VBucksInformation.requestBulkInfo(accounts)
      }
    )

    /**
     * Gifts Information
     */

    secureIpcOn(
      ElectronAPIEventKeys.GiftsInformationRequest,
      async (_, accounts: Array<AccountData>) => {
        await GiftsInformation.requestBulkInfo(accounts)
      }
    )

    /**
     * Redeem Codes
     */

    secureIpcOn(
      ElectronAPIEventKeys.RedeemCodesRedeem,
      async (_, accounts: Array<AccountData>, codes: Array<string>) => {
        await RedeemCodes.redeem(accounts, codes)
      }
    )

    /**
     * Accounts
     */

    secureIpcOn(
      ElectronAPIEventKeys.UpdateAccountBasicInfo,
      async (_, account: AccountBasicInfo) => {
        await AccountsManager.add(account)
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ResponseUpdateAccountBasicInfo
        )
      }
    )

    secureIpcOn(
      ElectronAPIEventKeys.EULAVerificationRequest,
      async (_, accountIds: Array<string>) => {
        await EULATracking.verify(accountIds)
      }
    )

    /**
     * Schedules
     */

    schedule.scheduleJob(
      {
        /**
         * Executes in every reset at time: 00:00:10 AM
         * Hour: 00
         * Minute: 00
         * Second: 10
         */
        rule: '10 0 0 * * *',
        /**
         * Time zone
         */
        tz: 'UTC',
      },
      () => {
        WorldInfoManager.requestForHome().catch((error) => {
          RuntimeLog.error('schedule:world-info-home', error)
        })
        WorldInfoManager.requestForAdvanceSection().catch((error) => {
          RuntimeLog.error('schedule:world-info-advanced', error)
        })
      }
    )

    schedule.scheduleJob(
      {
        /**
         * Runs: daily every hour
         * Hour: every hour
         * Minute: 1
         */
        rule: '1 * * * *',
        /**
         * Time zone
         */
        tz: 'UTC',
      },
      () => {
        ProcessAutoLlamas.start({
          selected: AutoLlamas.getAccounts({
            type: ProcessLlamaType.FreeUpgrade,
          }),
          type: ProcessLlamaType.FreeUpgrade,
        })
      }
    )

    schedule.scheduleJob(
      {
        /**
         * Runs: every reset at time: 00:01:00 AM
         * Hour: 0 AM (midnight)
         * Minute: 1
         */
        rule: '1 0 * * *',
        /**
         * Time zone
         */
        tz: 'UTC',
      },
      () => {
        ProcessAutoLlamas.start({
          selected: AutoLlamas.getAccounts({
            type: ProcessLlamaType.Survivor,
          }),
          type: ProcessLlamaType.Survivor,
        })
      }
    )

    /**
     * Auto Daily Quests (ClientQuestLogin)
     */

    schedule.scheduleJob(
      {
        /**
         * Runs: every reset at time: 00:01:00 AM
         * Hour: 0 AM (midnight)
         * Minute: 1
         * Second: 0
         */
        rule: '0 1 0 * * *',
        /**
         * Time zone
         */
        tz: 'UTC',
      },
      runAutoDailyQuests
    )
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
    AutoExpeditions.start()
    }
  })

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and import them here.
})()
