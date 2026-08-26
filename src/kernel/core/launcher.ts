import { RuntimeLog } from '../runtime-log'
import type { AccountData } from '../../types/accounts'

import { spawn } from 'node:child_process'
import path from 'node:path'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { launcherAppClient2 } from '../../config/fortnite/clients'

import { MainWindow } from '../startup/windows/main'
import { DataDirectory } from '../startup/data-directory'
import { Authentication } from './authentication'
// import { Manifest } from './manifest'

import {
  getAccessTokenUsingExchangeCode,
  getExchangeCodeUsingAccessToken,
} from '../../services/endpoints/oauth'
import { createLauncherArguments } from './launcher-arguments'

export class FortniteLauncher {
  static async start(account: AccountData) {
    const sendError = () => {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.LauncherNotification,
        {
          account,
          status: false,
        }
      )
    }

    try {
      // const manifest = Manifest.get()

      // if (!manifest) {
      //   sendError()

      //   return
      // }

      const { settings } = await DataDirectory.getSettingsFile()
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

      const args = createLauncherArguments({
        accountId: account.accountId,
        displayName: account.displayName,
        exchangeCode: launcherExchangeCode.data.code,
      })
      const executable = path.join(settings.path, 'FortniteLauncher.exe')
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
