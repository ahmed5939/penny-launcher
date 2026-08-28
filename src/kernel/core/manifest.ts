import { RuntimeLog } from '../runtime-log'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { SettingsManager } from '../startup/settings'
import { eglManifestsDirectory } from '../../config/fortnite/install'

export class Manifest {
  private static cached: Awaited<ReturnType<typeof Manifest.readData>> | undefined
  private static pending: ReturnType<typeof Manifest.readData> | null = null

  private static async readData() {
    try {
      const manifestsDirectory = eglManifestsDirectory

      const getFile = async (filename: string) => {
        const filePath = path.join(manifestsDirectory, filename)
        const file = JSON.parse(await readFile(filePath, 'utf8')) as {
          AppVersionString: string
          LaunchCommand: string
          DisplayName: string
        }
        const appVersionString = file.AppVersionString?.trim()

        return {
          AppVersionString: appVersionString ?? '',
          DisplayName: file.DisplayName?.trim().toLowerCase() ?? '',
          LaunchCommand: file.LaunchCommand?.trim() ?? '',
          UserAgent: appVersionString
            ? `Fortnite/${appVersionString}`
            : '',
        }
      }

      const filenames = (await readdir(manifestsDirectory)).filter((filename) =>
        filename.endsWith('item')
      )
      const manifests = await Promise.all(filenames.map(getFile))
      const manifestItem = manifests.find(
        ({ DisplayName }) => DisplayName === 'fortnite'
      )

      if (manifestItem) {
        return manifestItem
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/manifest.ts', error)
    }

    return null
  }

  static async getData(force = false) {
    if (!force && Manifest.cached !== undefined) return Manifest.cached
    if (!force && Manifest.pending) return Manifest.pending

    Manifest.pending = Manifest.readData().then((value) => {
      Manifest.cached = value
      Manifest.pending = null
      return value
    })

    return Manifest.pending
  }

  static async getUserAgent() {
    const userAgent = (await Manifest.getData())?.UserAgent
    const settings = await SettingsManager.getData()

    return userAgent || settings.userAgent
  }
}
