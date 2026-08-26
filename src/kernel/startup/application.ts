import { RuntimeLog } from '../runtime-log'
import packageJson from '../../../package.json'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from './windows/main'

import { getAppReleases } from '../../services/endpoints/repository'

export class Application {
  static async checkVersion() {
    try {
      const currentVersion = `v${packageJson.version}`

      const response = await getAppReleases()
      // Skip the rolling nightly prerelease — only stable releases should
      // nudge users to update.
      const latest = response.data.find(
        (release) => !release.draft && !release.prerelease
      )

      if (latest && latest.tag_name !== currentVersion) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ResponseNewVersionStatus,
          {
            link: latest.html_url,
            version: latest.tag_name,
          }
        )

        return
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/application.ts', error)
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ResponseNewVersionStatus,
      null
    )
  }
}
