import { RuntimeLog } from '../runtime-log'
import type { AccountData } from '../../types/accounts'

import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { launcherAppClient2 } from '../../config/fortnite/clients'
import { fortniteLauncherExecutable } from '../../config/fortnite/install'

import { MainWindow } from '../startup/windows/main'
import { DataDirectory } from '../startup/data-directory'
import { Authentication } from './authentication'

import {
  getAccessTokenUsingExchangeCode,
  getExchangeCodeUsingAccessToken,
} from '../../services/endpoints/oauth'
import { getLaunchSettings, startProcessKiller } from './fn-launch'
import { createLauncherArguments } from './launcher-arguments'

export class FortniteLauncher {
  static async start(account: AccountData) {
    const sendError = (reason?: 'missing-install') => {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.LauncherNotification,
        {
          account,
          status: false,
          reason,
        }
      )
    }

    try {
      const { settings } = await DataDirectory.getSettingsFile()
      const executable = path.join(settings.path, fortniteLauncherExecutable)

      // Launch is always the official FortniteLauncher.exe from the configured
      // folder. Missing file is an empty-state problem, not an auth failure.
      try {
        await access(executable)
      } catch {
        sendError('missing-install')
        return
      }

      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        sendError()

        return
      }

      const accountExchangeCode =
        await getExchangeCodeUsingAccessToken(accessToken)

      if (!accountExchangeCode.data.code) {
        sendError()

        return
      }

      const launcherAccessToken = await getAccessTokenUsingExchangeCode(
        accountExchangeCode.data.code,
        {
          headers: {
            Authorization: `basic ${launcherAppClient2.auth}`,
          },
        }
      )

      if (!launcherAccessToken.data.access_token) {
        sendError()

        return
      }

      const launcherExchangeCode = await getExchangeCodeUsingAccessToken(
        launcherAccessToken.data.access_token
      )

      if (!launcherExchangeCode.data.code) {
        sendError()

        return
      }

      const launchSettings = await getLaunchSettings()
      const args = createLauncherArguments({
        accountId: account.accountId,
        displayName: account.displayName,
        exchangeCode: launcherExchangeCode.data.code,
        launchArgs: launchSettings.launchArgs,
      })
      const process = spawn(executable, args, {
        cwd: settings.path,
        detached: true,
        shell: false,
        stdio: 'ignore',
        windowsHide: false,
      })

      await new Promise<void>((resolve, reject) => {
        process.once('spawn', resolve)
        process.once('error', reject)
      })
      process.unref()

      // The game is up: begin the configured process-kill schedule, if any.
      startProcessKiller().catch((error) => {
        RuntimeLog.error('caught:core/launcher.ts', error)
      })

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.LauncherNotification,
        {
          account,
          status: true,
        }
      )

      return

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/launcher.ts', error)
    }

    sendError()
  }
}
