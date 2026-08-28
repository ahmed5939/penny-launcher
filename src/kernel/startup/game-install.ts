import { spawn } from 'node:child_process'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { dialog, shell } from 'electron'

import { RuntimeLog } from '../runtime-log'
import type {
  GameFolderPickResult,
  GameInstallOpenTarget,
  GameInstallStatus,
  GameUpdaterResult,
} from '../../types/game-install'
import type { Settings } from '../../types/settings'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { launcherAppClient2 } from '../../config/fortnite/clients'
import {
  defaultFortniteBinariesPath,
  eglFortniteAppUri,
  eglFortniteStoreUrl,
  eglLauncherExecutables,
  fortniteAppName,
  fortniteCatalogItemId,
  fortniteLauncherExecutable,
  xboxFortniteStoreUri,
  xboxFortniteStoreUrl,
} from '../../config/fortnite/install'
import { launcherAvailablePlatforms } from '../../services/config/launcher'
import { getLauncherAssetForCatalogItem } from '../../services/endpoints/launcher'
import { getLightswitchStatus } from '../../services/endpoints/lightswitch'
import {
  createAccessTokenUsingClientCredentials,
  killSession,
} from '../../services/endpoints/oauth'

import { MainWindow } from './windows/main'
import { DataDirectory } from './data-directory'
import {
  decorateInstallPlatform,
  isUpdateAvailable,
  missingInstallSnapshot,
  resolveFortniteBinariesDir,
  scanGameInstalls,
  updateMethodFor,
  type GameInstallIo,
} from '../core/game-install'

const nodeIo: GameInstallIo = {
  exists: async (filePath) => {
    try {
      await access(filePath)
      return true
    } catch {
      return false
    }
  },
  readFile,
  readdir: async (directoryPath) => {
    const entries = await readdir(directoryPath, { withFileTypes: true })

    return entries.map((entry) => entry.name)
  },
  drives:
    process.platform === 'win32'
      ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `${letter}:`)
      : [],
}

export class GameInstallManager {
  private static latestVersion: string | null = null
  private static lastCheckedAt: number | null = null
  private static latestInFlight: Promise<string | null> | null = null

  static async getStatus(forceLatest = false): Promise<GameInstallStatus> {
    const settings = await readSettings()
    const scan = await scanGameInstalls(nodeIo, {
      settingsPath: settings.path,
    })
    const preferred = decorateInstallPlatform(
      scan.preferred.found
        ? scan.preferred
        : missingInstallSnapshot(settings.path)
    )

    if (
      !scan.settingsPathValid &&
      preferred.found &&
      preferred.binariesPath &&
      isDefaultOrEmptyPath(settings.path)
    ) {
      await persistPath(settings, preferred.binariesPath)
    }

    const latestVersion = await GameInstallManager.getLatestVersion(forceLatest)
    const configuredPath = preferred.binariesPath ?? settings.path

    return {
      install: preferred,
      configuredPath,
      configuredPathValid: scan.settingsPathValid || preferred.found,
      latestVersion,
      updateAvailable:
        preferred.found &&
        isUpdateAvailable(preferred.version, latestVersion),
      lastCheckedAt: GameInstallManager.lastCheckedAt,
      updateMethod: updateMethodFor(preferred.platform, preferred.found),
    }
  }

  static async detectAndApply(): Promise<{
    appVersion: string
    name: string
    path: string
  }> {
    const settings = await readSettings()
    const scan = await scanGameInstalls(nodeIo, {
      settingsPath: settings.path,
    })
    const preferred = decorateInstallPlatform(
      scan.preferred.found
        ? scan.preferred
        : missingInstallSnapshot(settings.path)
    )
    const binariesPath = preferred.binariesPath ?? settings.path
    const latestVersion = await GameInstallManager.getLatestVersion(true)
    const appVersion =
      preferred.version ??
      latestVersion ??
      '++Fortnite+Release-38.00-CL-47722112-Windows'

    if (preferred.found && preferred.binariesPath) {
      await persistPath(settings, preferred.binariesPath)
    }

    return {
      appVersion,
      name: fortniteAppName,
      path: binariesPath,
    }
  }

  static async chooseFolder(): Promise<GameFolderPickResult> {
    const settings = await readSettings()
    const response = await dialog.showOpenDialog(MainWindow.instance, {
      defaultPath: settings.path || defaultFortniteBinariesPath,
      properties: ['openDirectory'],
      title: 'Select the Fortnite Win64 folder',
    })

    if (response.canceled || !response.filePaths[0]) {
      return { ok: false, path: null, reason: 'canceled' }
    }

    const binariesPath = await resolveFortniteBinariesDir(
      response.filePaths[0],
      nodeIo.exists
    )

    if (!binariesPath) {
      return { ok: false, path: null, reason: 'invalid' }
    }

    await persistPath(settings, binariesPath)

    return { ok: true, path: binariesPath, reason: 'applied' }
  }

  static async openOfficialApp(
    target: GameInstallOpenTarget
  ): Promise<GameUpdaterResult> {
    if (target === 'egl') {
      return openEpicUpdater()
    }

    if (target === 'xbox') {
      return openXboxStore()
    }

    const status = await GameInstallManager.getStatus()

    if (status.updateMethod === 'xbox') {
      return openXboxStore()
    }

    if (status.updateMethod === 'egl') {
      return openEpicUpdater()
    }

    return openHttpsStore(
      status.install.platform === 'xbox'
        ? xboxFortniteStoreUrl
        : eglFortniteStoreUrl
    )
  }

  static async getLatestVersion(force = false) {
    if (!force && GameInstallManager.latestVersion) {
      return GameInstallManager.latestVersion
    }

    if (GameInstallManager.latestInFlight) {
      return GameInstallManager.latestInFlight
    }

    GameInstallManager.latestInFlight = fetchLiveBuildVersion()
      .then((version) => {
        GameInstallManager.latestVersion = version
        GameInstallManager.lastCheckedAt = Date.now()
        GameInstallManager.latestInFlight = null

        return version
      })
      .catch((error) => {
        RuntimeLog.error('caught:startup/game-install.ts', error)
        GameInstallManager.latestInFlight = null
        GameInstallManager.lastCheckedAt = Date.now()

        return GameInstallManager.latestVersion
      })

    return GameInstallManager.latestInFlight
  }
}

async function readSettings() {
  const { settings } = await DataDirectory.getSettingsFile()
  const defaults = DataDirectory.getSettingsDefaultData()

  return {
    ...defaults,
    ...settings,
  }
}

async function persistPath(settings: Settings, binariesPath: string) {
  const next = {
    ...settings,
    path: binariesPath,
  }

  await DataDirectory.updateSettingsFile(next)
  MainWindow.instance.webContents.send(
    ElectronAPIEventKeys.OnLoadSettings,
    next
  )
}

function isDefaultOrEmptyPath(value: string) {
  const normalized = path.normalize(value || '').toLowerCase()

  return (
    normalized.length === 0 ||
    normalized === path.normalize(defaultFortniteBinariesPath).toLowerCase()
  )
}

async function fetchLiveBuildVersion() {
  let token: string | null = null

  try {
    const result = await createAccessTokenUsingClientCredentials({
      authorization: launcherAppClient2.auth,
    })

    token = result.data.access_token

    const status = await getLightswitchStatus('Fortnite', {
      headers: {
        Authorization: `bearer ${result.data.access_token}`,
      },
    })
    const asset = await getLauncherAssetForCatalogItem(
      {
        appName: status.data.launcherInfoDTO?.appName ?? fortniteAppName,
        catalogItemId:
          status.data.launcherInfoDTO?.catalogItemId ?? fortniteCatalogItemId,
        platform: launcherAvailablePlatforms.Windows,
        label: 'Live',
      },
      {
        headers: {
          Authorization: `bearer ${result.data.access_token}`,
        },
      }
    )

    return asset.data.buildVersion || null
  } finally {
    if (token !== null) {
      killSession(token, {
        headers: {
          Authorization: `bearer ${token}`,
        },
      }).catch(() => {})
    }
  }
}

async function openEpicUpdater(): Promise<GameUpdaterResult> {
  for (const executable of eglLauncherExecutables) {
    try {
      await access(executable)
      // EGL owns the patch: this only asks the official launcher to open Fortnite.
      const child = spawn(executable, [eglFortniteAppUri], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      })
      child.unref()

      return { ok: true, method: 'egl-exe' }
    } catch {
      // Try the next known EGL path, then the protocol handler.
    }
  }

  try {
    await shell.openExternal(eglFortniteAppUri)

    return { ok: true, method: 'egl-protocol' }
  } catch (error) {
    RuntimeLog.error('caught:startup/game-install.ts', error)
  }

  return openHttpsStore(eglFortniteStoreUrl)
}

async function openXboxStore(): Promise<GameUpdaterResult> {
  try {
    await shell.openExternal(xboxFortniteStoreUri)

    return { ok: true, method: 'xbox-store' }
  } catch (error) {
    RuntimeLog.error('caught:startup/game-install.ts', error)
  }

  return openHttpsStore(xboxFortniteStoreUrl)
}

async function openHttpsStore(url: string): Promise<GameUpdaterResult> {
  try {
    await shell.openExternal(url)

    return { ok: true, method: 'https-store' }
  } catch (error) {
    RuntimeLog.error('caught:startup/game-install.ts', error)
  }

  return { ok: false, method: 'none' }
}

export async function fortniteLauncherExists(binariesPath: string) {
  try {
    await access(path.join(binariesPath, fortniteLauncherExecutable))
    return true
  } catch {
    return false
  }
}
