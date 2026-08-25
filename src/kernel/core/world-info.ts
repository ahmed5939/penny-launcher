import type {
  SaveWorldInfoData,
  WorldInfoDeleteResponse,
  WorldInfoExportResponse,
  WorldInfoFileData,
  WorldInfoOpenResponse,
  WorldInfoParsed,
  WorldInfoResponse,
} from '../../types/data/advanced-mode/world-info'
import type { AccountData } from '../../types/accounts'

import crypto from 'node:crypto'
import {
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { dialog, shell } from 'electron'

import { defaultWorldInfo } from '../../config/constants/fortnite/world-info'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { MainWindow } from '../startup/windows/main'
import { AccountsManager } from '../startup/accounts'
import { DataDirectory } from '../startup/data-directory'
import { Authentication } from './authentication'

import { getWorldInfoData } from '../../services/endpoints/advanced-mode/world-info'

import { localeCompareForSorting } from '../../lib/utils'

export class WorldInfoManager {
  static async requestForHome(accountId?: string) {
    try {
      const response = await WorldInfoManager.request(accountId)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.HomeWorldInfoResponse,
        response as WorldInfoParsed
      )

      return

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.HomeWorldInfoResponse,
      defaultWorldInfo
    )
  }

  static async requestForAdvanceSection(accountId?: string) {
    try {
      const response = await WorldInfoManager.request(accountId)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.WorldInfoResponseData,
        {
          data: response,
          status: true,
        } as WorldInfoResponse
      )

      return

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.WorldInfoResponseData,
      {
        data: null,
        status: false,
      } as WorldInfoResponse
    )
  }

  static async saveFile(value: SaveWorldInfoData) {
    let status = false

    try {
      await DataDirectory.checkOrCreateWorldInfoDirectory()
      await writeFile(
        path.join(
          DataDirectory.getWorldInfoDirectoryPath(),
          `${value.filename}.json`
        ),
        JSON.stringify(value.data, null, 2),
        {
          encoding: 'utf8',
        }
      )

      status = true

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.WorldInfoSaveNotification,
      status
    )
  }

  static async requestFiles() {
    try {
      const basePath = DataDirectory.getWorldInfoDirectoryPath()
      const dir = await readdir(basePath)

      const getFileData = async (filename: string) => {
        try {
          const filePath = path.join(basePath, filename)
          const stats = await stat(filePath)

          if (
            !stats.isFile() ||
            (stats.isFile() && !filename.endsWith('.json'))
          ) {
            return null
          }

          // const file = await readFile(filePath, {
          //   encoding: 'utf8',
          // })

          // const parsedJson = JSON.parse(file)
          const data: WorldInfoFileData = {
            createdAt: stats.birthtime,
            date: stats.birthtime,
            data: null, // parsedJson,
            filename: filename.replace('.json', ''),
            id: crypto.randomUUID(),
            size: stats.size,
          }

          return data

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          //
        }

        return null
      }

      Promise.allSettled(dir.map(getFileData)).then((responseFiles) => {
        const filtered = responseFiles
          .filter((response) => response.status === 'fulfilled')
          .map(
            (response) =>
              (response as PromiseFulfilledResult<WorldInfoFileData>).value
          ) as Array<WorldInfoFileData>

        const sortedFiles = filtered.toSorted(
          (itemA, itemB) =>
            (itemB.createdAt?.getTime() ?? 0) -
              (itemA.createdAt?.getTime() ?? 0) ||
            localeCompareForSorting(itemB.filename, itemA.filename)
        )

        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.WorldInfoResponseFiles,
          sortedFiles
        )
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }
  }

  static async deleteFile(data: WorldInfoFileData) {
    const response: WorldInfoDeleteResponse = {
      filename: data.filename,
      status: false,
    }

    try {
      await rm(
        path.join(
          DataDirectory.getWorldInfoDirectoryPath(),
          `${data.filename}.json`
        )
      )

      response.status = true

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.WorldInfoDeleteNotification,
      response
    )
  }

  static async exportWorldInfoFile(value: WorldInfoFileData) {
    const defaultResponse = () => {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.WorldInfoExportFileNotification,
        {
          status: 'canceled',
        } as WorldInfoExportResponse
      )
    }

    try {
      const response = await dialog.showSaveDialog({
        defaultPath: `${value.filename}.json`,
        filters: [
          {
            extensions: ['json'],
            name: 'World Info',
          },
        ],
      })

      if (response.canceled || !response.filePath) {
        defaultResponse()

        return
      }

      try {
        const basePath = DataDirectory.getWorldInfoDirectoryPath()
        const filePath = path.join(basePath, `${value.filename}.json`)

        const file = await readFile(filePath, {
          encoding: 'utf8',
        })
        const parsedJson = JSON.parse(file)

        await writeFile(
          response.filePath,
          JSON.stringify(parsedJson, null, 2),
          {
            encoding: 'utf8',
          }
        )

        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.WorldInfoExportFileNotification,
          {
            status: 'success',
          } as WorldInfoExportResponse
        )

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.WorldInfoExportFileNotification,
          {
            status: 'error',
          } as WorldInfoExportResponse
        )
      }

      return

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    defaultResponse()
  }

  static async openWorldInfoFile({ filename }: WorldInfoFileData) {
    const response: WorldInfoOpenResponse = {
      filename,
      status: false,
    }

    try {
      await shell.openPath(
        path.join(
          DataDirectory.getWorldInfoDirectoryPath(),
          `${filename}.json`
        )
      )

      response.status = true

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.WorldInfoOpenFileNotification,
      response
    )
  }

  static async renameFile(data: WorldInfoFileData, newFilename: string) {
    let status = false

    try {
      const baseFilePath = path.join(
        DataDirectory.getWorldInfoDirectoryPath(),
        `${data.filename}.json`
      )
      const newFilePath = path.join(
        DataDirectory.getWorldInfoDirectoryPath(),
        `${newFilename}.json`
      )

      try {
        await readFile(newFilePath, {
          encoding: 'utf8',
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        await rename(baseFilePath, newFilePath)

        status = true
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.WorldInfoRenameFileNotification,
      status
    )
  }

  private static getAccount(accountId?: string): AccountData | undefined {
    if (accountId) {
      return AccountsManager.getAccountById(accountId)
    }

    return AccountsManager.getAccounts().first()
  }

  private static async request(accountId?: string) {
    try {
      const account = WorldInfoManager.getAccount(accountId)

      if (!account) {
        return defaultWorldInfo
      }

      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return defaultWorldInfo
      }

      const worldInfoResponse = await getWorldInfoData({
        accessToken,
      })

      if (
        worldInfoResponse.data.missionAlerts?.length <= 0 ||
        worldInfoResponse.data.missions?.length <= 0 ||
        worldInfoResponse.data.theaters?.length <= 0
      ) {
        return defaultWorldInfo
      }

      return worldInfoResponse.data

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    return defaultWorldInfo
  }
}
