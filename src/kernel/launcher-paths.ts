import path from 'node:path'

export const LAUNCHER_DATA_DIRECTORY_NAME = 'penny-launcher-data'

/**
 * `path.join(undefined, 'penny-launcher-data')` becomes
 * `undefined/penny-launcher-data` and can be committed. Refuse that.
 */
export function resolveLauncherDataDirectory(
  appDataPath: string | null | undefined
) {
  if (
    typeof appDataPath !== 'string' ||
    appDataPath.length === 0 ||
    appDataPath === 'undefined'
  ) {
    throw new Error(
      'Electron appData path is unavailable; refusing to write penny-launcher-data.'
    )
  }

  return path.join(appDataPath, LAUNCHER_DATA_DIRECTORY_NAME)
}
